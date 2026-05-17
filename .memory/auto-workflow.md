# Autonomous Workflow — notes.md

> Created: 2026-05-17
> Purpose: Self-driving execution while Nayan is away
> Rule: Follow this precisely. No asking for permission. Retry 3x, then skip. Document everything.

## Decision Framework

| Situation | Rule |
|-----------|------|
| Build fails | Retry 3x. If still fails, skip task, document error in 06-blocked.md |
| Tests fail | Fix test or code (whichever is wrong). If fix takes >15 min, skip & document |
| Dependency missing | Install it (E: drive only). If can't install, skip & document |
| IP address needed | Use last known IP (192.168.1.8). Check `ipconfig` if needed |
| Git push fails | Retry 3x. Check credentials. If still fails, stash changes locally |
| Ambiguous design choice | Choose the simplest option. Document the decision with rationale |
| New bug discovered | Fix it if it blocks current task. Otherwise log in 06-blocked.md and continue |
| Need more disk space | Clean node_modules/.dart_tool/build cache. Never install to C: |
| Nayan returns mid-task | Stop current work, report status, ask for guidance |

## Git Strategy

- Commit per completed task with clear messages
- Push to Codeberg after each commit
- Tag v0.1.0-alpha when release is created
- Remote: `https://codeberg.org/nayanchotaliya/notes.md.git`

## Task Execution Order

### Task 1: Fix File Upload Black Screen (P0)
**Approach:** JS bridge intercept → Flutter file_picker → base64 → WebView injection
- [ ] Modify `Bridge.tsx` — intercept `<input type="file">` clicks, send `pick-file` bridge message
- [ ] Modify `bridge_service.dart` — handle `pick-file` message, open file_picker, read as base64
- [ ] Modify `editor_screen.dart` — wire up file_picker result back to WebView
- [ ] Handle `file-picked` response in Bridge.tsx — create File/Blob from base64
- [ ] Test: Click open file → file picker opens → file loads in editor

**Fallback:** If flutter_inappwebview JS bridge has issues, document and skip

### Task 2: Production Web Bundle + Flutter Asset Loading (P0)
**Approach:** Build dist/ with vite, serve from Flutter assets in release mode
- [ ] Run `npm run build` in apps/notes-md
- [ ] Copy dist/ to Flutter assets folder (apps/notes-md-app/assets/notes-md/)
- [ ] Register assets in pubspec.yaml
- [ ] Modify `editor_screen.dart` — use `_useDevServer` flag to switch between dev/local
- [ ] Verify loading works in both modes

**Fallback:** If vite build fails, skip production bundle, continue with dev server only

### Task 3: Codeberg Release v0.1.0-alpha (P0)
**Approach:** Tag, push, create release with APK binary
- [ ] Ensure git status is clean
- [ ] Tag current commit as v0.1.0-alpha
- [ ] Push tag to Codeberg
- [ ] Use `gh` or Codeberg API to create release with APK attachment
- [ ] Verify release exists

**Fallback:** If gh/API not available, document steps needed and skip

### Task 4: UI Redesign — 3 Layout Modes + Warm Palette (P1)
**Approach:** Layout switcher in settings, 3 presets, warm color overhaul
- [ ] **Color palette:** Replace blues with warm tones (amber, rust, olive, warm gray) across all components
- [ ] **Layout mode state:** Add `layoutMode: 'vscode' | 'classic' | 'notes'` to store
- [ ] **Classic mode:** Same as current layout (already exists, keep as-is with new colors)
- [ ] **VS Code mode:** Activity bar (left), tab bar, sidebar, editor, status bar
- [ ] **Notes mode:** Distraction-free — full-screen editor, minimal chrome, focus mode
- [ ] **Layout switcher UI:** Toggle in toolbar or settings
- [ ] **SettingsModal update:** Add layout mode picker
- [ ] **Verify:** All 3 modes render correctly, settings persist

**Fallback:** If full implementation is too complex, implement framework + 1 full mode + palette

## Progress Tracking

After each task:
1. Commit with message format: `task: description of what was done`
2. Push to Codeberg
3. Update `04-progress.md` with task status
4. Update current session file

## Session File

The current session is recorded in `.memory/sessions/004-2026-05-17-session4.md`. Each task updates this file with:
- What was attempted
- What succeeded/failed
- Decisions made
- Any errors encountered

## User Profile Reminders

- **Hates:** Purple/blue gradients, perfect box shadows, "generic modern"
- **Prefers:** Warm colors (amber, rust, warm gray, olive), subtle imperfections, interesting typography
- **E: drive only** — never C:
- **No Visual Studio** — don't suggest installing it
- **Privacy-first** — everything local, no cloud
