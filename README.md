# notes.md

A cross-platform markdown editor with live preview, syntax highlighting, file conversion, and device pairing.

The web editor (React + CodeMirror 6) runs standalone in any browser or embedded inside a Flutter app shell for Android and Windows.

---

## Features

- **Markdown editing** with live preview — split pane, side-by-side
- **CodeMirror 6** editor with syntax highlighting for CSS, HTML, JS, JSON, Markdown
- **Export** — Markdown to DOCX, ODT, HTML, TXT, PDF, EPUB, RST, LaTeX
- **Import** — Convert PDF, DOCX, PPTX, XLSX, HTML, CSV, JSON, images to Markdown
- **3 layout modes** — VS Code–style (activity bar + tab bar), Classic (split pane), Notes (distraction-free)
- **Auth** — username/password with JWT tokens
- **Device pairing** — WhatsApp Web–style QR code pairing (web shows QR, phone scans)
- **Offline standalone** — use the Flutter app without a server
- **AI assistant** — with Smart Write (plain text → formatted markdown), configurable for cloud or local (Ollama) backends, or disabled entirely
- **Speech** — read aloud (TTS) and dictation (STT) via Web Speech API
- **File sync** — push/pull changes across devices (MVP, JSON-file based)
- **Dark mode** — warm-toned light and dark themes

## Architecture

```
├── apps/notes-md/              # Web editor (React 18 + TypeScript + Vite + CodeMirror 6)
├── apps/notes-md-app/          # Flutter app shell (Android + Windows, hosts web via WebView)
├── backend/notes-md-api/       # FastAPI backend (conversion, auth, device pairing, sync)
├── docs/superpowers/           # Design specs and implementation plans
```

The **Flutter app embeds the web editor** using `flutter_inappwebview`. A `Bridge` component in React handles JS interop for file picking, logging, and incoming file handling.

## Setup

### Prerequisites

| Component | Requirement |
|-----------|-------------|
| **Node.js** | >= 18 |
| **Python** | >= 3.10 |
| **Flutter** | >= 3.10 (for app builds only) |
| **JDK** | 17 or 21 (for Android builds only) |
| **VS Build Tools** | Windows desktop C++ workload (for Windows builds only) |

### 1. Backend

```bash
cd backend/notes-md-api
pip install -r requirements.txt
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

The backend provides document conversion, authentication, device pairing, and file sync.

### 2. Web Editor

```bash
cd apps/notes-md
npm install
npm run dev
```

Open http://localhost:5173 in your browser. The web editor works standalone without the Flutter app.

### 3. Flutter App (Optional)

```bash
cd apps/notes-md-app
flutter pub get
flutter run -d windows   # Windows
flutter run -d android   # Android (requires SDK + JDK)
```

> The Flutter app loads the web editor. By default it connects to `localhost:5173` in debug mode. In release builds it loads from bundled assets.

### Environment Variables (Backend)

| Variable | Default | Purpose |
|----------|---------|---------|
| `JWT_SECRET` | `notesmd-dev-secret-change-in-production` | JWT signing key (change in production) |
| `CORS_ORIGINS` | `*` | Comma-separated allowed origins |

## Usage

1. **Register** a username and password at `/login`
2. **Pair a device** — go to `/pair` and scan the QR code from the Flutter app
3. **Edit** — write Markdown in the editor, see live preview
4. **Import** — upload files or paste text to convert to Markdown
5. **Export** — download your Markdown as DOCX, PDF, HTML, and more
6. **Sync** — push changes to the server and pull on other devices

## Build

```bash
# Web editor production build (needed before Flutter release builds)
cd apps/notes-md && npm run build

# Android APK
cd apps/notes-md-app && flutter build apk --debug

# Windows
cd apps/notes-md-app && flutter build windows --debug
```

The Flutter app expects the web build output at `apps/notes-md-app/assets/notes-md/`.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Editor | CodeMirror 6 |
| Web framework | React 18 + TypeScript + Vite |
| Styling | Tailwind CSS |
| State | Zustand |
| Mobile shell | Flutter + flutter_inappwebview |
| Backend | FastAPI (Python) |
| Database | SQLite (aiosqlite) |
| Conversion | markitdown + pypandoc |
| Auth | bcrypt + JWT |

---

## Inspiration

notes.md draws inspiration from several projects and tools:

- **[MarkdownViewer.org](https://markdownviewer.org/)** — clean, distraction-free Markdown preview and cross-platform philosophy
- **[GitNote](https://github.com/zhaopengme/gitnote)** — lightweight Markdown note-taking with git integration
- **WhatsApp Web** — QR code device pairing pattern for seamless multi-device workflow

---

## ⚠️ Alpha Disclaimer

**notes.md is in early alpha (v0.1.0-alpha).**

- **Bugs** — Expect crashes, lost data, and unexpected behavior. The app has not been extensively tested outside the development environment.
- **Breaking changes** — APIs, data formats, and storage are not stable. Future updates may break compatibility with documents created now.
- **No backup guarantee** — Store copies of important documents elsewhere. The app does not provide automatic backups.
- **Limited testing** — Most testing has been manual and on specific hardware (Windows, Android). Cross-platform issues are expected.
- **Not production-ready** — Do not rely on this for critical work, healthcare, legal, or financial documents.

## Privacy Policy

**notes.md is designed to be privacy-first and local-first.**

### Data Collection
- **No cloud storage.** All documents are stored locally on your device (SQLite database) or in your local network.
- **No analytics.** No tracking scripts, no telemetry, no usage data sent to any third party.
- **No ads.** The app contains no advertising.
- **No third-party services.** Apart from optional AI features (see below), the app does not communicate with external servers unless you explicitly pair devices on your local network.

### Authentication
- Usernames and passwords are stored locally in your SQLite database.
- Passwords are hashed with bcrypt before storage.
- JWT tokens are stored in your browser's localStorage and your device's secure storage (flutter_secure_storage). They expire after 30 days.

### Network
- The backend server runs on your machine and only accepts connections you configure.
- Device pairing communicates over your local network.
- No data is sent to the internet unless you configure an AI backend URL.

### AI Features
- The AI assistant is **disabled by default**.
- If enabled, you choose the backend: a local Ollama instance, or a cloud API of your choice.
- You are responsible for the terms and privacy of whichever AI backend you configure.

### Your Control
- All data is yours. You can delete your database files at any time.
- Logging out or clearing browser storage removes your session tokens.
- You can inspect, export, or delete all stored data through the file system.

---

## License

MIT
