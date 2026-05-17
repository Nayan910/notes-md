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

---

## P0 — Alpha Release & Device Integration

- [ ] **Verify LAN pairing end-to-end** — AuthContext + PairPage host derivation on 192.168.1.x, CORS, Windows firewall rules
- [ ] **Fix QR scanning on device** — Runtime camera permission handling in Flutter, fallback manual code entry
- [ ] **Create alpha release** — APK attached to Codeberg release, downloadable artifact
- [ ] **Add React error boundaries** — Catch rendering crashes, prevent white screen

## P1 — Core Features

- [ ] **Smart markdown writer** — Type plain text, app converts to formatted .md
- [ ] **TTS (Text-to-Speech)** — Read markdown aloud with formatting awareness
- [ ] **STT (Speech-to-Text)** — Dictate notes, auto-formatted as markdown
- [ ] **Notes mode** — Quick capture, offline-first, minimal UI
- [ ] **Logo design** — App logo for Flutter + web editor
- [ ] **Standard download/update process** — Auto-update check, release channels (alpha/beta/stable)

## P2 — Sync & Distribution

- [ ] **Git-backed sync** — User runs server, other devices connect, CRDT merge when both online
- [ ] **Built-in AI agent** — Sees editor content, suggests edits, fixes formatting, answers questions
- [ ] **AI agent backends** — Free API key input or local model or OpenCode plugin
- [ ] **Memory/learning** — AI remembers user patterns and builds skills over time
- [ ] **Privacy-first AI** — All processing local or user-controlled, no cloud

## P3 — Security & Quality

- [ ] **Security audit** — Ensure no secrets in localStorage or JS bundles
- [ ] **Backend tests** — pytest + httpx
- [ ] **Web tests** — Vitest
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
