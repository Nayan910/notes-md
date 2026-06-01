import 'dart:io' show Platform;
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_inappwebview/flutter_inappwebview.dart';
import 'package:provider/provider.dart';
import '../services/bridge_service.dart';
import '../services/file_service.dart';
import '../services/app_logger.dart';
import '../services/server_config_service.dart';
import '../widgets/toolbar.dart';
import '../widgets/log_viewer.dart';
import '../widgets/settings_dialog.dart';
import '../main.dart' show IncomingFile;

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  InAppWebViewController? _webViewController;
  BridgeService? _bridgeService;
  final FileService _fileService = FileService();
  final AppLogger _log = AppLogger();
  bool _isReady = false;
  bool _isLoading = true;
  int _loadProgress = 0;

  String? _initialHtml;

  @override
  void initState() {
    super.initState();
    _log.info('App starting — offline standalone mode');
    _loadAssetHtml();
  }

  Future<void> _loadAssetHtml() async {
    try {
      final html = await rootBundle.loadString('assets/notes-md/index.html');
      setState(() => _initialHtml = html);
      _log.info('Editor HTML loaded from assets (${html.length} chars)');
    } catch (e) {
      _log.error('Failed to load asset HTML', e);
      setState(() =>
          _initialHtml = '<html><body><p>Failed to load editor</p></body></html>');
    }
  }

  @override
  void dispose() {
    _webViewController?.dispose();
    super.dispose();
  }

  /// Determine base URL for resolving asset paths inside the WebView.
  String _getBaseUrl() {
    if (Platform.isAndroid) {
      return 'file:///android_asset/notes-md/';
    } else if (Platform.isWindows) {
      return 'file:///data/flutter_assets/assets/notes-md/';
    } else if (Platform.isLinux) {
      return 'file:///data/flutter_assets/assets/notes-md/';
    }
    return 'file:///android_asset/notes-md/';
  }

  @override
  Widget build(BuildContext context) {
    final serverConfig = context.watch<ServerConfigService>();
    final theme = Theme.of(context);

    return Scaffold(
      backgroundColor: theme.colorScheme.surface,
      endDrawer: Drawer(
        child: SafeArea(child: LogViewer()),
      ),
      body: SafeArea(
        child: Column(
          children: [
            // --- Toolbar bar (only shown after editor is ready) ---
            if (_isReady)
              Container(
                color: theme.colorScheme.surfaceContainerLow,
                child: Row(
                  children: [
                    Expanded(
                      child: NotesMdToolbar(
                        onNewDoc: _handleNewDoc,
                        onOpenFile: _handleOpenFile,
                        onSaveFile: _handleSaveFile,
                      ),
                    ),
                    if (serverConfig.hasServer && serverConfig.syncEnabled)
                      Padding(
                        padding: const EdgeInsets.only(right: 2),
                        child: Tooltip(
                          message: 'Connected to ${serverConfig.serverUrl}',
                          child: Icon(Icons.cloud_done,
                              size: 16, color: Colors.green.shade600),
                        ),
                      ),
                    IconButton(
                      icon: const Icon(Icons.settings_outlined, size: 18),
                      tooltip: 'Settings',
                      onPressed: () => showSettingsDialog(context),
                      padding: EdgeInsets.zero,
                      constraints: const BoxConstraints(minWidth: 36, minHeight: 36),
                    ),
                    IconButton(
                      icon: const Icon(Icons.bug_report_outlined, size: 18),
                      tooltip: 'App Log',
                      onPressed: () => Scaffold.of(context).openEndDrawer(),
                      padding: EdgeInsets.zero,
                      constraints: const BoxConstraints(minWidth: 36, minHeight: 36),
                    ),
                  ],
                ),
              ),
            // --- WebView editor ---
            Expanded(
              child: Stack(
                children: [
                  _buildWebView(),
                  if (_isLoading)
                    Center(
                      child: Column(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          CircularProgressIndicator(
                              value: _loadProgress > 0
                                  ? _loadProgress / 100
                                  : null),
                          const SizedBox(height: 16),
                          Text(
                            'Loading notes.md...',
                            style: theme.textTheme.bodySmall?.copyWith(
                              color: theme.colorScheme.onSurfaceVariant,
                            ),
                          ),
                        ],
                      ),
                    ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildWebView() {
    return InAppWebView(
      initialSettings: InAppWebViewSettings(
        javaScriptEnabled: true,
        javaScriptCanOpenWindowsAutomatically: false,
        allowFileAccessFromFileURLs: true,
        allowUniversalAccessFromFileURLs: true,
        mixedContentMode: MixedContentMode.MIXED_CONTENT_ALWAYS_ALLOW,
        supportZoom: false,
        transparentBackground: true,
      ),
      initialData: _initialHtml != null
          ? InAppWebViewInitialData(
              data: _initialHtml!,
              baseUrl: WebUri(_getBaseUrl()),
              mimeType: 'text/html',
              encoding: 'utf-8',
              historyUrl: WebUri(_getBaseUrl()),
            )
          : null,
      initialUrlRequest: _initialHtml == null
          ? URLRequest(url: WebUri('about:blank'))
          : null,
      onWebViewCreated: (controller) {
        _webViewController = controller;
        controller.addJavaScriptHandler(
          handlerName: 'flutterBridge',
          callback: (args) {
            if (args.isNotEmpty && args[0] is String) {
              _bridgeService?.handleMessage(args[0] as String);
            }
          },
        );
      },
      onLoadStart: (controller, url) {
        setState(() => _isLoading = true);
      },
      onLoadStop: (controller, url) {
        setState(() {
          _isLoading = false;
          _loadProgress = 100;
        });
        _bridgeService = BridgeService(
          controller: controller,
          onReady: () {
            setState(() => _isReady = true);
            _handleIncomingFile();
          },
          onSaveFileContent: _handleSaveFileContent,
          onFileChanged: _handleFileChanged,
          onPickFile: _handlePickFile,
        );
        _injectBridge(controller);
      },
      onProgressChanged: (controller, progress) {
        setState(() => _loadProgress = progress);
      },
      onConsoleMessage: (controller, message) {
        if (message.message.toLowerCase().contains('error') ||
            message.message.toLowerCase().contains('exception') ||
            message.message.toLowerCase().contains('fail')) {
          _log.warn('[WebView] ${message.message}');
        }
        debugPrint('[WebView] ${message.message}');
      },
      onLoadError: (controller, url, code, message) {
        _log.error('WebView load error ($code): $message');
      },
      onLoadHttpError: (controller, url, code, message) {
        _log.error('WebView HTTP error $code: $message');
      },
    );
  }

  Future<void> _injectBridge(InAppWebViewController controller) async {
    await controller.evaluateJavascript(source: '''
if (!window.flutter_postMessage) {
  window.flutter_postMessage = function(message) {
    window.flutter_inappwebview.callHandler('flutterBridge', message);
  };
  console.log('Flutter bridge injected');
}
''');
  }

  void _handleNewDoc() {
    _webViewController?.evaluateJavascript(source: '''
(() => {
  if (window.__ZUSTAND_STORE__) {
    window.__ZUSTAND_STORE__.getState().createDoc();
  }
})();
''');
  }

  Future<void> _handleOpenFile() async {
    final file = await _fileService.pickMarkdownFile();
    if (file != null && _bridgeService != null) {
      await _bridgeService!.sendOpenFile(
        file['content']!,
        title: file['title'],
      );
    }
  }

  Future<void> _handleSaveFile() async {
    if (_bridgeService == null) return;
    await _webViewController?.evaluateJavascript(source: '''
(() => {
  const state = window.__ZUSTAND_STORE__?.getState();
  if (state?.activeDocId) {
    window.dispatchEvent(new MessageEvent('message', {
      data: JSON.stringify({
        type: 'save-file',
        payload: { id: state.activeDocId }
      }),
      origin: window.location.origin
    }));
  }
})();
''');
  }

  void _handleSaveFileContent(String id, String content, String title) {
    _fileService.saveMarkdownFile(content, title);
  }

  void _handleFileChanged(String id, String title) {
    debugPrint('Active file changed: $title ($id)');
  }

  Future<void> _handlePickFile() async {
    final file = await _fileService.pickMarkdownFile();
    if (file != null && _bridgeService != null) {
      await _bridgeService!.sendOpenFile(
        file['content']!,
        title: file['title'],
      );
    }
  }

  void _handleIncomingFile() {
    if (IncomingFile.content != null && _bridgeService != null) {
      final content = IncomingFile.content!;
      final title = IncomingFile.title ?? 'document.md';
      _log.info('Opening file from intent: $title');
      _bridgeService!.sendOpenFile(content, title: title);
      IncomingFile.content = null;
      IncomingFile.title = null;
    }
  }
}
