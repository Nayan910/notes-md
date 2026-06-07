import 'dart:io' show Platform;
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_inappwebview/flutter_inappwebview.dart';
import 'package:provider/provider.dart';
import '../services/bridge_service.dart';
import '../services/file_service.dart';
import '../services/app_logger.dart';
import '../services/note_service.dart';
import '../services/server_config_service.dart';
import '../services/sync_service.dart';
import '../widgets/toolbar.dart';
import '../widgets/log_viewer.dart';
import '../widgets/settings_dialog.dart';
import '../main.dart' show AppServices, IncomingFile;

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  InAppWebViewController? _webViewController;
  BridgeService? _bridgeService;
  late final FileService _fileService;
  NoteService? _noteService;
  SyncService? _syncService;
  final AppLogger _log = AppLogger();
  bool _isReady = false;
  bool _isLoading = true;
  int _loadProgress = 0;

  String? _initialHtml;

  @override
  void initState() {
    super.initState();
    _log.info('App starting — offline standalone mode');
    // _fileService is initialised in didChangeDependencies once the
    // AppServices FutureProvider has resolved. Until then, fall back to
    // a fresh instance so nothing in the UI breaks.
    _fileService = FileService();
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
  void didChangeDependencies() {
    super.didChangeDependencies();
    // Pick up the shared singletons provided at the root of the tree.
    final services = context.read<AppServices>();
    _fileService = services.fileService;
    _noteService = services.noteService;

    // Init SyncService once (needs ServerConfigService from Provider tree)
    if (_syncService == null) {
      final serverConfig = context.read<ServerConfigService>();
      _syncService = SyncService(
        fileService: _fileService,
        serverConfig: serverConfig,
      );
      _syncService!.addListener(_onSyncStatusChanged);
      _syncService!.init(); // fire-and-forget, just reads secure storage

      // React to server config changes (start/stop sync)
      serverConfig.addListener(() {
        _updateSyncState(serverConfig);
      });

      AppLogger.i('HomeScreen', 'SyncService initialised');
    }
  }

  @override
  void dispose() {
    _syncService?.dispose();
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
                        child: _buildSyncIcon(),
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
          callback: (args) async {
            if (args.isNotEmpty && args[0] is String) {
              final result = await _bridgeService?.handleMessage(args[0] as String);
              // Return the result to the WebView as a promise resolution
              if (result != null) {
                return result.toJson();
              }
            }
            return null;
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
          fileService: _fileService,
          noteService: _noteService,
          onReady: () {
            setState(() => _isReady = true);
            _handleIncomingFile();
            // Start background sync if server is configured
            final config = context.read<ServerConfigService>();
            _updateSyncState(config);
          },
          onFileChanged: _handleFileChanged,
          onFileDeleted: _handleFileDeleted,
          onFileRenamed: _handleFileRenamed,
          onFileSaved: _handleFileSaved,
          onFileCreated: _handleFileCreated,
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
      // ignore: deprecated_member_use
      onLoadError: (controller, url, code, message) {
        _log.error('WebView load error ($code): $message');
      },
      // ignore: deprecated_member_use
      onLoadHttpError: (controller, url, code, message) {
        _log.error('WebView HTTP error $code: $message');
      },
    );
  }

  Future<void> _injectBridge(InAppWebViewController controller) async {
    await controller.evaluateJavascript(source: '''
if (!window.flutter_postMessage) {
  window.flutter_postMessage = function(message) {
    return window.flutter_inappwebview.callHandler('flutterBridge', message);
  };
  console.log('Flutter bridge injected');
}
''');
  }

  void _handleNewDoc() async {
    try {
      final path = await _fileService.createNote('Untitled');
      final content = await _fileService.readNote(path);
      if (_bridgeService != null) {
        // Extract title from path
        final name = path.split(RegExp(r'[/\\]')).last.replaceAll(RegExp(r'\.md$'), '');
        await _bridgeService!.sendOpenFile(path, content, title: name);
      }
    } catch (e) {
      _log.error('Failed to create new doc', e);
    }
  }

  Future<void> _handleOpenFile() async {
    // Use Flutter's file picker to let user pick a file from anywhere
    try {
      final result = await _fileService.pickMarkdownFile();
      if (result == null) return;
      // Create a new note in our notes dir and import content
      final path = await _fileService.createNote(result['title']!);
      await _fileService.writeNote(path, result['content']!);
      _log.info('Imported file: ${result['title']}');
      if (_bridgeService != null) {
        await _bridgeService!.sendOpenFile(path, result['content']!, title: result['title']);
      }
    } catch (e) {
      _log.error('Failed to import file', e);
    }
  }

  Future<void> _handleSaveFile() async {
    if (_bridgeService == null || _webViewController == null) return;
    // Ask web editor for the current state
    try {
      final result = await _webViewController!.evaluateJavascript(source: '''
(() => {
  const state = window.__ZUSTAND_STORE__?.getState();
  if (!state?.activeDocId) return null;
  const doc = state.docs.find(d => d.id === state.activeDocId);
  return doc ? { id: doc.id, title: doc.title, content: doc.content, path: doc.path || null } : null;
})();
''');
      if (result is Map && result['path'] != null) {
        await _fileService.writeNote(result['path'] as String, result['content'] as String);
        _log.debug('Saved: ${result['path']}');
      } else {
        _log.warn('No path for active doc; cannot save to disk');
      }
    } catch (e) {
      _log.error('Save failed', e);
    }
  }

  void _handleFileChanged(String path) {
    _log.info('File opened in editor: $path');
  }

  void _handleFileDeleted(String path) {
    _log.info('File deleted: $path');
    if (_syncService?.isAvailable == true) {
      _syncService?.syncNow();
    }
  }

  void _handleFileRenamed(String oldPath, String newPath) {
    _log.info('File renamed: $oldPath → $newPath');
    if (_syncService?.isAvailable == true) {
      _syncService?.syncNow();
    }
  }

  void _handleFileSaved(String path, String content) {
    _log.debug('File saved: $path (${content.length} chars)');
    if (_syncService?.isAvailable == true) {
      _syncService?.syncNow();
    }
  }

  void _handleFileCreated(String path) {
    _log.info('File created: $path');
    if (_syncService?.isAvailable == true) {
      _syncService?.syncNow();
    }
  }

  /// Called when SyncService status changes (e.g. syncing → success/error).
  void _onSyncStatusChanged() {
    if (mounted) setState(() {});
  }

  /// Start/stop SyncService based on server config state.
  void _updateSyncState(ServerConfigService config) {
    if (config.hasServer && config.syncEnabled) {
      _syncService?.start();
    } else {
      _syncService?.stop();
    }
  }

  /// Build the sync status icon based on current SyncService state.
  Widget _buildSyncIcon() {
    final status = _syncService?.status ?? SyncStatus.offline;
    final serverUrl = context.read<ServerConfigService>().serverUrl ?? '';

    switch (status) {
      case SyncStatus.syncing:
        return Tooltip(
          message: 'Syncing… ($serverUrl)',
          child: SizedBox(
            width: 16,
            height: 16,
            child: CircularProgressIndicator(
              strokeWidth: 2,
              color: Colors.blue.shade400,
            ),
          ),
        );
      case SyncStatus.success:
        return Tooltip(
          message: 'Synced ($serverUrl)',
          child: Icon(Icons.cloud_done, size: 16, color: Colors.green.shade600),
        );
      case SyncStatus.error:
        return Tooltip(
          message: 'Sync error: ${_syncService?.errorMessage ?? "unknown"}',
          child: Icon(Icons.cloud_off, size: 16, color: Colors.red.shade400),
        );
      case SyncStatus.offline:
        return Tooltip(
          message: 'Sync offline',
          child: Icon(Icons.cloud_outlined, size: 16, color: Colors.grey.shade400),
        );
      case SyncStatus.idle:
        return Tooltip(
          message: 'Sync idle ($serverUrl)',
          child: Icon(Icons.cloud_queue, size: 16, color: Colors.grey.shade600),
        );
    }
  }

  void _handleIncomingFile() {
    if (IncomingFile.content != null && _bridgeService != null) {
      final content = IncomingFile.content!;
      final title = IncomingFile.title ?? 'document.md';
      _log.info('Opening file from intent: $title');
      // For intent files, create a new note and open it
      _fileService.createNote(title).then((path) async {
        await _fileService.writeNote(path, content);
        await _bridgeService!.sendOpenFile(path, content, title: title);
      });
      IncomingFile.content = null;
      IncomingFile.title = null;
    }
  }
}
