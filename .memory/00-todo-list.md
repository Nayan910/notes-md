# Master TODO List — notes.md

> Consolidated from `bob-initialization-prompt.md`, `07-next-steps.md`, and user's full vision.
> Updated: 2026-05-17

---

## ✅ Completed

- [x] UX overhaul — 3 layout modes (VS Code/Classic/Notes) + warm terracotta/cream palette
- [x] File upload JS bridge — WebView intercepts `<input type="file">`, routes through Flutter file_picker
- [x] Production web bundle — `dist/` embedded in Android native assets + Flutter assets, dual-mode loading
- [x] Backend `/convert/file` endpoint — upload PDF/DOCX/images → markdown (MarkItDown)
- [x] Backend `/convert/export` endpoint — markdown → docx/odt/html/txt/rst/latex/epub (pandoc)
- [x] Import UI — toolbar button → upload any file → opens markdown in editor
- [x] Export UI — toolbar dropdown → pandoc-powered export + download
- [x] Bob initialization prompt created
- [x] Git push to Codeberg verified working
- [x] Error boundaries — catch rendering crashes, prevent white screen
- [x] Smart markdown writer — AI assistant with Smart Write (plain text → formatted .md)
- [x] TTS (Text-to-Speech) — SpeechBar with Web Speech API, read aloud with formatting awareness
- [x] STT (Speech-to-Text) — Dictate notes via Web Speech API, inserted into editor
- [x] Notes mode — Distraction-free, minimalist UI, centered editor
- [x] Logo design — SVG logo + favicon in index.html
- [x] Built-in AI agent — Chat panel, sees editor content, suggests edits, Apply to Editor
- [x] AI agent backends — Configurable API endpoint, key (masked), model in Settings
- [x] Security audit — Full audit report with H/M/L findings + remediation
- [x] Backend tests — 68 tests across all 12 endpoints (pytest)
- [x] Web tests — 79 tests across 5 test files (Vitest + Testing Library)

---

## P0 — Alpha Release & Device Integration

- [ ] **Verify LAN pairing end-to-end** — AuthContext + PairPage host derivation on 192.168.1.x, CORS, Windows firewall rules
- [ ] **Fix QR scanning on device** — Runtime camera permission handling in Flutter, fallback manual code entry
- [ ] **Create alpha release** — APK attached to Codeberg release, downloadable artifact

## P1 — Core Features

- [ ] **Standard download/update process** — Auto-update check, release channels (alpha/beta/stable)
- [ ] **AI memory/learning** — AI remembers user patterns and builds skills over time
- [ ] **Privacy-first AI** — All processing local or user-controlled, no cloud

## P2 — Sync & Distribution

- [ ] **Git-backed sync** — User runs server, other devices connect, CRDT merge when both online
- [ ] **VS Code layout polish** — Full activity bar with proper icons, smooth mode toggle

## P3 — Security & Quality

- [ ] **Flutter tests**
- [ ] **Rate limiting** — On auth endpoints
- [ ] **JWT secret to env var** — CORS lockdown for production
- [ ] **Self-updating** — Check for new APK version, download and install

---

## APK Builds

| Build | Location | Size |
|-------|----------|------|
| Debug APK | `notes-md-debug.apk` (project root) | 163 MB |
| Debug APK | `apps/notes-md-app/build/app/outputs/flutter-apk/app-debug.apk` | 163 MB |