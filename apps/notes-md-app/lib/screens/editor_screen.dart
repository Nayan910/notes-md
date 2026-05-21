import 'dart:io' show Platform;
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_inappwebview/flutter_inappwebview.dart';
import '../services/bridge_service.dart';
import '../services/file_service.dart';
import '../services/app_logger.dart';
import '../widgets/toolbar.dart';
import '../widgets/log_viewer.dart';
import '../main.dart' show IncomingFile;

class EditorScreen extends StatefulWidget {
  const EditorScreen({super.key});

  @override
  State<EditorScreen> createState() => _EditorScreenState();
}

class _EditorScreenState extends State<EditorScreen> {
  InAppWebViewController? _webViewController;
  BridgeService? _bridgeService;
  final FileService _fileService = FileService();
  final AppLogger _log = AppLogger();
  bool _isReady = false;
  bool _isLoading = true;
  int _loadProgress = 0;
  bool _showLog = false;

  String? _initialHtml;

  @override
  void initState() {
    super.initState();
    _log.info('App starting — offline standalone mode');
    _loadAssetHtml();
    _checkIntentFile();
  }

  Future<void> _checkIntentFile() async {
    // Handle file opened from another app (Android intent / Windows file association)
    try {
      if (Platform.isAndroid) {
        // Will be handled via MethodChannel or platform-specific code
        _log.info('Platform: Android');
      } else if (Platform.isWindows) {
        _log.info('Platform: Windows');
      }
    } catch (e) {
      _log.warn('Platform check: $e');
    }
  }

  Future<void> _loadAssetHtml() async {
    try {
      final html = await rootBundle.loadString('assets/notes-md/index.html');
      setState(() => _initialHtml = html);
      _log.info('Editor HTML loaded from assets (${html.length} chars)');
    } catch (e) {
      _log.error('Failed to load asset HTML', e);
      // Fallback: will show loading error in WebView
      setState(() => _initialHtml = '<html><body><p>Failed to load editor</p></body></html>');
    }
  }

  @override
  void dispose() {
    _webViewController?.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Theme.of(context).colorScheme.surface,
      endDrawer: Drawer(
        child: SafeArea(
          child: LogViewer(),
        ),
      ),
      body: SafeArea(
        child: Column(
          children: [
            // Native toolbar + log button
            if (_isReady)
              Row(
                children: [
                  Expanded(
                    child: NotesMdToolbar(
                      onNewDoc: _handleNewDoc,
                      onOpenFile: _handleOpenFile,
                      onSaveFile: _handleSaveFile,
                    ),
                  ),
                  IconButton(
                    icon: Icon(Icons.bug_report_outlined, size: 18),
                    tooltip: 'App Log',
                    onPressed: () => Scaffold.of(context).openEndDrawer(),
                    padding: EdgeInsets.zero,
                    constraints: BoxConstraints(minWidth: 36, minHeight: 36),
                  ),
                ],
              ),
            // WebView / loading indicator
            Expanded(
              child: Stack(
                children: [
                  _buildWebView(),
                  if (_isLoading)
                    Center(
                      child: Column(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          CircularProgressIndicator(value: _loadProgress > 0 ? _loadProgress / 100 : null),
                          const SizedBox(height: 16),
                          Text(
                            'Loading notes.md...',
                            style: Theme.of(context).textTheme.bodySmall?.copyWith(
                              color: Theme.of(context).colorScheme.onSurfaceVariant,
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
    // Determine the base URL for resolving asset paths (JS, CSS) inside the HTML
    String baseUrl;
    try {
      if (Platform.isAndroid) {
        baseUrl = 'file:///android_asset/notes-md/';
      } else if (Platform.isWindows) {
        baseUrl = 'file:///data/flutter_assets/assets/notes-md/';
      } else {
        baseUrl = 'file:///android_asset/notes-md/';
      }
    } catch (_) {
      baseUrl = 'file:///android_asset/notes-md/';
    }

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
              baseUrl: WebUri(baseUrl),
              mimeType: 'text/html',
              encoding: 'utf-8',
              historyUrl: WebUri(baseUrl),
            )
          : null,
      initialUrlRequest: _initialHtml == null
          ? URLRequest(url: WebUri('about:blank'))
          : null,
      onWebViewCreated: (controller) {
        _webViewController = controller;

        // Set up JavaScript message handler
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

        // Initialize bridge service
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

        // Inject the flutter bridge script
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
    // This creates a function the web app can call to send messages to Flutter
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
  // Simulate clicking "New Document" by dispatching to the store
  // The Zustand store is accessible globally
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

    // The web editor will respond with save-file-content via the bridge
    // Get the current active doc ID and request its content
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
    // Could update a recent files list or breadcrumb
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
