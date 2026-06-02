# notes.md — Offline-First Implementation Plan

**Date:** 2026-06-01
**Spec:** [2026-06-01-offline-first-architecture.md](../specs/2026-06-01-offline-first-architecture.md)
**Status:** Approved, in execution

## Phase 0 — Critical Bug Fix: localStorage → IndexedDB

**Goal:** Stop data loss on large notes. Replace 5-10MB localStorage with GB-scale IndexedDB.

### Tasks

- [ ] **0.1** Add `idb` package to `apps/notes-md/package.json`
- [ ] **0.2** Create `apps/notes-md/src/utils/idb-storage.ts` (Promise-based wrapper)
- [ ] **0.3** Create `apps/notes-md/src/utils/storage-migration.ts` (one-time localStorage → IDB migration)
- [ ] **0.4** Update `apps/notes-md/src/hooks/useAutoSave.ts` to use IDB
- [ ] **0.5** Update Zustand store `persist` middleware to use IDB
- [ ] **0.6** Add unit tests: `apps/notes-md/src/utils/__tests__/idb-storage.test.ts`
- [ ] **0.7** Test in browser: create large note (>1MB), save, reload, verify persistence
- [ ] **0.8** Build web editor: `npm run build`
- [ ] **0.9** Copy `dist/` to `apps/notes-md-app/assets/notes-md/`
- [ ] **0.10** Rebuild APK + Windows
- [ ] **0.11** Commit + push to Codeberg + GitHub

**Acceptance:** Large note (>1MB) saves and reloads without error. localStorage is empty.

---

## Phase 1 — Filesystem as Source of Truth

**Goal:** All notes stored as plain .md files on disk. User can open them in any editor.

### 1A: Flutter side

- [ ] **1A.1** Verify `path_provider` is in `apps/notes-md-app/pubspec.yaml`
- [ ] **1A.2** Create `apps/notes-md-app/lib/services/file_service.dart`:
  - `getNotesDirectory()` → returns `~/Documents/notes-md/`
  - `listNotes()` → returns `List<NoteFile>` (path, name, mtime, size)
  - `readNote(path)` → returns String content
  - `writeNote(path, content)` → atomic write (temp + rename)
  - `deleteNote(path)` → removes file
  - `renameNote(oldPath, newPath)` → renames file
- [ ] **1A.3** Add `path` package for cross-platform path joining
- [ ] **1A.4** Ensure directory exists on first launch (`createSync(recursive: true)`)

### 1B: Bridge protocol

- [ ] **1B.1** Update `apps/notes-md-app/lib/services/bridge_service.dart`:
  - Handle `list-notes` → return JSON array
  - Handle `read-note` → return file content
  - Handle `write-note` → write to disk, return success
  - Handle `delete-note` → remove file, return success
  - Handle `rename-note` → rename file, return success
- [ ] **1B.2** Add new message types to `IncomingMessage` enum
- [ ] **1B.3** Add error responses with descriptive messages

### 1C: Web editor side

- [ ] **1C.1** Create `apps/notes-md/src/utils/bridge-file-storage.ts`:
  - `loadFileList()` → calls bridge, returns List<NoteFile>
  - `loadFile(path)` → calls bridge, returns content
  - `saveFile(path, content)` → calls bridge
  - `deleteFile(path)` → calls bridge
  - `renameFile(oldPath, newPath)` → calls bridge
- [ ] **1C.2** Update `apps/notes-md/src/store/notesStore.ts`:
  - On mount: `loadFileList()` from bridge
  - On file open: `loadFile(path)` from bridge
  - On save (debounced 2s): `saveFile(path, content)` via bridge
  - Fallback to IndexedDB if bridge unavailable
- [ ] **1C.3** Update `HomeScreen` to display file list from bridge
- [ ] **1C.4** Add "New Note" button → creates empty .md file
- [ ] **1C.5** Add "Delete Note" context menu
- [ ] **1C.6** Add "Rename Note" context menu
- [ ] **1C.7** Remove `file_picker` save flow (replaced by auto-save)

### 1D: Android .md file intent (already done in v0.1.0-alpha)

- [ ] **1D.1** Verify intent filter for `text/markdown` and `text/plain`
- [ ] **1D.2** Verify `MainActivity.kt` reads file and sends to Flutter
- [ ] **1D.3** Verify Flutter `IncomingFile` class handles the intent

### 1E: Build + test

- [ ] **1E.1** Test: create note, save, close app, reopen → note persists
- [ ] **1E.2** Test: open .md file in VS Code, edit, save → app detects (via watcher in Phase 2)
- [ ] **1E.3** Test: copy `notes-md/` folder to another machine → notes accessible
- [ ] **1E.4** Build APK + Windows
- [ ] **1E.5** Commit + push to Codeberg + GitHub

**Acceptance:** Notes persist as .md files in canonical location. User can open them externally.

---

## Phase 2 — Search + Index (Drift + FTS5)

**Goal:** Sub-100ms full-text search across all notes.

### 2A: Dependencies

- [ ] **2A.1** Add to `apps/notes-md-app/pubspec.yaml`:
  ```yaml
  drift: ^2.33.0
  drift_flutter: ^0.2.0
  sqlite3_flutter_libs: ^0.5.42
  watcher: ^1.2.0
  path: ^1.9.0
  ```
- [ ] **2A.2** Run `flutter pub get`
- [ ] **2A.3** Add `build_runner` to dev_dependencies
- [ ] **2A.4** Run `dart run build_runner build` to generate Drift code

### 2B: Database schema

- [ ] **2B.1** Create `apps/notes-md-app/lib/database/database.dart`:
  ```dart
  @DriftDatabase(tables: [Notes, NotesFts])
  class AppDatabase extends _$AppDatabase {
    // FTS5 virtual table
  }
  ```
- [ ] **2B.2** Create `apps/notes-md-app/lib/database/tables.dart`:
  - `Notes` table: id, path, title, mtime, size, content
  - `NotesFts` virtual table: title, content (FTS5)
- [ ] **2B.3** Add triggers to keep FTS in sync with Notes

### 2C: NoteService

- [ ] **2C.1** Create `apps/notes-md-app/lib/services/note_service.dart`:
  - `indexAllFiles()` → scans notes dir, inserts/updates SQLite
  - `search(query)` → FTS5 query, returns ranked results
  - `getFileInfo(path)` → returns metadata
- [ ] **2C.2** Run indexing on app start (background, non-blocking)
- [ ] **2C.3** Re-index on file change (via watcher)

### 2D: File watcher

- [ ] **2D.1** Create `apps/notes-md-app/lib/services/file_watcher_service.dart`:
  - Watch `notes-md/` directory
  - On change: emit event to NoteService
  - On external edit: notify WebView via bridge
- [ ] **2D.2** Bridge: `file-changed-externally` event
- [ ] **2D.3** Web editor: show "File changed externally, reload?" prompt

### 2E: Search UI

- [ ] **2E.1** Add search panel to web editor (Cmd+K)
- [ ] **2E.2** Debounced search (200ms)
- [ ] **2E.3** Display results with snippets (FTS5 `snippet()`)
- [ ] **2E.4** Click result → opens note at matching line
- [ ] **2E.5** Highlight matches in editor (CodeMirror 6 search addon)

### 2F: Build + test

- [ ] **2F.1** Test: index 1000 synthetic notes, search returns in <100ms
- [ ] **2F.2** Test: external edit detected, app prompts to reload
- [ ] **2F.3** Test: search "TODO" finds all notes with TODO
- [ ] **2F.4** Build APK + Windows
- [ ] **2F.5** Commit + push to Codeberg + GitHub

**Acceptance:** Search is fast. External edits detected. No data loss.

---

## Phase 3 — Optional Self-Hosted Sync (LWW)

**Goal:** Optional sync to self-hosted server. Off by default.

### 3A: Backend

- [ ] **3A.1** Add to `backend/notes-md-api/main.py`:
  - `POST /sync/upload` → multipart file + mtime
  - `GET /sync/list` → returns `[{path, mtime, hash}]`
  - `GET /sync/file/{path}` → returns file content + mtime
  - `POST /sync/diff` → client sends local mtimes, server returns deltas
- [ ] **3A.2** Store files in `sync_data/{user_id}/` with mtime as filename suffix
- [ ] **3A.3** LWW logic: compare mtime, keep newer
- [ ] **3A.4** Add hash (SHA256) for integrity check
- [ ] **3A.5** Tests: upload, download, conflict resolution

### 3B: Flutter SyncService

- [ ] **3B.1** Create `apps/notes-md-app/lib/services/sync_service.dart`:
  - `start()` → 30s background timer
  - `stop()` → cancel timer
  - `syncNow()` → manual sync
  - `uploadFile(path)` → POST to server
  - `downloadFile(path)` → GET from server
- [ ] **3B.2** Wire to `ServerConfigService` (already exists)
- [ ] **3B.3** Sync only when server configured
- [ ] **3B.4** Show sync status in UI: synced / syncing / offline / error
- [ ] **3B.5** Exponential backoff on errors

### 3C: mDNS discovery

- [ ] **3C.1** Backend: add `zeroconf` Python package
- [ ] **3C.2** Register `_notesmd._tcp` service on startup
- [ ] **3C.3** Flutter: add `bonsoir` package
- [ ] **3C.4** Scan for `_notesmd._tcp` services in Settings
- [ ] **3C.5** Auto-fill server URL from discovered service
- [ ] **3C.6** Fallback to manual URL entry

### 3D: Fix pairing.py

- [ ] **3D.1** Update `backend/notes-md-api/pairing.py`:
  - Replace `DEFAULT_SERVER = "http://192.168.1.8:8000"` with `request.base_url`
  - Add device name to pairing code
  - Add trust on first pair
- [ ] **3D.2** Tests: pairing works with dynamic URL
- [ ] **3D.3** Test: scan QR, pair, get token

### 3E: Build + test

- [ ] **3E.1** Test: sync 100 notes between two devices
- [ ] **3E.2** Test: conflict (edit same note offline, reconnect) → LWW keeps newer
- [ ] **3E.3** Test: mDNS discovers server on LAN
- [ ] **3E.4** Test: QR pairing works
- [ ] **3E.5** Build APK + Windows
- [ ] **3E.6** Commit + push to Codeberg + GitHub

**Acceptance:** Optional sync works. Conflicts resolved via LWW. mDNS discovery works.

---

## Phase 4 — Linux + Polish

**Goal:** Linux support + final polish for v1.0.

### 4A: Linux platform

- [ ] **4A.1** `cd apps/notes-md-app && flutter create --platforms linux .`
- [ ] **4A.2** Install Linux deps (GTK, webkit2gtk, etc.)
- [ ] **4A.3** Test: `flutter run -d linux`
- [ ] **4A.4** Build: `flutter build linux --release`
- [ ] **4A.5** Test AppImage: `./notes-md-linux.AppImage`

### 4B: Polish

- [ ] **4B.1** Update `README.md` with new architecture
- [ ] **4B.2** Update `setup.ps1` and `setup-android.ps1` if needed
- [ ] **4B.3** Add `docs/OFFLINE.md` explaining offline-first design
- [ ] **4B.4** Add `docs/SYNC.md` explaining self-hosted sync
- [ ] **4B.5** Update screenshots in docs

### 4C: Release

- [ ] **4C.1** Tag v1.0.0 on Codeberg
- [ ] **4C.2** Create release with APK + Windows + Linux + AppImage
- [ ] **4C.3** Tag v1.0.0 on GitHub
- [ ] **4C.4** Update release notes
- [ ] **4C.5** Celebrate (mentally)

**Acceptance:** Linux builds. Docs updated. v1.0.0 released.

---

## Total Estimated Effort

| Phase | Days |
|-------|------|
| Phase 0 | 1 |
| Phase 1 | 3-5 |
| Phase 2 | 2-3 |
| Phase 3 | 5-7 |
| Phase 4 | 2-3 |
| **Total** | **13-19 days** |

## Commit Strategy

After each phase:
1. Stage all changes
2. Commit with conventional format: `feat(scope): description`
3. Push to Codeberg `main` (primary)
4. Force-push to GitHub `main` (secondary, mirror)
5. Create release tag if milestone

## Rollback Plan

Each phase is independently shippable. If a phase fails:
1. Revert the commit
2. Push to both remotes
3. Document the issue
4. Move to next phase or fix forward
