import 'dart:io';
import 'package:file_picker/file_picker.dart';
import 'package:path/path.dart' as p;
import 'package:path_provider/path_provider.dart';

/// Represents a note file on disk.
class NoteFile {
  final String path;
  final String name;
  final int size;
  final DateTime modified;

  const NoteFile({
    required this.path,
    required this.name,
    required this.size,
    required this.modified,
  });

  factory NoteFile.fromFile(File file) {
    final stat = file.statSync();
    return NoteFile(
      path: file.path,
      name: p.basenameWithoutExtension(file.path),
      size: stat.size,
      modified: stat.modified,
    );
  }

  Map<String, dynamic> toJson() => {
        'path': path,
        'name': name,
        'size': size,
        'modified': modified.millisecondsSinceEpoch,
      };

  factory NoteFile.fromJson(Map<String, dynamic> json) => NoteFile(
        path: json['path'] as String,
        name: json['name'] as String,
        size: json['size'] as int,
        modified: DateTime.fromMillisecondsSinceEpoch(json['modified'] as int),
      );
}

/// Filesystem service for note storage.
///
/// Notes are stored as plain .md files in the app's documents directory
/// under a `notes-md/` subfolder. This makes them:
/// - Accessible to the user (open in VS Code, Obsidian, etc.)
/// - Backed up by the OS (Windows Documents backup, Android Auto Backup)
/// - Easy to sync via cloud storage (Dropbox, Google Drive, etc.)
class FileService {
  static const _notesDirName = 'notes-md';

  /// Get the canonical notes directory: `~/Documents/notes-md/` (Win/Linux)
  /// or `/data/data/com.notesmd.app/app_flutter/notes-md/` (Android).
  Future<Directory> getNotesDirectory() async {
    final docsDir = await getApplicationDocumentsDirectory();
    final notesDir = Directory(p.join(docsDir.path, _notesDirName));

    if (!await notesDir.exists()) {
      await notesDir.create(recursive: true);
    }

    return notesDir;
  }

  /// List all .md files in the notes directory, sorted by modified (newest first).
  Future<List<NoteFile>> listNotes() async {
    final dir = await getNotesDirectory();
    final files = <NoteFile>[];

    try {
      await for (final entity in dir.list()) {
        if (entity is File && entity.path.toLowerCase().endsWith('.md')) {
          files.add(NoteFile.fromFile(entity));
        }
      }
    } catch (e) {
      // Directory might not exist yet — that's OK
    }

    files.sort((a, b) => b.modified.compareTo(a.modified));
    return files;
  }

  /// Read the content of a note file.
  /// Throws [FileSystemException] if the file doesn't exist.
  Future<String> readNote(String path) async {
    final file = File(path);
    if (!await file.exists()) {
      throw FileSystemException('File not found', path);
    }
    return file.readAsString();
  }

  /// Write content to a note file using atomic write (temp + rename).
  /// This prevents data loss if the write is interrupted.
  Future<void> writeNote(String path, String content) async {
    final tempFile = File('$path.tmp');

    try {
      await tempFile.writeAsString(content, flush: true);
      await tempFile.rename(path);
    } catch (e) {
      // Clean up temp file on failure
      if (await tempFile.exists()) {
        try {
          await tempFile.delete();
        } catch (_) {}
      }
      rethrow;
    }
  }

  /// Delete a note file. No-op if file doesn't exist.
  Future<void> deleteNote(String path) async {
    final file = File(path);
    if (await file.exists()) {
      await file.delete();
    }
  }

  /// Rename a note file. Sanitizes the new name and ensures .md extension.
  /// If a file with the new name exists, appends " (1)", " (2)", etc.
  /// Returns the new path.
  Future<String> renameNote(String oldPath, String newName) async {
    final oldFile = File(oldPath);
    if (!await oldFile.exists()) {
      throw FileSystemException('File not found', oldPath);
    }

    final sanitized = newName.replaceAll(RegExp(r'[\\/:*?"<>|]'), '_').trim();
    if (sanitized.isEmpty) {
      throw ArgumentError('New name cannot be empty');
    }
    final baseName = sanitized.replaceAll(RegExp(r'\.md$'), '');
    final dir = oldFile.parent;

    // Find a unique filename
    var counter = 0;
    String target;
    do {
      final suffix = counter == 0 ? '' : ' ($counter)';
      target = p.join(dir.path, '$baseName$suffix.md');
      counter++;
    } while (await File(target).exists() && target != oldPath);

    await oldFile.rename(target);
    return target;
  }

  /// Create a new empty note with the given name.
  /// If a note with that name exists, appends " (1)", " (2)", etc.
  /// Returns the path of the created file.
  Future<String> createNote(String name) async {
    final dir = await getNotesDirectory();
    final sanitized = name.replaceAll(RegExp(r'[\\/:*?"<>|]'), '_').trim();
    final baseName = sanitized.isEmpty ? 'Untitled' : sanitized;

    var counter = 0;
    String target;
    do {
      final suffix = counter == 0 ? '' : ' ($counter)';
      target = p.join(dir.path, '$baseName$suffix.md');
      counter++;
    } while (await File(target).exists());

    final file = File(target);
    await file.writeAsString('# $baseName\n\n');
    return target;
  }

  /// Pick a .md file from anywhere on disk via the OS file picker.
  /// Used for the "Import" flow — copies the picked file into the notes directory.
  /// Returns {title, content} or null if cancelled.
  Future<Map<String, String>?> pickMarkdownFile() async {
    try {
      final result = await FilePicker.platform.pickFiles(
        type: FileType.custom,
        allowedExtensions: ['md', 'markdown', 'txt'],
      );
      if (result == null || result.files.isEmpty) return null;
      final file = result.files.first;
      if (file.path == null) return null;
      final content = await File(file.path!).readAsString();
      final name = file.name.replaceAll(RegExp(r'\.(md|markdown|txt)$'), '');
      return {'title': name, 'content': content};
    } catch (e) {
      return null;
    }
  }
}
