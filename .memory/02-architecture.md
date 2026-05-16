# Architecture & Key Decisions

## High-Level Architecture

```
┌──────────────────────┐      postMessage bridge      ┌──────────────────────┐
│   Web Editor (Vite)  │ ◄─────────────────────────►  │  Flutter App Shell   │
│  React + CodeMirror 6│     (bidirectional JSON)     │ InAppWebView + Native│
│   Zustand + Tailwind │                              │  file_picker + QR    │
└──────┬───────────────┘                              └──────────┬───────────┘
       │ HTTP (REST)                                              │ HTTP
       ▼                                                          ▼
┌──────────────────────────────────────────────────────────────────────┐
│                     FastAPI Backend (localhost:8000)                   │
│  /auth/register, /auth/login, /pair/generate, /pair/claim,           │
│  /convert/file, /convert/text, /health, /formats                      │
│  SQLite via aiosqlite (WAL mode)                                      │
└──────────────────────────────────────────────────────────────────────┘
```

## Tech Stack

| Layer | Technology | Why |
|-------|-----------|-----|
| Web Editor | React 18 + TypeScript + Vite 5 | Fast DX, full type safety, Vite is the standard now |
| State (web) | Zustand | Tiny (1KB), TypeScript-native, no boilerplate vs Redux |
| Editor | CodeMirror 6 | Mobile-friendly, extensible, better than Ace/Monaco for mobile |
| Markdown Rendering | react-markdown + remark/rehype pipeline | Standard, extensible, good KaTeX/Mermaid support |
| CSS | Tailwind 3 | Utility-first, dark mode built-in, no CSS file explosion |
| Mobile Shell | Flutter 3.38 + flutter_inappwebview | One codebase for Android/iOS/Windows/Mac/Linux |
| File Access | file_picker (Android) + browser APIs (web) | Native file dialogs on each platform |
| QR Scanning | mobile_scanner | Best-maintained Flutter QR scanner (mlkit-based) |
| Auth | bcrypt + JWT + custom | Simple, no third-party auth service needed |
| Device Pairing | Custom (pairing tokens, polling) | WhatsApp Web-style QR scan to connect |
| Backend | FastAPI + uvicorn | Python async, auto-docs, MarkItDown integration |
| Document Conversion | markitdown (Microsoft) | Converts 19 formats to markdown, OCR via embedded text |
| Database | SQLite via aiosqlite | Zero-config, file-based, async |
| Secure Storage | flutter_secure_storage | Encrypted keychain on Android (keystore) |

## Architecture Decisions (ADRs)

### ADR-1: "Option A" — WebView-based shell vs Native editor
**Decision:** Build a full web editor, embed it in Flutter WebView via postMessage bridge.

**Rationale:**
- Web editor can be developed and tested in-browser without Flutter
- Same codebase powers web + all mobile platforms
- Avoids maintaining separate web and native editors
- postMessage bridge gives us native file access from JS

**Trade-off:** WebView rendering is slightly slower than pure native. Acceptable for a text editor.

### ADR-2: Zustand over Redux/Context
**Decision:** Use Zustand for state management.

**Rationale:** 1KB bundle, zero boilerplate, built-in TypeScript support, works outside React (useful for the bridge callbacks). Redux is overkill for a single-user editor.

### ADR-3: CodeMirror 6 over Monaco/Ace
**Decision:** Use CodeMirror 6.

**Rationale:** CM6 was rebuilt for mobile in v6 — touch events, virtual scrolling, smaller bundle. Monaco is Electron-grade heavy. Ace is unmaintained.

### ADR-4: SQLite over PostgreSQL/JSON files
**Decision:** Use SQLite via aiosqlite.

**Rationale:** Single user, single machine. SQLite is zero-config, file-based, backed by well-tested C library. aiosqlite gives async access. JSON files would need concurrent access handling.

### ADR-5: JWT over session cookies
**Decision:** Use JWT tokens (30-day expiry) for auth.

**Rationale:** Stateless — no server-side session store needed. Easy to pass between web and mobile. bcrypt for password hashing (industry standard).

### ADR-6: WhatsApp Web QR model over manual pairing
**Decision:** Web shows QR code, mobile scans it.

**Rationale:** Familiar UX pattern. No need to type IP addresses or pairing codes. QR contains server URL + pairing token in JSON.

### ADR-7: flutter_inappwebview over webview_flutter
**Decision:** Use flutter_inappwebview.

**Rationale:** More features (JS evaluation at any time, cookie management, file access). Cross-platform (Android + iOS + Windows + macOS + Linux from one package).

## File Naming Conventions

- React components: `PascalCase.tsx`
- Flutter files: `snake_case.dart`
- Python modules: `snake_case.py`
- Tests: `test_<module>.py` / `<component>.test.tsx`
- CSS: Tailwind utility classes only (no custom CSS files)

## API Contract

All REST endpoints at `http://localhost:8000`. Auth endpoints return JWT in `token` field. Protected endpoints require `Authorization: Bearer <token>` header.

See `backend/notes-md-api/main.py` for complete OpenAPI docs (also at `http://localhost:8000/docs`).
