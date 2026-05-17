import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:flutter_inappwebview/flutter_inappwebview.dart';

/// Handles JavaScript bridge communication between Flutter and the notes.md web editor
class BridgeService {
  final InAppWebViewController _controller;
  final VoidCallback _onReady;
  final void Function(String id, String content, String title) _onSaveFileContent;
  final void Function(String id, String title) _onFileChanged;
  final VoidCallback _onPickFile;

  BridgeService({
    required InAppWebViewController controller,
    required VoidCallback onReady,
    required void Function(String id, String content, String title) onSaveFileContent,
    required void Function(String id, String title) onFileChanged,
    required VoidCallback onPickFile,
  })  : _controller = controller,
        _onReady = onReady,
        _onSaveFileContent = onSaveFileContent,
        _onFileChanged = onFileChanged,
        _onPickFile = onPickFile;

  /// Process a message from the web editor JavaScript
  void handleMessage(String message) {
    try {
      final msg = jsonDecode(message) as Map<String, dynamic>;
      final type = msg['type'] as String?;
      final payload = msg['payload'] as Map<String, dynamic>?;

      switch (type) {
        case 'ready':
          _onReady();
          break;
        case 'save-file-content':
          if (payload != null) {
            _onSaveFileContent(
              payload['id'] as String? ?? '',
              payload['content'] as String? ?? '',
              payload['title'] as String? ?? '',
            );
          }
          break;
        case 'file-changed':
          if (payload != null) {
            _onFileChanged(
              payload['id'] as String? ?? '',
              payload['title'] as String? ?? '',
            );
          }
          break;
        case 'pick-file':
          _onPickFile();
          break;
      }
    } catch (_) {
      // Invalid JSON, ignore
    }
  }

  /// Send an open-file message to the web editor
  Future<void> sendOpenFile(String content, {String? title}) async {
    final message = jsonEncode({
      'type': 'open-file',
      'payload': {
        'content': content,
        'title': title ?? 'Imported',
      },
    });
    // Evaluate JavaScript in WebView to dispatch the message
    await _controller.evaluateJavascript(
      source: '''
window.dispatchEvent(new MessageEvent('message', {
  data: $message,
  origin: window.location.origin
}));
''',
    );
  }

  /// Send a save-file request to the web editor
  Future<void> sendSaveFile(String docId) async {
    final message = jsonEncode({
      'type': 'save-file',
      'payload': {'id': docId},
    });
    await _controller.evaluateJavascript(
      source: '''
window.dispatchEvent(new MessageEvent('message', {
  data: $message,
  origin: window.location.origin
}));
''',
    );
  }

  /// Send a theme change to the web editor
  Future<void> sendSetTheme(String theme) async {
    final message = jsonEncode({
      'type': 'set-theme',
      'payload': {'theme': theme},
    });
    await _controller.evaluateJavascript(
      source: '''
window.dispatchEvent(new MessageEvent('message', {
  data: $message,
  origin: window.location.origin
}));
''',
    );
  }

  /// Send font size change to the web editor
  Future<void> sendSetFontSize(int size) async {
    final message = jsonEncode({
      'type': 'set-font-size',
      'payload': {'size': size},
    });
    await _controller.evaluateJavascript(
      source: '''
window.dispatchEvent(new MessageEvent('message', {
  data: $message,
  origin: window.location.origin
}));
''',
    );
  }
}
