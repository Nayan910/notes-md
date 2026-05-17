# Progress

## Phase Status Overview

| Phase | Description | Status | Est. Remaining |
|-------|-------------|--------|---------------|
| 1 | Web Editor (React + Vite + CodeMirror 6) | ✅ Complete | 0 |
| 1.5 | Auth + QR Pairing (web login, backend auth) | ✅ Complete | 0 |
| 2 | Flutter App Shell (WebView + file picker) | 🟡 Code complete | 2-4h |
| 3 | FastAPI Backend (MarkItDown + auth + pairing) | ✅ Complete | 0 |
| 4 | P2P Sync Engine (CRDT + WebRTC) | ❌ Not started | ~20h |

## Phase 1 — Web Editor ✅

**Status:** Feature-complete, builds clean (905 modules, 0 errors). UI redesigned with warm palette + 3 layout modes.

- [x] CodeMirror 6 with markdown syntax highlighting
- [x] Split view: editor + live preview
- [x] GFM tables, task lists, strikethrough
- [x] KaTeX math rendering ($$ and $)
- [x] Mermaid diagrams
- [x] Code syntax highlighting (Prism)
- [x] Dark/light/system theme
- [x] Tabbed document interface
- [x] File sidebar with rename/delete
- [x] localStorage persistence + auto-save
- [x] Toolbar: New, Open, Save
- [x] Backend-powered Import (PDF, DOCX, images → markdown)
- [x] Backend-powered Export (docx, odt, html, txt, rst, latex, epub)
- [x] Settings modal (font, theme, layout)
- [x] Status bar (word count, reading time)
- [x] Welcome screen with keyboard shortcuts
- [x] WebView postMessage bridge (Bridge.tsx)
- [x] Drag-and-drop file import
- [x] Login/Register page with validation
- [x] Auth context with JWT persistence
- [x] QR code generation for device pairing
- [x] Claim status polling
- [x] Protected routes + UserBadge

## Phase 1.5 — Auth + Device Pairing ✅

- [x] Backend: POST /auth/register
- [x] Backend: POST /auth/login
- [x] Backend: GET /auth/me
- [x] Backend: POST /pair/generate
- [x] Backend: POST /pair/claim
- [x] Backend: GET /pair/status/:token
- [x] Frontend: LoginPage (login + register toggle)
- [x] Frontend: PairPage (QR code + polling)
- [x] Frontend: AuthContext (providers, tokens, localStorage)
- [x] Flutter: AuthService (Provider, secure storage)
- [x] Flutter: PairScreen (QR scanner camera)
- [x] Flutter: HomeScreen (WebView + JWT injection)
- [x] Database: SQLite with users + devices + documents tables

## Phase 2 — Flutter App Shell 🟡

**Status:** Dart code complete, APK built successfully. File upload black screen still buggy.

- [x] InAppWebView loading the web editor
- [x] Native toolbar (new, open, save)
- [x] File picker for .md files
- [x] JavaScript bridge (bidirectional)
- [x] Provider-based auth routing
- [x] QR scanner for device pairing
- [x] JWT injection into WebView
- [x] Material 3 theme (light/dark)
- [x] **Android build** — APK built! 163MB debug at `apps/notes-md-app/build/app/outputs/`
- [x] **Production web bundle** — dist/ built and copied to Flutter assets + Android native assets
- [x] **Dual-mode loading** — dev server in debug mode, local assets in release mode
- [x] **File upload black screen** — Fixed via JS bridge intercept in Toolbar.tsx
- [ ] **Windows build** — needs Visual Studio 2022 + C++ workload

## Phase 3 — FastAPI Backend ✅

**Status:** All 6 endpoints tested and passing

- [x] GET /health — health check
- [x] GET /formats — 19 supported formats
- [x] POST /convert/file — upload file → markdown
- [x] POST /convert/text — raw text → markdown
- [x] POST /auth/register — user registration
- [x] POST /auth/login — user login
- [x] GET /auth/me — current user
- [x] POST /pair/generate — pairing token + QR data
- [x] POST /pair/claim — claim pairing token
- [x] GET /pair/status/:token — polling for claimed status

## Phase 4 — P2P Sync Engine ❌

Not started. Requires CRDT-based sync (probably Yjs or Automerge) over WebRTC. This is the "real" sync layer that makes the app useful across devices without cloud.

## Test Coverage

| Component | Tests | Status |
|-----------|-------|--------|
| Backend API | `test_api.py` | ✅ Manual testing done |
| Web Editor | None | ❌ Untested |
| Flutter App | None | ❌ Untested |

## 🚀 Future Roadmap

See `07-next-steps.md` for full prioritized list. Highlights:
- **Alpha release** with APK download (blocked: push credentials expired)
- ~~VS Code-style UI redesign~~ ✅ DONE (3 layout modes + warm palette)
- Import/export docx/odt/html/txt ↔ md
- Git-backed sync (user runs server, devices merge)
- Smart markdown writer (NL → md, TTS, STT)
- Notes mode (quick capture, offline-first)
- Built-in AI agent with memory/skills
- Security audit, testing, auto-update

## Build Artifacts

| Build | Location | Size |
|-------|----------|------|
| Web (Vite) | `apps/notes-md/dist/` | ~3.5 MB (JS + CSS) |
| Flutter APK | `apps/notes-md-app/build/app/outputs/flutter-apk/app-debug.apk` | 163 MB |
| Flutter APK (copy) | `notes-md-debug.apk` (project root) | 163 MB |
