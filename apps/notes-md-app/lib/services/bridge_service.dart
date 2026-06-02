import 'dart:async';
import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:flutter_inappwebview/flutter_inappwebview.dart';
import '../database/database.dart';
import 'file_service.dart';
import 'app_logger.dart';
import 'note_service.dart';

/// Result wrapper for bridge commands.
class BridgeResult {
  final bool success;
  final dynamic data;
  final String? error;

  const BridgeResult.success(this.data) : success = true, error = null;
  const BridgeResult.error(this.error) : success = false, data = null;

  Map<String, dynamic> toJson() => {
        'success': success,
        if (data != null) 'data': data,
        if (error != null) 'error': error,
      };

  String toJsonString() => jsonEncode(toJson());
}

/// Handles JavaScript bridge communication between Flutter and the notes.md web editor.
///
/// Web → Flutter commands:
/// - list-notes       → returns [{path, name, size, modified}, ...]
/// - read-note        → returns {content}
/// - write-note       → writes {content} to {path}, returns success
/// - delete-note      → deletes {path}, returns success
/// - rename-note      → renames {oldPath} to {newName}, returns {newPath}
/// - create-note      → creates new note with {name}, returns {path}
/// - search-notes     → FTS5 search {query}, returns [{path, name, snippet, score}]
/// - file-changed     → notifies Flutter that web editor changed a file
/// - file-deleted     → notifies Flutter that web editor deleted a file
/// - ready            → web editor is ready
///
/// Flutter → Web events:
/// - notes-list-updated   → file list changed (external edit, new file, etc.)
/// - search-results       → streamed search results
/// - file-loaded          → load {path, content} in editor
/// - theme-set            → change theme
/// - font-size-set        → change font size
/// - file-changed-externally → file changed outside the editor
class BridgeService {
  final InAppWebViewController _controller;
  final FileService _fileService;
  final NoteService? _noteService;

  // Callbacks for web → flutter notifications
  final VoidCallback onReady;
  final void Function(String path) onFileChanged;
  final void Function(String path) onFileDeleted;
  final void Function(String oldPath, String newPath) onFileRenamed;
  final void Function(String path, String content) onFileSaved;
  final void Function(String path) onFileCreated;

  BridgeService({
    required InAppWebViewController controller,
    required FileService fileService,
    NoteService? noteService,
    required this.onReady,
    required this.onFileChanged,
    required this.onFileDeleted,
    required this.onFileRenamed,
    required this.onFileSaved,
    required this.onFileCreated,
  })  : _controller = controller,
        _fileService = fileService,
        _noteService = noteService;

  /* ------------------------------------------------------------------ *
   * Incoming messages from web editor
   * ------------------------------------------------------------------ */

  Future<BridgeResult> handleMessage(String message) async {
    Map<String, dynamic> msg;
    try {
      msg = jsonDecode(message) as Map<String, dynamic>;
    } catch (e) {
      AppLogger.w('Bridge', 'Invalid JSON from web: $e');
      return BridgeResult.error('Invalid JSON');
    }

    final type = msg['type'] as String?;
    final payload = msg['payload'] as Map<String, dynamic>?;
    final id = msg['id'] as String?; // optional request id for promise-based RPC

    AppLogger.d('Bridge', '← $type${id != null ? " [$id]" : ""}');

    try {
      switch (type) {
        case 'ready':
          onReady();
          return BridgeResult.success({'ready': true});

        case 'list-notes':
          final notes = await _fileService.listNotes();
          return BridgeResult.success(notes.map((n) => n.toJson()).toList());

        case 'read-note':
          if (payload == null) return BridgeResult.error('Missing payload');
          final path = payload['path'] as String?;
          if (path == null) return BridgeResult.error('Missing path');
          final content = await _fileService.readNote(path);
          return BridgeResult.success({'content': content, 'path': path});

        case 'write-note':
          if (payload == null) return BridgeResult.error('Missing payload');
          final path = payload['path'] as String?;
          final content = payload['content'] as String?;
          if (path == null) return BridgeResult.error('Missing path');
          if (content == null) return BridgeResult.error('Missing content');
          await _fileService.writeNote(path, content);
          // Re-index in the background so search reflects the new content.
          if (_noteService != null) {
            // ignore: discarded_futures
            _noteService.onFileChanged(path);
          }
          onFileSaved(path, content);
          return BridgeResult.success({'path': path});

        case 'delete-note':
          if (payload == null) return BridgeResult.error('Missing payload');
          final path = payload['path'] as String?;
          if (path == null) return BridgeResult.error('Missing path');
          await _fileService.deleteNote(path);
          if (_noteService != null) {
            await _noteService.onFileDeleted(path);
          }
          onFileDeleted(path);
          return BridgeResult.success({'path': path});

        case 'rename-note':
          if (payload == null) return BridgeResult.error('Missing payload');
          final oldPath = payload['oldPath'] as String?;
          final newName = payload['newName'] as String?;
          if (oldPath == null) return BridgeResult.error('Missing oldPath');
          if (newName == null) return BridgeResult.error('Missing newName');
          final newPath = await _fileService.renameNote(oldPath, newName);
          if (_noteService != null) {
            await _noteService.onFileRenamed(oldPath, newPath);
          }
          onFileRenamed(oldPath, newPath);
          return BridgeResult.success({'newPath': newPath});

        case 'create-note':
          if (payload == null) return BridgeResult.error('Missing payload');
          final name = payload['name'] as String? ?? 'Untitled';
          final path = await _fileService.createNote(name);
          if (_noteService != null) {
            await _noteService.onFileCreated(path);
          }
          onFileCreated(path);
          return BridgeResult.success({'path': path});

        case 'search-notes':
          if (payload == null) return BridgeResult.error('Missing payload');
          final query = (payload['query'] as String?) ?? '';
          final limit = (payload['limit'] as int?) ?? 20;
          if (_noteService == null) {
            return BridgeResult.error('Search not available: index not ready');
          }
          final hits = await _noteService.search(query, limit: limit);
          return BridgeResult.success(
            hits.map((h) => h.toJson()).toList(),
          );

        case 'file-changed':
          if (payload == null) return BridgeResult.error('Missing payload');
          final path = payload['path'] as String?;
          if (path == null) return BridgeResult.error('Missing path');
          onFileChanged(path);
          return BridgeResult.success({'acknowledged': true});

        default:
          return BridgeResult.error('Unknown message type: $type');
      }
    } catch (e, st) {
      AppLogger.e('Bridge', 'Error handling $type: $e\n$st');
      return BridgeResult.error(e.toString());
    }
  }

  /* ------------------------------------------------------------------ *
   * Outgoing events to web editor
   * ------------------------------------------------------------------ */

  Future<void> _send(String type, [Map<String, dynamic>? payload]) async {
    final message = jsonEncode({
      'type': type,
      if (payload != null) 'payload': payload,
    });
    try {
      await _controller.evaluateJavascript(
        source: '''
window.dispatchEvent(new MessageEvent('message', {
  data: $message,
  origin: window.location.origin
}));
''',
      );
      AppLogger.d('Bridge', '→ $type');
    } catch (e) {
      AppLogger.w('Bridge', 'Failed to send $type: $e');
    }
  }

  /// Tell web editor the notes list has changed (e.g., external file added).
  Future<void> sendNotesListUpdated(List<NoteFile> notes) async {
    await _send('notes-list-updated', {
      'notes': notes.map((n) => n.toJson()).toList(),
    });
  }

  /// Load a file into the web editor.
  Future<void> sendOpenFile(String path, String content, {String? title}) async {
    await _send('open-file', {
      'path': path,
      'content': content,
      'title': title,
    });
  }

  /// Ask the web editor to save the current file (it will then call write-note).
  Future<void> sendSaveFile(String path) async {
    await _send('save-file', {'path': path});
  }

  /// Notify web editor that a file changed externally (VS Code edit, etc.).
  /// It can choose to reload or show a prompt.
  Future<void> sendFileChangedExternally(String path) async {
    await _send('file-changed-externally', {'path': path});
  }

  /// Tell web editor to close a file (e.g., it was deleted on disk).
  Future<void> sendFileClosed(String path) async {
    await _send('file-closed', {'path': path});
  }

  /// Change the editor theme.
  Future<void> sendSetTheme(String theme) async {
    await _send('set-theme', {'theme': theme});
  }

  /// Change the editor font size.
  Future<void> sendSetFontSize(int size) async {
    await _send('set-font-size', {'size': size});
  }

  /// Push a fresh search result set to the web editor. The web side
  /// subscribes to `search-results` events to update the palette UI
  /// without each keystroke having to wait for a full round-trip.
  Future<void> sendSearchResults(String query, List<SearchHit> hits) async {
    await _send('search-results', {
      'query': query,
      'results': hits.map((h) => h.toJson()).toList(),
    });
  }
}
