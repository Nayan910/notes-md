# Next Steps (Priority Queue for Next Bob)

> Priority: P0 = do first, P1 = important, P2 = nice to have

## P0 — Ship Android APK

**Goal:** Get a working APK on Nayan's phone so the pairing flow can be tested.

1. **Install JDK 17** — Download and install from https://adoptium.net
2. **Run `setup-android.ps1`** — Downloads Android SDK CLI tools, installs platform 35
3. **Update IP addresses** in `pairing.py` and `home_screen.dart` (use `ipconfig` to find local IP)
4. **Accept Android licenses** — `flutter doctor --android-licenses`
5. **Build APK** — `flutter build apk --debug`
6. **Sideload and test** — Open web editor, register, go to /pair, scan QR with phone

**Files to touch:**
- `backend/notes-md-api/pairing.py:22` — update `DEFAULT_SERVER`
- `apps/notes-md-app/lib/screens/home_screen.dart:14` — update `_webViewUrl`

## P1 — Fix Config & Polish

7. **Move JWT secret to environment variable** — `auth.py:19` → `os.getenv("JWT_SECRET")`
8. **Make API URL configurable** — `AuthContext.tsx:14` → env var or build-time config
9. **Set up CORS properly** — `main.py` has `allow_origins=["*"]`, lock it down for production
10. **Add rate limiting** — slowloris protection on auth endpoints

## P1 — Web Editor Polish

11. **Mobile responsive** — LoginPage and PairPage might need responsive tweaks
12. **Remember last session** — Auth redirect currently goes to root, should restore last workspace
13. **Error boundaries** — Catch React errors instead of white screen
14. **Pairing feedback** — Audio/vibration feedback when QR is scanned on web side

## P2 — Flutter Polish

15. **Bottom navigation** — Tab-based UI: Editor, Files, Settings (Material 3)
16. **Local files only mode** — Allow using the app without pairing (offline-first)
17. **Android edge-to-edge** — Draw behind system bars with scrim
18. **Adaptive layout** — Phone = single pane, foldable = dual pane

## P2 — Testing

19. **Backend tests** — `pytest` with `httpx` for async API testing
20. **Web editor tests** — Vitest + React Testing Library
21. **Flutter tests** — Widget tests for screens

## P2 — Phase 4: P2P Sync

22. **Research CRDT library** — Yrs (Rust/WASM) vs Automerge vs custom
23. **Design sync protocol** — How documents are reconciled between devices
24. **WebRTC signalling** — Use FastAPI as signalling server or embedded WebSocket
25. **Implement sync layer** — Integrate into the editor state

## User Preferences (Design Rules)

When building UI elements, remember Nayan:
- **Hates:** purple/blue gradients, perfect box shadows, "generic modern" look
- **Prefers:** warm colors, subtle imperfections, interesting typography, boutique/human-crafted feel
- **Primary drive:** E: (not C:)
- **Privacy:** Everything local-first, no cloud
