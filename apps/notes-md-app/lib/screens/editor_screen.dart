import 'package:flutter/material.dart';
import 'package:flutter_inappwebview/flutter_inappwebview.dart';
import '../services/bridge_service.dart';
import '../services/file_service.dart';
import '../widgets/toolbar.dart';

class EditorScreen extends StatefulWidget {
  const EditorScreen({super.key});

  @override
  State<EditorScreen> createState() => _EditorScreenState();
}

class _EditorScreenState extends State<EditorScreen> {
  InAppWebViewController? _webViewController;
  BridgeService? _bridgeService;
  final FileService _fileService = FileService();
  bool _isReady = false;
  bool _isLoading = true;
  int _loadProgress = 0;

  // For production: load from bundled assets
  // For development: connect to Vite dev server
  final bool _useDevServer = true; // Toggle for production vs dev

  @override
  void initState() {
    super.initState();
    InAppLocalhostServer().start();
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
      body: SafeArea(
        child: Column(
          children: [
            // Native toolbar
            if (_isReady)
              NotesMdToolbar(
                onNewDoc: _handleNewDoc,
                onOpenFile: _handleOpenFile,
                onSaveFile: _handleSaveFile,
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
    // In production, we'd use a local asset URL
    // For now, use a data URI with the built index.html content
    final initialUrl = _useDevServer
        ? WebUri('http://localhost:5173')
        : WebUri('file:///android_asset/flutter_assets/assets/notes-md/index.html');

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
      initialUrlRequest: URLRequest(url: initialUrl),
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
        debugPrint('[WebView] ${message.message}');
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
}
