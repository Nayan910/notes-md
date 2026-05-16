import 'dart:io';
import 'package:file_picker/file_picker.dart';
import 'package:path_provider/path_provider.dart';

class FileService {
  /// Pick and read a .md file, returns (filename, content) or null
  Future<Map<String, String>?> pickMarkdownFile() async {
    final result = await FilePicker.platform.pickFiles(
      type: FileType.custom,
      allowedExtensions: ['md', 'markdown', 'txt'],
    );

    if (result == null || result.files.isEmpty) return null;

    final file = result.files.first;
    if (file.path == null) return null;

    try {
      final content = await File(file.path!).readAsString();
      final name = file.name.replaceAll(RegExp(r'\.(md|markdown|txt)$'), '');
      return {'title': name, 'content': content};
    } catch (e) {
      return null;
    }
  }

  /// Save content to a .md file via save dialog
  Future<bool> saveMarkdownFile(String content, String suggestedName) async {
    final outputFile = await FilePicker.platform.saveFile(
      type: FileType.custom,
      allowedExtensions: ['md'],
      fileName: '$suggestedName.md',
    );

    if (outputFile == null) return false;

    try {
      await File(outputFile).writeAsString(content);
      return true;
    } catch (e) {
      return false;
    }
  }

  /// Get the app's documents directory path
  Future<String> getDocumentsPath() async {
    final dir = await getApplicationDocumentsDirectory();
    return dir.path;
  }

  /// List .md files in the app documents directory
  Future<List<File>> listLocalMarkdownFiles() async {
    final dir = await getApplicationDocumentsDirectory();
    final files = <File>[];
    try {
      await for (final entity in dir.list()) {
        if (entity is File && entity.path.endsWith('.md')) {
          files.add(entity);
        }
      }
    } catch (_) {}
    return files;
  }
}
