/// Quick performance benchmark for the FTS5 search index, written
/// in plain Dart (no Flutter) so it can be run from `dart run` even
/// when the host doesn't have a Flutter SDK on `PATH`.
///
/// We replicate the exact schema from
/// `apps/notes-md-app/lib/database/database.dart` and feed it 1000
/// synthetic notes, then run several queries and report latency.

import 'dart:io';
import 'dart:math';
import 'package:sqlite3/sqlite3.dart' as sqlite3;
import 'package:path/path.dart' as p;

Future<void> main() async {
  final tempDir = await Directory.systemTemp.createTemp('notesmd-bench-');
  final notesDir = Directory(p.join(tempDir.path, 'notes'));
  await notesDir.create(recursive: true);

  print('Generating 1000 synthetic notes in ${notesDir.path}…');
  final rng = Random(42);
  final words = [
    'flutter', 'dart', 'markdown', 'search', 'index', 'database', 'sqlite',
    'drift', 'tutorial', 'guide', 'project', 'notes', 'meeting', 'design',
    'implementation', 'feature', 'release', 'beta', 'alpha', 'production',
    'testing', 'debug', 'crash', 'fix', 'todo', 'done', 'backlog', 'priority',
  ];

  for (var i = 0; i < 1000; i++) {
    final title = 'Note ${i.toString().padLeft(4, '0')}';
    final content = StringBuffer('# $title\n\n');
    final nWords = 50 + rng.nextInt(200);
    for (var w = 0; w < nWords; w++) {
      content.write(words[rng.nextInt(words.length)]);
      content.write(' ');
    }
    final file = File(p.join(notesDir.path, '$title.md'));
    await file.writeAsString(content.toString());
  }

  final dbFile = File(p.join(tempDir.path, '.notes-md', 'notes.db'));
  await dbFile.parent.create(recursive: true);

  final db = sqlite3.sqlite3.open(dbFile.path);

  // Mirror the schema from database.dart so the numbers translate
  // directly to the production app.
  db.execute('''
    CREATE TABLE notes (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      mtime INTEGER NOT NULL,
      size INTEGER NOT NULL DEFAULT 0,
      content TEXT NOT NULL DEFAULT '',
      tags TEXT NOT NULL DEFAULT ''
    )
  ''');
  db.execute('''
    CREATE VIRTUAL TABLE notes_fts USING fts5(
      path UNINDEXED,
      name,
      content,
      tokenize = 'porter unicode61'
    )
  ''');
  db.execute('''
    CREATE TRIGGER notes_ai AFTER INSERT ON notes BEGIN
      INSERT INTO notes_fts(rowid, path, name, content)
      VALUES (new.rowid, new.id, new.name, new.content);
    END
  ''');
  db.execute('''
    CREATE TRIGGER notes_ad AFTER DELETE ON notes BEGIN
      INSERT INTO notes_fts(notes_fts, rowid, path, name, content)
      VALUES('delete', old.rowid, old.id, old.name, old.content);
    END
  ''');
  db.execute('''
    CREATE TRIGGER notes_au AFTER UPDATE ON notes BEGIN
      INSERT INTO notes_fts(notes_fts, rowid, path, name, content)
      VALUES('delete', old.rowid, old.id, old.name, old.content);
      INSERT INTO notes_fts(rowid, path, name, content)
      VALUES (new.rowid, new.id, new.name, new.content);
    END
  ''');

  // Index every file.
  final files = notesDir
      .listSync()
      .whereType<File>()
      .where((f) => f.path.endsWith('.md'))
      .toList();

  final stmt = db.prepare(
    'INSERT INTO notes (id, name, mtime, size, content) VALUES (?, ?, ?, ?, ?)',
  );

  final start = DateTime.now();
  db.execute('BEGIN');
  for (final file in files) {
    final stat = file.statSync();
    final content = file.readAsStringSync();
    stmt.execute([
      file.path,
      p.basenameWithoutExtension(file.path),
      stat.modified.millisecondsSinceEpoch,
      stat.size,
      content,
    ]);
  }
  db.execute('COMMIT');
  stmt.dispose();
  final indexMs = DateTime.now().difference(start).inMilliseconds;
  print('Indexed ${files.length} files in ${indexMs}ms '
      '(${(indexMs / files.length).toStringAsFixed(2)}ms/note)');

  // Warm up.
  db.select('SELECT count(*) AS n FROM notes_fts WHERE notes_fts MATCH ?',
      ['flutter']);
  db.select('SELECT count(*) AS n FROM notes_fts WHERE notes_fts MATCH ?',
      ['markdown tutorial']);

  String sanitize(String raw) {
    var cleaned = raw.replaceAll(RegExp(r'[^\w\s]+'), ' ');
    cleaned = cleaned.replaceAll(RegExp(r'\s+'), ' ').trim();
    if (cleaned.isEmpty) return '';
    final words = cleaned.split(' ');
    words[words.length - 1] = '${words.last}*';
    return words.join(' ');
  }

  final queries = [
    'flutter',
    'markdown tutorial',
    'database index',
    'crash',
    'priority',
    'sqlite',
    'release',
  ];
  print('\nQuery latency (avg of 5 runs after warmup):');
  for (final q in queries) {
    final samples = <int>[];
    final stmt = db.prepare('''
      SELECT n.id AS path,
             n.name AS name,
             snippet(notes_fts, 2, '<<', '>>', '...', 12) AS snippet,
             bm25(notes_fts) AS score
        FROM notes_fts
        JOIN notes n ON n.rowid = notes_fts.rowid
       WHERE notes_fts MATCH ?
       ORDER BY score
       LIMIT 20
    ''');
    final munged = sanitize(q);
    int lastHits = 0;
    String topName = '—';
    for (var r = 0; r < 5; r++) {
      final t = DateTime.now();
      final rows = stmt.select([munged]);
      samples.add(DateTime.now().difference(t).inMicroseconds ~/ 1000);
      if (r == 0) {
        lastHits = rows.length;
        if (rows.isNotEmpty) {
          topName = rows.first['name'] as String;
        }
      }
    }
    stmt.dispose();
    samples.sort();
    final median = samples[samples.length ~/ 2];
    final max = samples.last;
    print('  "$q" → $lastHits hits, top: $topName | '
        'median ${median}ms · max ${max}ms');
  }

  db.dispose();
  await tempDir.delete(recursive: true);
  print('\nDone.');
}
