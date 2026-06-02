# notes.md — Offline-First Architecture (v1.0)

**Date:** 2026-06-01
**Status:** Approved
**Author:** Bob (autonomous decision)

## Goals

1. **Fully offline by default** — no server required, no login, no network calls
2. **Plain .md files on disk** — user can open in any text editor
3. **Fast search** across thousands of notes (FTS5)
4. **Optional self-hosted sync** — user controls their data
5. **Cross-platform** — Windows, Android, Linux
6. **No vendor lock-in** — open source, no telemetry

## Architecture

### Three-Layer Storage Model

```
┌─────────────────────────────────────────────────────────────┐
│  Layer 1: .md files on disk (source of truth)               │
│  - Windows/Linux: ~/Documents/notes-md/                     │
│  - Android: /data/data/com.notesmd.app/app_flutter/notes-md/│
│  - User can open these in VS Code, Obsidian, Vim, anything  │
├─────────────────────────────────────────────────────────────┤
│  Layer 2: SQLite/Drift (index + FTS5 search)                │
│  - Lives in .notes-md/notes.db (hidden, regeneratable)      │
│  - Indexes: title, tags, mtime, size, content (FTS5)        │
│  - Never syncs — rebuilt from .md files on first launch     │
├─────────────────────────────────────────────────────────────┤
│  Layer 3: IndexedDB (editor scratch/drafts)                 │
│  - Replaces current localStorage (5-10MB cap bug)           │
│  - Dirty buffer, last-saved hash, draft copy                │
│  - Editor-only, never touches disk directly                 │
└─────────────────────────────────────────────────────────────┘
```

### Sync Flow (when server configured)

1. App launches → reads .md files from disk
2. SQLite indexes them in background (FTS5 for search)
3. WebView loads file via bridge, drafts go to IndexedDB
4. Debounced autosave (2s) → writes back to .md file → updates SQLite index
5. If self-hosted server configured: LWW sync every 30s (file-level, by mtime)

### Discovery + Auth

1. **mDNS scan** for `_notesmd._tcp` service on LAN (zero-config)
2. **QR code pairing** for secure auth (WhatsApp Web-style, already 70% built)
3. **Manual URL** fallback for edge cases

## Tech Stack

| Layer | Technology | Notes |
|-------|-----------|-------|
| Web Editor | React 18 + TypeScript + Vite 5 | Existing |
| State | Zustand + IndexedDB (via idb) | **CHANGED** from localStorage |
| Editor | CodeMirror 6 | Existing |
| Rendering | react-markdown + remark/rehype | Existing |
| Math | KaTeX (local CSS) | KaTeX CDN → local in v0.1.0-alpha |
| Mobile Shell | Flutter 3.38 + flutter_inappwebview | Existing |
| File Access | path_provider (canonical dir) | **CHANGED** from file_picker |
| Native DB | Drift + sqlite3_flutter_libs | **NEW** |
| File Watcher | watcher (pub.dev) | **NEW** |
| mDNS | bonsoir (Flutter), zeroconf (Python) | **NEW** |
| Backend | FastAPI + SQLite | Existing, extended |
| Sync | File-level LWW (mtime) | **NEW** |

## Phases

### Phase 0 — Stop the bleeding (1 day)
- [ ] Replace `localStorage` with `IndexedDB` in web editor
- [ ] Add `idb` package
- [ ] Create `src/utils/idb-storage.ts` wrapper
- [ ] Update `useAutoSave` to use IndexedDB
- [ ] Add unit tests for storage layer

### Phase 1 — Filesystem as source of truth (3-5 days)
- [ ] Add `path_provider` usage: `getApplicationDocumentsDirectory()` + `notes-md/` subfolder
- [ ] Extend bridge protocol: `list-notes`, `read-note`, `write-note`, `delete-note`, `rename-note`
- [ ] Flutter `FileService` for .md file I/O
- [ ] Web editor: read .md on open, write .md on save (debounced 2s)
- [ ] Remove `file_picker` save flow (replaced by auto-save to canonical location)
- [ ] Update `HomeScreen` to load file list from Flutter side
- [ ] Add file picker for opening existing .md files (Android intent + Windows dialog)

### Phase 2 — Search + Index (2-3 days)
- [ ] Add `drift` + `drift_flutter` + `sqlite3_flutter_libs` to Flutter
- [ ] Create `NoteService` (indexes .md files into SQLite)
- [ ] Add FTS5 virtual table for full-text search
- [ ] Add search panel UI in web editor (Cmd+K)
- [ ] File watcher: pick up external edits (VS Code, Obsidian)
- [ ] Live reload: when external edit detected, prompt user to reload

### Phase 3 — Sync (5-7 days)
- [ ] Backend: `/sync/upload`, `/sync/list`, `/sync/diff` (LWW by mtime)
- [ ] Flutter: `SyncService` (30s background sync when server configured)
- [ ] Fix `pairing.py`: derive server from `request.base_url` not constant
- [ ] Add mDNS: `bonsoir` (Flutter), `zeroconf` (Python)
- [ ] Polish QR pairing flow (device name, trust on first pair)
- [ ] Sync status indicator in UI (synced/syncing/offline/error)

### Phase 4 — Linux + Polish (2-3 days)
- [ ] `flutter create --platforms linux` in `apps/notes-md-app/`
- [ ] Build Linux AppImage
- [ ] Update docs + release notes
- [ ] v1.0 release

## Critical Pre-Existing Bug

The web editor uses `localStorage` (5-10MB cap, synchronous), NOT IndexedDB.
Large notes will throw `QuotaExceededError` and silently break autosave.
**Must be fixed in Phase 0 before any other work.**

## Non-Goals (v1.0)

- Real-time collaboration (Yjs/CRDT) — v2.0
- Cloud sync (Dropbox, Google Drive) — out of scope, use filesystem sync
- Mobile-only features (camera, GPS) — out of scope
- Plugin system — v2.0
- Themes beyond dark/light/system — v2.0

## Success Criteria

- [ ] App works fully offline (no network calls)
- [ ] All notes stored as plain .md files
- [ ] Search returns results in <100ms for 1000+ notes
- [ ] Optional sync works with self-hosted server (LWW)
- [ ] Builds successfully on Windows, Android, Linux
- [ ] All tests pass
- [ ] Documentation updated

## Risks

| Risk | Mitigation |
|------|------------|
| Large file sync conflicts | LWW by mtime is acceptable for solo use |
| mDNS firewall issues | Manual URL fallback |
| SQLite migration on schema change | Drift migrations are versioned |
| WebView storage quota | IndexedDB is GB-scale, not MB |
| Cross-platform path differences | path_provider handles all 3 platforms |
