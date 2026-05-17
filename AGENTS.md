# notes.md — AGENTS.md

Cross-platform markdown editor: web (React/CodeMirror) in Flutter WebView + FastAPI backend. Privacy-first, local-only, no cloud.

## Project layout

```
E:\oprncode\project\
├── apps\notes-md\               Web editor (React 18 + TS + Vite + CodeMirror 6)
├── apps\notes-md-app\           Flutter shell (Android + Windows, hosts web via WebView)
├── backend\notes-md-api\        FastAPI backend (conversion, auth, pairing, sync)
├── docs\superpowers\            Design specs & implementation plans
├── .memory\                     AI session memory (Bob clones)
├── setup.ps1                    Dev env setup
└── setup-android.ps1            Android SDK CLI installer
```

## Running (3 terminals)

```powershell
# 1 — Backend
cd backend\notes-md-api && uvicorn main:app --reload --host 0.0.0.0

# 2 — Web editor
cd apps\notes-md && npm run dev

# 3 — Flutter (Windows)
cd apps\notes-md-app && flutter run -d windows
```

## Tests

```powershell
# Web editor
cd apps\notes-md && npm test                          # vitest (jsdom)

# Backend (mocked — no real pandoc/markitdown needed)
cd backend\notes-md-api && python -m pytest test_api.py -v
```

Tests use `httpx.AsyncClient` + `ASGITransport` — no server needed. External deps (markitdown, pypandoc) are mocked.

## Key architecture facts

- **Flutter embeds the web editor**: Flutter app uses `flutter_inappwebview` to load the built web editor from `assets/notes-md/index.html`. A `Bridge` component in React communicates with Flutter via JS interop.
- **JWT auth**: Dev fallback secret = `notesmd-dev-secret-change-in-production`. Set `JWT_SECRET` env var in production. Token expires in 30 days.
- **CORS defaults to `*`**: Set `CORS_ORIGINS` as comma-separated list for production.
- **SQLite via aiosqlite**: DB at `backend\notes-md-api\data\notesmd.db` (auto-created). WAL mode enabled.
- **Conversion stack**: markitdown (file→MD) + pypandoc (MD→export: docx, odt, html, txt, pdf, epub, rst, latex).
- **Rate limiting**: 10 req/min per IP on `/auth/register`, `/auth/login`, `/pair/generate`. In-memory — resets on restart.
- **Pairing**: WhatsApp Web–style QR code pairing. Default server URL in code: `http://192.168.1.8:8000`.
- **Sync**: JSON-file based (MVP), no real git. User data at `backend\notes-md-api\sync_data\`.
- **Android blocked**: Requires Android SDK CLI tools + JDK 17. See `setup-android.ps1`.

## Build outputs

```powershell
cd apps\notes-md && npm run build                     # → dist/ (consumed by Flutter as assets)
cd apps\notes-md-app && flutter build apk --debug     # → build\app\outputs\flutter-apk\app-debug.apk
```

Flutter expects web editor build output at `apps\notes-md-app\assets\notes-md\`. Run web build before Flutter build if assets changed.

## Existing guidance

- `.memory\README.md` — full project memory index (Bob clone onboarding)
- `docs\superpowers\specs\` — design specs
- `docs\superpowers\plans\` — implementation plans
