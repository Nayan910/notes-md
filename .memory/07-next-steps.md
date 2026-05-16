# Next Steps (Priority Queue for Next Bob)

> Priority: P0 = do first, P1 = important, P2 = nice to have

## Session 003 Achieved
- ✅ Android SDK installed (platform 36 + build-tools 36)
- ✅ JDK 21 installed (E:\apps\jdk-21)
- ✅ Debug APK built (163MB, at `notes-md-debug.apk`)
- ✅ Flutter cache moved to E:\apps\flutter-cache (symlinked)
- ✅ Vite + Backend both verified running
- ✅ Fixed white screen (removed rehypeRaw crash)
- ✅ IPs updated to 192.168.1.8
- ✅ Pandoc export endpoint (md → docx/odt/html/txt/rst/latex/epub)
- ✅ Storage permissions in AndroidManifest.xml
- ✅ Git commit + push to Codeberg

## P0 — Alpha Release & Download

1. **Create GitHub/Codeberg release** with APK binary download
2. **Build production web bundle** for Flutter to serve locally (stop depending on Vite dev server)
3. **Bundle APK as downloadable artifact** in repo releases

## P0 — File Upload Black Screen Fix

4. **JS bridge approach:** Intercept `<input type="file">` clicks → Flutter file_picker → send base64 back via JavaScript bridge
5. Currently blocked by flutter_inappwebview v6.1.5 lacking `onFileChooser`

## P1 — UI/UX Overhaul (VS Code-style)

6. **Web editor redesign:** Tab bar, activity bar, sidebar, status bar layout (like VS Code)
7. **Color palette:** Warm colors, boutique feel, NO purple/blue gradients, NO perfect box shadows
8. **App logo:** Design and add logo to Flutter app + web editor
9. **Material 3 polish:** Bottom nav (Editor, Files, Settings), edge-to-edge

## P1 — Import/Export Multiple Formats

10. **Frontend UI** for import: file picker → upload to `/convert/file` → opens in editor
11. **Frontend UI** for export: Save As dialog → `/convert/export` → download as docx/odt/html/txt
12. Import .txt, .docx, .odt, .html, .pdf, .csv, .json, .xml, images (MarkItDown already supports all)
13. Export as .docx, .odt, .html, .txt, .rst, .latex, .epub (pandoc endpoint done)

## P1 — Git-backed Sync

14. **User runs server on their machine** (simple script to start backend)
15. **Other devices connect** to the server IP and sync documents
16. **Conflict resolution:** CRDT-based merging when both devices are online
17. **Auto-detect** when server is available vs offline (local-first)

## P2 — Smart Markdown Writer

18. **Natural language → formatted .md:** User types plain text, app converts to proper markdown
19. **TTS (Text-to-Speech):** Read markdown content aloud with formatting awareness
20. **STT (Speech-to-Text):** Dictate notes, auto-formatted as markdown

## P2 — Notes Mode

21. **Quick capture mode:** Open app, start typing notes immediately (no pairing/setup needed)
22. **Local-only mode:** Work fully offline, sync when server available
23. **Minimal UI:** Distraction-free writing interface

## P2 — Built-in AI Agent

24. **AI that sees the editor content** and can suggest edits, fix formatting, answer questions
25. **Memory/learning:** AI remembers user patterns and builds skills over time
26. **Multiple backends:** Free API key input, or local model, or OpenCode plugin
27. **Privacy:** All AI processing local or user-controlled — no cloud

## P2 — Security & Quality

28. **Audit for sensitive info client-side** — ensure no secrets in localStorage or JS bundles
29. **Error boundaries** everywhere (catch rendering errors gracefully)
30. **Backend tests** (pytest + httpx), web tests (Vitest), Flutter tests
31. **Rate limiting** on auth endpoints
32. **JWT secret to env var**, CORS lockdown for production

## P2 — Self-Updating & Distribution

33. **Auto-update mechanism:** Check for new APK version, download and install
34. **Standard download/update process:** Release channels (alpha/beta/stable)
35. **Installation script** that sets up everything: JDK, Android SDK, dependencies

## User Preferences (Design Rules)

When building UI elements, remember Nayan:
- **Hates:** purple/blue gradients, perfect box shadows, "generic modern" look
- **Prefers:** warm colors, subtle imperfections, interesting typography, boutique/human-crafted feel
- **Primary drive:** E: (not C:)
- **Privacy:** Everything local-first, no cloud
- **Color palette:** Warm tones, earthy, hand-crafted feel
