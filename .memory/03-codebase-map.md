# Codebase Map

## Root Structure

```
E:\oprncode\project\
├── .memory\                    ← YOU ARE HERE. Project memory for Bob clones
│   ├── README.md               Master index - start here
│   ├── 01-project-card.md       Elevator pitch
│   ├── 02-architecture.md       Tech decisions
│   ├── 03-codebase-map.md       This file
│   ├── 04-progress.md           Phase tracking
│   ├── 05-setup.md              How to build/run
│   ├── 06-blocked.md            Blockers
│   ├── 07-next-steps.md         Priority queue
│   ├── 08-user-profile.md       Nayan's details
│   └── sessions/                Session records
├── apps\
│   ├── notes-md\                ← Web editor (React + Vite)
│   └── notes-md-app\            ← Flutter app shell
├── backend\
│   └── notes-md-api\            ← FastAPI backend
├── docs\superpowers\
│   ├── specs\                   Design specifications
│   └── plans\                   Implementation plans
├── resources\
│   └── resource-inventory.csv   Package/tool inventory (open in Excel)
├── setup.ps1                    Dev env setup script
└── setup-android.ps1            Android SDK CLI installer
```

## Web Editor (`apps/notes-md/`)

```
apps/notes-md/
├── src/
│   ├── main.tsx                 ✅ Entry point. BrowserRouter + AuthProvider + routing
│   ├── App.tsx                  ✅ Root component. Theme listener + Bridge + Layout
│   ├── index.css                ✅ Tailwind directives
│   ├── vite-env.d.ts            ✅ Vite type declarations
│   ├── context/
│   │   └── AuthContext.tsx      🔒 Auth provider. login(), register(), logout(), token persistence
│   ├── store/
│   │   └── useStore.ts          ✅ Zustand store. docs, tabs, settings, CRUD operations
│   ├── types/
│   │   └── index.ts             ✅ TypeScript interfaces (Doc, Settings, ViewMode)
│   ├── utils/
│   │   └── helpers.ts           ✅ Utility functions
│   ├── hooks/
│   │   └── useTheme.ts          ✅ Theme hook (light/dark/system)
│   └── components/
│       ├── Layout.tsx           ✅ Main layout. Toolbar + Sidebar + Editor + Preview + UserBadge
│       ├── Bridge.tsx           ✅ Flutter postMessage bridge handler
│       ├── Editor.tsx           ✅ CodeMirror 6 editor instance
│       ├── Preview.tsx          ✅ Markdown renderer (remark/rehype/KaTeX/Mermaid)
│       ├── Toolbar.tsx          ✅ Toolbar: New/Open/Save/View modes/Theme/Settings
│       ├── TabBar.tsx           ✅ Tabbed document interface
│       ├── Sidebar.tsx          ✅ File sidebar with rename/delete
│       ├── StatusBar.tsx        ✅ Word count, reading time
│       ├── WelcomeScreen.tsx    ✅ Welcome/empty state with keyboard shortcuts
│       ├── SettingsModal.tsx    ✅ Settings modal (font, theme, layout)
│       ├── ExportMenu.tsx       ✅ Export dropdown
│       ├── LoginPage.tsx        🔒 Login/register form with validation
│       ├── PairPage.tsx         🔒 QR code display + claim polling
│       └── ProtectedRoute.tsx   🔒 Auth gate, redirects to /login
├── public/                      Static assets
├── dist/                        Build output (loaded by Flutter WebView)
├── index.html                   Vite entry HTML
├── package.json                 Dependencies & scripts
├── tsconfig.json                TypeScript config
├── tsconfig.app.json            App-level TS config
├── tsconfig.node.json           Node-level TS config
├── vite.config.ts               Vite configuration
├── tailwind.config.js           Tailwind configuration
└── postcss.config.js            PostCSS configuration
```

Legend: ✅ Phase 1, 🔒 Phase 1.5 (auth session)

## Flutter App (`apps/notes-md-app/`)

```
apps/notes-md-app/
├── lib/
│   ├── main.dart                🔒 Entry point. Provider setup, routing, Material 3 theme
│   ├── screens/
│   │   ├── editor_screen.dart   ✅ WebView + file operations + bridge messages
│   │   ├── pair_screen.dart     🔒 QR scanner camera view with pairing flow
│   │   └── home_screen.dart     🔒 WebView with JWT injection + user menu
│   ├── services/
│   │   ├── auth_service.dart    🔒 Provider-based auth, claimPairing(), secure storage
│   │   ├── bridge_service.dart  ✅ JS ↔ Dart message handler for WebView bridge
│   │   └── file_service.dart    ✅ Native file picker for .md files
│   └── widgets/
│       └── toolbar.dart         ✅ Native toolbar (new/open/save)
├── android/                     Android project config (Gradle, manifest, etc.)
├── windows/                     Windows project config (needs VS)
├── pubspec.yaml                 Flutter dependencies
├── analysis_options.yaml        Dart lint rules
└── test/                        Test directory
```

Legend: ✅ Phase 2, 🔒 Auth session additions

## FastAPI Backend (`backend/notes-md-api/`)

```
backend/notes-md-api/
├── main.py                      ✅ App entry. CORS, routers, lifespan (DB init), endpoints
├── database.py                  🔒 Async SQLite setup, get_db(), init_db() — WAL mode
├── models.py                    🔒 Pydantic schemas (auth requests, responses)
├── auth.py                      🔒 Register, login, JWT create, get_current_user()
├── pairing.py                   🔒 Generate/claim/status pairing tokens (WhatsApp Web style)
├── requirements.txt             ✅ Python dependencies
├── test_api.py                  ✅ API tests
└── data/
    └── notesmd.db               🔒 SQLite database (auto-created)
```

Legend: ✅ Phase 3, 🔒 Auth session additions

## Design Docs (`docs/superpowers/`)

```
docs/superpowers/
├── specs/
│   ├── 2026-05-16-notes-md-editor.md      ✅ Original web editor spec
│   └── 2026-05-16-notes-md-auth.md        🔒 Auth + pairing + Android UI spec
└── plans/
    ├── 2026-05-16-notes-md-plan.md         ✅ Original implementation plan
    └── 2026-05-16-notes-md-auth-plan.md    🔒 Auth implementation plan
```

## Key Files Cheat Sheet

| Need | File |
|------|------|
| What is the backend API? | `backend/notes-md-api/main.py` |
| How does auth work? | `backend/notes-md-api/auth.py` |
| How does pairing work? | `backend/notes-md-api/pairing.py` |
| Web editor state management | `apps/notes-md/src/store/useStore.ts` |
| Web editor auth context | `apps/notes-md/src/context/AuthContext.tsx` |
| Web editor QR pairing page | `apps/notes-md/src/components/PairPage.tsx` |
| Web editor login page | `apps/notes-md/src/components/LoginPage.tsx` |
| Flutter auth service | `apps/notes-md-app/lib/services/auth_service.dart` |
| Flutter QR scanner | `apps/notes-md-app/lib/screens/pair_screen.dart` |
| Flutter WebView + JWT injection | `apps/notes-md-app/lib/screens/home_screen.dart` |
| Flutter entry + routing | `apps/notes-md-app/lib/main.dart` |
| WebView bridge (Flutter side) | `apps/notes-md-app/lib/services/bridge_service.dart` |
| WebView bridge (web side) | `apps/notes-md/src/components/Bridge.tsx` |
| Android SDK setup script | `setup-android.ps1` |
