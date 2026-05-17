# Master TODO List — notes.md

> Consolidated from `bob-initialization-prompt.md`, `07-next-steps.md`, and user's full vision.
> Updated: 2026-05-17 (Session 5)

---

## ✅ Completed

- [x] VS Code-like UI — 3 layout modes (VS Code/Classic/Notes) + warm terracotta/cream palette
- [x] VS Code layout polish — Full activity bar (Files/Search/Git icons) + mode toggle
- [x] Logo design — SVG logo + favicon in index.html
- [x] File upload JS bridge — WebView intercepts `<input type="file">`, routes through Flutter file_picker
- [x] Production web bundle — `dist/` embedded in Android native assets + Flutter assets, dual-mode loading
- [x] Backend `/convert/file` endpoint — upload PDF/DOCX/images → markdown (MarkItDown)
- [x] Backend `/convert/export` endpoint — markdown → docx/odt/html/txt/rst/latex/epub (pandoc)
- [x] Import UI — toolbar button → upload any file → opens markdown in editor
- [x] Export UI — toolbar dropdown → pandoc-powered export + download
- [x] Error boundaries — catch rendering crashes, prevent white screen
- [x] Smart markdown writer — AI assistant with Smart Write (plain text → formatted .md)
- [x] TTS (Text-to-Speech) — SpeechBar with Web Speech API, read aloud with formatting awareness
- [x] STT (Speech-to-Text) — Dictate notes via Web Speech API, inserted into editor
- [x] Notes mode — Distraction-free, minimalist UI, centered editor
- [x] Built-in AI agent — Chat panel, sees editor content, suggests edits, Apply to Editor
- [x] AI agent backends — Configurable API key (masked), model, endpoint in Settings
- [x] AI memory/learning — Conversation history + custom skills persisting to localStorage
- [x] Privacy-first AI — Cloud (API key) / Ollama (local) / Disabled modes
- [x] Update checker — Frontend toast notification on app load, debounced (once/day)
- [x] Version/update endpoints — GET /version, /update/check, /update/notes
- [x] Git-backed sync — Backend endpoints (status, push, pull, resolve) with JSON storage per user
- [x] Rate limiting — 10 req/min on auth endpoints
- [x] JWT secret from env var — Production security
- [x] CORS lockdown — CORS_ORIGINS env var with dev fallback
- [x] Security audit — Full audit report with H/M/L findings + remediation
- [x] Backend tests — 68 tests across all 13+ endpoints (pytest)
- [x] Web tests — 79 tests across 5 test files (Vitest + Testing Library)

---

## 🔴 Blocked — Needs Physical Device or Codeberg Token

- [ ] **Verify LAN pairing end-to-end** — AuthContext + PairPage host derivation on 192.168.1.x, CORS, Windows firewall rules
- [ ] **Fix QR scanning on device** — Runtime camera permission handling in Flutter, fallback manual code entry
- [ ] **Create alpha release** — APK attached to Codeberg release, downloadable artifact
- [ ] **Push 3 pending commits** — `9712c5c`, `fa4e72f`, `13846d0`

## ⏳ Needs Flutter SDK Installed

- [ ] **Flutter tests** — `flutter test` on mobile app
- [ ] **Windows app build** — `flutter build windows`
- [ ] **Rebuild APK** — With latest production web bundle

---

## APK Builds

| Build | Location | Size |
|-------|----------|------|
| Debug APK | `notes-md-debug.apk` (project root) | 163 MB |
| Debug APK | `apps/notes-md-app/build/app/outputs/flutter-apk/app-debug.apk` | 163 MB |