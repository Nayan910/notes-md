import 'package:flutter/material.dart';
import 'package:flutter_inappwebview/flutter_inappwebview.dart';
import 'package:provider/provider.dart';
import '../services/auth_service.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  InAppWebViewController? _webViewController;
  final String _webViewUrl = 'http://192.168.1.8:5173';
  bool _loading = true;

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthService>();
    final theme = Theme.of(context);

    return Scaffold(
      appBar: AppBar(
        title: const Text('notes.md'),
        centerTitle: true,
        actions: [
          if (auth.user != null)
            Padding(
              padding: const EdgeInsets.only(right: 8),
              child: Center(
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                  decoration: BoxDecoration(
                    color: theme.colorScheme.secondaryContainer,
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Text(
                    auth.user!['username'] ?? '',
                    style: TextStyle(
                      fontSize: 12,
                      color: theme.colorScheme.onSecondaryContainer,
                    ),
                  ),
                ),
              ),
            ),
          PopupMenuButton<String>(
            onSelected: (value) async {
              if (value == 'logout') {
                await auth.logout();
                if (context.mounted) {
                  Navigator.of(context).pushReplacementNamed('/login');
                }
              } else if (value == 'refresh') {
                _webViewController?.reload();
              }
            },
            itemBuilder: (context) => [
              const PopupMenuItem(value: 'refresh', child: Text('Refresh')),
              const PopupMenuItem(value: 'logout', child: Text('Sign Out')),
            ],
          ),
        ],
      ),
      body: Stack(
        children: [
          InAppWebView(
            initialUrlRequest: URLRequest(
              url: WebUri(_webViewUrl),
            ),
            initialSettings: InAppWebViewSettings(
              javaScriptEnabled: true,
              domStorageEnabled: true,
              useHybridComposition: true,
              allowFileAccessFromFileURLs: true,
              allowUniversalAccessFromFileURLs: true,
              allowFileAccess: true,
              supportMultipleWindows: true,
              javaScriptCanOpenWindowsAutomatically: true,
            ),
            onWebViewCreated: (controller) {
              _webViewController = controller;
            },
            onLoadStop: (controller, url) async {
              // Inject JWT token into the web editor
              final token = auth.token;
              if (token != null) {
                await controller.evaluateJavascript(source: '''
                  (function() {
                    var oldToken = localStorage.getItem('notesmd_token');
                    if (oldToken !== '$token') {
                      localStorage.setItem('notesmd_token', '$token');
                      if (oldToken) {
                        // Token changed, reload to pick up new session
                        window.location.reload();
                      }
                    }
                  })();
                ''');
              }
              if (_loading) {
                setState(() => _loading = false);
              }
            },
            onReceivedError: (controller, request, error) {
              debugPrint('WebView error: ${error.description}');
            },
          ),
          if (_loading)
            Positioned.fill(
              child: Container(
                color: theme.colorScheme.surface,
                child: Center(
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      CircularProgressIndicator(
                          color: theme.colorScheme.primary),
                      const SizedBox(height: 16),
                      Text('Loading editor...',
                          style: theme.textTheme.bodyMedium),
                    ],
                  ),
                ),
              ),
            ),
        ],
      ),
    );
  }
}
