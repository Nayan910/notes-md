import 'dart:async';
import 'dart:io';

import 'package:path/path.dart' as p;

import '../database/database.dart';
import 'app_logger.dart';
import 'file_service.dart';

/// Reason a file-watcher / external event is reported.
enum FileChangeKind { created, modified, removed, renamed }

/// Coalesced file-watch event handed to listeners.
class NoteChangeEvent {
  final String path;
  final FileChangeKind kind;
  /// The previous path, populated for [FileChangeKind.renamed].
  final String? oldPath;

  const NoteChangeEvent({
    required this.path,
    required this.kind,
    this.oldPath,
  });
}

/// App-wide facade for the Drift FTS5 index.
///
/// Wraps the on-disk [FileService] (the source of truth for note files)
/// with an [AppDatabase] (the FTS5 search index) and exposes a single
/// stream of change events so the rest of the app doesn't have to
/// subscribe to the file watcher directly.
class NoteService {
  final FileService _fileService;
  final AppDatabase _db;

  final StreamController<NoteChangeEvent> _changes =
      StreamController<NoteChangeEvent>.broadcast();

  /// Emits whenever a note file changes on disk (create / modify / delete).
  Stream<NoteChangeEvent> get changes => _changes.stream;

  NoteService({
    required FileService fileService,
    required AppDatabase database,
  })  : _fileService = fileService,
        _db = database;

  /// Initial scan: every file in the notes directory is upserted into
  /// the FTS5 index. Safe to call repeatedly — it only touches the
  /// database, never the files themselves.
  Future<int> indexAllFiles() async {
    final notes = await _fileService.listNotes();
    AppLogger.i('Notes', 'Indexing ${notes.length} files…');
    for (final note in notes) {
      await onFileChanged(note.path);
    }
    AppLogger.i('Notes', 'Indexed ${notes.length} files');
    return notes.length;
  }

  /// Drop any rows whose file no longer exists on disk.
  Future<int> pruneMissing() async {
    final notes = await _db.getAllNotes();
    int removed = 0;
    for (final note in notes) {
      if (!await File(note.id).exists()) {
        await _db.deleteNoteByPath(note.id);
        removed++;
      }
    }
    if (removed > 0) {
      AppLogger.i('Notes', 'Pruned $removed missing file(s) from index');
    }
    return removed;
  }

  /// FTS5 search. Returns hits with highlighted snippets and a
  /// relevance score. Empty / blank queries return an empty list.
  Future<List<SearchHit>> search(String query, {int limit = 20}) {
    return _db.searchNotes(query, limit: limit);
  }

  /// Cheap SQLite metadata lookup. Returns `null` if the path isn't
  /// indexed.
  Future<Note?> getFileInfo(String path) => _db.getNoteByPath(path);

  // ---------------------------------------------------------------------------
  // File-event entry points (called by the watcher AND by the bridge when
  // a file is created/modified/deleted via the web editor).
  // ---------------------------------------------------------------------------

  /// Index (or re-index) a file. Reads content + stat and upserts.
  Future<void> onFileChanged(String path) async {
    try {
      final file = File(path);
      if (!await file.exists()) {
        await onFileDeleted(path);
        return;
      }
      final stat = await file.stat();
      final content = await file.readAsString();
      await _db.upsertNote(
        path: path,
        name: p.basenameWithoutExtension(path),
        mtime: stat.modified.millisecondsSinceEpoch,
        size: stat.size,
        content: content,
      );
      _changes.add(NoteChangeEvent(path: path, kind: FileChangeKind.modified));
    } catch (e) {
      AppLogger.w('Notes', 'onFileChanged($path) failed: $e');
    }
  }

  Future<void> onFileCreated(String path) async {
    await onFileChanged(path);
    _changes.add(NoteChangeEvent(path: path, kind: FileChangeKind.created));
  }

  Future<void> onFileDeleted(String path) async {
    await _db.deleteNoteByPath(path);
    _changes.add(NoteChangeEvent(path: path, kind: FileChangeKind.removed));
  }

  Future<void> onFileRenamed(String oldPath, String newPath) async {
    await _db.deleteNoteByPath(oldPath);
    await onFileChanged(newPath);
    _changes.add(
      NoteChangeEvent(
        path: newPath,
        kind: FileChangeKind.renamed,
        oldPath: oldPath,
      ),
    );
  }

  /// Tear down resources. The Drift DB is owned by the caller; we just
  /// close the broadcast stream.
  Future<void> dispose() async {
    await _changes.close();
  }
}
