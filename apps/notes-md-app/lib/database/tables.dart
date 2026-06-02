import 'package:drift/drift.dart';

/// Notes table — the source of truth for note metadata + content.
///
/// We keep the full markdown body in this table (not just an FTS-mirror)
/// so callers can fetch a note's content with a single row read.
///
/// The file path is the primary key because it's globally unique on
/// disk and lets us upsert on rename/move events from the file watcher
/// without juggling surrogate ids.
class Notes extends Table {
  TextColumn get id => text()(); // the .md file path
  TextColumn get name => text()(); // filename without .md
  IntColumn get mtime => integer()(); // unix millis
  IntColumn get size => integer().withDefault(const Constant(0))();
  TextColumn get content => text().withDefault(const Constant(''))();
  TextColumn get tags => text().withDefault(const Constant(''))(); // comma-separated

  @override
  Set<Column> get primaryKey => {id};
}
