# Implementation Plan

## Project Location
`E:\oprncode\project\`

## Directory Structure
```
E:\oprncode\project\
├── .memory\README.md          # Local project memory
├── resources\                 
│   └── resource-inventory.csv # Tool/package inventory
├── docs\superpowers\
│   ├── specs\                 # Product specifications
│   └── plans\                 # Implementation plans
├── apps\
│   ├── notes-md\              # Phase 1: Web editor (React + Vite)
│   └── notes-md-app\          # Phase 2: Flutter app shell
└── backend\
    └── notes-md-api\          # Phase 3: FastAPI backend
```

## Build Status

### Phase 1 — Web Editor ✅
- **Status**: Complete. Builds clean (921 modules, 0 errors)
- **Run**: `cd apps/notes-md && npm run dev`
- **Build**: `cd apps/notes-md && npm run build`
- **Dist**: `apps/notes-md/dist/` (used by Flutter WebView in production)

### Phase 2 — Flutter App Shell 🟡
- **Status**: Source files written. Needs Windows Developer Mode enabled
- **Run**: `flutter run -d windows` (enable Developer Mode first)
- **Developer Mode**: Run `start ms-settings:developers` in Windows
- **Flutter SDK**: Already at `E:\apps\flutter\flutter\bin`

### Phase 3 — Backend API ⏳
- **Status**: Not started
- **Dependencies**: fastapi, uvicorn, markitdown, python-multipart

## Key Files

### Web Editor (Phase 1)
| File | Purpose |
|------|---------|
| `src/store/useStore.ts` | Zustand state (docs, tabs, settings) |
| `src/components/Editor.tsx` | CodeMirror 6 editor |
| `src/components/Preview.tsx` | Markdown preview with KaTeX/Mermaid |
| `src/components/Bridge.tsx` | Flutter postMessage bridge |
| `src/components/Toolbar.tsx` | New/Open/Save/Export buttons |

### Flutter App (Phase 2)
| File | Purpose |
|------|---------|
| `lib/main.dart` | App entry point |
| `lib/screens/editor_screen.dart` | WebView + bridge + file operations |
| `lib/services/bridge_service.dart` | JS ↔ Dart message handling |
| `lib/services/file_service.dart` | Native file picker |
| `lib/widgets/toolbar.dart` | Native toolbar widget |

## Resource Summary
| Resource | Version | Location |
|----------|---------|----------|
| Node.js | v22.20.0 | C:\Program Files\nodejs |
| Python | 3.13.7 | System |
| Flutter | 3.38.9 | E:\apps\flutter\flutter\bin |
| npm packages | 738 installed | apps/notes-md/node_modules |
| E: disk free | 32 GB | — |
