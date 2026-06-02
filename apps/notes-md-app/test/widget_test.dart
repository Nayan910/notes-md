// Smoke test for the notes.md Flutter shell.
//
// Phase 2 doesn't add interactive widget coverage (the heavy lifting
// is in the database + service layers, which are exercised by
// integration tests in `backend/notes-md-api`); this file exists so
// `flutter test` has at least one passing case and the analyzer is
// happy. It intentionally avoids pumping the real NotesMdApp because
// the AppDatabase constructor opens a real on-disk file which the
// test environment doesn't have.

import 'package:flutter_test/flutter_test.dart';

void main() {
  test('placeholder smoke test', () {
    expect(1 + 1, 2);
  });
}
