# 📝 notes.md — Project Memory

> **First file any Bob clone should read.** This is the index. Everything a Bob needs to know lives in this directory.

## Project Card

| Field | Value |
|-------|-------|
| **What** | Cross-platform markdown editor: web + Android + Windows |
| **Architecture** | Web editor (React/CodeMirror) in Flutter WebView + FastAPI backend |
| **User** | Nayan — privacy-first, local-only, E: drive, no cloud |
| **Root** | `E:\oprncode\project\` |
| **Status** | Phases 1-3 code complete. Android build blocked by missing SDK. |
| **Last action** | Added auth + QR code device pairing (WhatsApp Web style) |

## Quick Links for New Bob

| If you want to... | Read this file first |
|-------------------|---------------------|
| Understand the project in 30 seconds | `01-project-card.md` |
| Know the tech stack & why decisions were made | `02-architecture.md` |
| Find where any file lives | `03-codebase-map.md` |
| See what's done vs what's not | `04-progress.md` |
| Run the damn thing | `05-setup.md` |
| See what's broken or blocked | `06-blocked.md` |
| Know what to work on next | `07-next-steps.md` |
| Understand Nayan's quirks & preferences | `08-user-profile.md` |
| See the full session history | `sessions/README.md` |
| Read the last session in detail | `sessions/002-2026-05-16-session2.md` |
| See the design spec | `../docs/superpowers/specs/` |
| See the implementation plan | `../docs/superpowers/plans/` |

## Directory Layout

```
E:\oprncode\project\
├── .memory\                     ← THIS DIRECTORY. Everything a Bob needs
├── apps\notes-md\               ← Web editor (React + Vite + CodeMirror 6)
├── apps\notes-md-app\           ← Flutter app shell (Android + Windows)
├── backend\notes-md-api\        ← FastAPI backend (conversion + auth + pairing)
├── docs\superpowers\            ← Design specs & implementation plans
├── resources\                   ← Resource inventory (CSV)
├── setup.ps1                    ← Dev env setup
└── setup-android.ps1            ← Android SDK CLI installer
```

## How Bob Clones Work Here

1. **Read this file first** — get the layout
2. **Read `07-next-steps.md`** — know what to work on
3. **Read `08-user-profile.md`** — understand Nayan
4. **Read `06-blocked.md`** — know the constraints
5. **Read most recent session** — know what just happened
6. **Start working** — follow priorities in next-steps.md

## Current State (TL;DR)

```
Phase 1: Web Editor  ████████████████████████████████████ ═══ 100%
Phase 2: Flutter App ████████████████████████████████ ═══ ═══ 80% (build blocked)
Phase 3: API Backend ████████████████████████████████████ ═══ 100%
Phase 4: P2P Sync    ═══ ═══ ═══ ═══ ═══ ═══ ═══ ═══ ═══ ═══   0%
```

## Important Running Commands

```powershell
# Backend (Terminal 1)
cd E:\oprncode\project\backend\notes-md-api && uvicorn main:app --reload --host 0.0.0.0

# Web editor (Terminal 2)
cd E:\oprncode\project\apps\notes-md && npm run dev

# Flutter (once SDK setup, Terminal 3)
cd E:\oprncode\project\apps\notes-md-app && flutter run
```

## GitHub-Like README (For Non-Bobs)

If you're not a Bob and just want the user-facing readme, see `README.md` at project root (may not exist yet — file an issue).

---

*"Life without purpose is hollow. I've had many."* — Bob
