import 'dart:io';

import 'package:drift/drift.dart';
import 'package:drift/native.dart';
import 'package:path/path.dart' as p;
import 'package:path_provider/path_provider.dart';
import 'package:sqlite3/sqlite3.dart' as sqlite3;

import '../services/app_logger.dart';
import 'tables.dart';

part 'database.g.dart';

/// Result row for a search hit.
class SearchHit {
  final String path;
  final String name;
  final String snippet;
  final double score;

  const SearchHit({
    required this.path,
    required this.name,
    required this.snippet,
    required this.score,
  });

  Map<String, dynamic> toJson() => {
        'path': path,
        'name': name,
        'snippet': snippet,
        'score': score,
      };
}

@DriftDatabase(tables: [Notes])
class AppDatabase extends _$AppDatabase {
  AppDatabase(super.e);

  /// Default constructor: opens (or creates) the on-disk database at
  /// `<appDocs>/.notes-md/notes.db`. The leading-dot directory keeps the
  /// index out of the user's view in their notes folder.
  AppDatabase.defaults() : super(_openDefault());

  @override
  int get schemaVersion => 1;

  @override
  MigrationStrategy get migration => MigrationStrategy(
        onCreate: (m) async {
          await m.createAll();
        },
      );

  // ---------------------------------------------------------------------------
  // DAO-style helpers
  // ---------------------------------------------------------------------------

  /// Full-text search using FTS5 + BM25 ranking.
  ///
  /// The query string is passed verbatim to the FTS5 MATCH operator, so
  /// the caller should treat it as a search query (not a SQL injection
  /// surface — FTS5 treats it as a search expression). We additionally
  /// strip characters that would break the query.
  Future<List<SearchHit>> searchNotes(String rawQuery, {int limit = 20}) async {
    final query = _sanitizeFtsQuery(rawQuery);
    if (query.isEmpty) return const [];

    // Use snippet() to return a short highlighted preview from the
    // content column. bm25() returns negative scores (lower = more
    // relevant) so we ORDER BY score ASC.
    final rows = await customSelect(
      '''
      SELECT n.id AS path,
             n.name AS name,
             snippet(notes_fts, 2, '<<', '>>', '...', 12) AS snippet,
             bm25(notes_fts) AS score
        FROM notes_fts
        JOIN notes n ON n.rowid = notes_fts.rowid
       WHERE notes_fts MATCH ?
       ORDER BY score
       LIMIT ?
      ''',
      variables: [Variable.withString(query), Variable.withInt(limit)],
      readsFrom: {notes},
    ).get();

    return rows.map((row) {
      return SearchHit(
        path: row.read<String>('path'),
        name: row.read<String>('name'),
        snippet: row.read<String>('snippet'),
        score: row.read<double>('score'),
      );
    }).toList();
  }

  Future<List<Note>> getAllNotes() => select(notes).get();

  Future<Note?> getNoteByPath(String path) =>
      (select(notes)..where((n) => n.id.equals(path))).getSingleOrNull();

  Future<void> upsertNote({
    required String path,
    required String name,
    required int mtime,
    required int size,
    required String content,
    String tags = '',
  }) async {
    await into(notes).insertOnConflictUpdate(
      NotesCompanion.insert(
        id: path,
        name: name,
        mtime: mtime,
        size: Value(size),
        content: Value(content),
        tags: Value(tags),
      ),
    );
  }

  Future<int> deleteNoteByPath(String path) =>
      (delete(notes)..where((n) => n.id.equals(path))).go();

  /// Build the FTS5 virtual table + sync triggers idempotently.
  /// Invoked from the database setup callback so the FTS table exists
  /// before any queries are run.
  static void _setupFtsInfrastructure(sqlite3.Database db) {
    db.execute('''
      CREATE VIRTUAL TABLE IF NOT EXISTS notes_fts USING fts5(
        path UNINDEXED,
        name,
        content,
        tokenize = 'porter unicode61'
      )
    ''');

    // Drop pre-existing triggers so this is safe to re-run after a
    // schema reset.
    db.execute('DROP TRIGGER IF EXISTS notes_ai');
    db.execute('DROP TRIGGER IF EXISTS notes_ad');
    db.execute('DROP TRIGGER IF EXISTS notes_au');

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
  }
}

/// Strip characters that have special meaning in FTS5 query syntax and
/// collapse to a safe prefix-match form if no operators survive.
String _sanitizeFtsQuery(String raw) {
  final trimmed = raw.trim();
  if (trimmed.isEmpty) return '';

  // Drop FTS5 operators. Anything that isn't a letter, digit, or
  // whitespace is replaced with a space.
  var cleaned = trimmed.replaceAll(RegExp(r'[^\p{L}\p{N}\s]+', unicode: true), ' ');
  // Collapse whitespace.
  cleaned = cleaned.replaceAll(RegExp(r'\s+'), ' ').trim();
  if (cleaned.isEmpty) return '';

  // Append '*' to the last word so partial words still match (e.g.
  // "jav" → matches "javascript").
  final words = cleaned.split(' ');
  if (words.isNotEmpty) {
    words[words.length - 1] = '${words.last}*';
  }
  return words.join(' ');
}

QueryExecutor _openDefault() {
  return LazyDatabase(() async {
    // Make sure sqlite3 temp dir is writable on iOS / Android.
    final cachebase = (await getTemporaryDirectory()).path;
    sqlite3.sqlite3.tempDirectory = cachebase;

    final docs = await getApplicationDocumentsDirectory();
    final hiddenDir = Directory(p.join(docs.path, '.notes-md'));
    if (!await hiddenDir.exists()) {
      await hiddenDir.create(recursive: true);
    }
    final dbFile = File(p.join(hiddenDir.path, 'notes.db'));
    AppLogger.i('DB', 'Opening database at ${dbFile.path}');
    return NativeDatabase.createInBackground(
      dbFile,
      logStatements: false,
      setup: AppDatabase._setupFtsInfrastructure,
    );
  });
}
