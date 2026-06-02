import 'dart:async';

import 'package:path/path.dart' as p;
import 'package:watcher/watcher.dart';

import 'app_logger.dart';
import 'file_service.dart';
import 'note_service.dart';

/// Watches the on-disk notes directory and forwards `.md` file events
/// to the [NoteService] index.
///
/// The native [DirectoryWatcher] tends to fire 2-3 events per save (the
/// editor writes a temp file, fsyncs, then renames into place). To
/// avoid re-indexing the same file three times in a row we debounce
/// events per-path with a short window.
class FileWatcherService {
  static const _debounce = Duration(milliseconds: 500);

  final FileService _fileService;
  final NoteService _noteService;
  final void Function(String path)? onExternalChange;

  DirectoryWatcher? _watcher;
  StreamSubscription<WatchEvent>? _sub;
  final Map<String, Timer> _pending = {};

  FileWatcherService({
    required FileService fileService,
    required NoteService noteService,
    this.onExternalChange,
  })  : _fileService = fileService,
        _noteService = noteService;

  /// Start watching. No-op if the directory doesn't exist (a future
  /// [start] call after the directory is created will succeed).
  Future<void> start() async {
    final dir = await _fileService.getNotesDirectory();
    if (!await dir.exists()) {
      AppLogger.w('Watcher', 'Notes dir missing, skipping watch start');
      return;
    }

    _watcher = DirectoryWatcher(dir.path);
    _sub = _watcher!.events.listen(_onRawEvent, onError: (Object e) {
      AppLogger.w('Watcher', 'Watcher stream error: $e');
    });
    AppLogger.i('Watcher', 'Watching ${dir.path}');
  }

  Future<void> stop() async {
    await _sub?.cancel();
    _sub = null;
    _watcher = null;
    for (final t in _pending.values) {
      t.cancel();
    }
    _pending.clear();
    AppLogger.i('Watcher', 'Stopped');
  }

  void _onRawEvent(WatchEvent event) {
    if (!event.path.toLowerCase().endsWith('.md')) return;

    // Coalesce burst events (rename/atomic-write) on the same path.
    _pending[event.path]?.cancel();
    _pending[event.path] = Timer(_debounce, () {
      _pending.remove(event.path);
      _handle(event);
    });
  }

  Future<void> _handle(WatchEvent event) async {
    final path = event.path;
    AppLogger.d('Watcher', '${event.type}: $path');
    try {
      switch (event.type) {
        case ChangeType.ADD:
          await _noteService.onFileCreated(path);
          onExternalChange?.call(path);
          break;
        case ChangeType.MODIFY:
          await _noteService.onFileChanged(path);
          onExternalChange?.call(path);
          break;
        case ChangeType.REMOVE:
          await _noteService.onFileDeleted(path);
          onExternalChange?.call(path);
          break;
      }
    } catch (e) {
      AppLogger.w('Watcher', 'Failed to handle ${event.type} for $path: $e');
    }
  }

  /// Diagnostic — true if the watcher is currently active.
  bool get isRunning => _watcher != null;

  /// The notes directory currently being watched (or null if not started).
  Future<String?> get watchedPath async {
    if (_watcher == null) return null;
    return p.dirname(_watcher!.path);
  }
}
