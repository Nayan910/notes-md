# Project: notes.md

> **Elevator pitch:** A cross-platform markdown editor that runs everywhere — web, Android, Windows — with local-first storage, document conversion (19 formats → markdown), and device pairing via QR code (WhatsApp Web style).

## What It Is

A full-stack markdown editing suite:
- **Web editor** (React + CodeMirror 6) with live preview, KaTeX math, Mermaid diagrams, GFM
- **Flutter app shell** wrapping the web editor in a native WebView with file picker + QR scanner  
- **FastAPI backend** for document conversion (PDF/DOCX/PPTX/XLSX/HTML/images → markdown) + auth + device pairing

## What It Is NOT

- Not a cloud service — everything runs on localhost
- Not a collaboration platform (yet) — no multi-user sync
- Not a publishing platform — no site generator or export pipeline beyond markdown

## Target Platforms

| Platform | Status | Build Requirement |
|----------|--------|-------------------|
| Web (dev) | ✅ Working | `npm run dev` |
| Web (build) | ✅ Working | `npm run build` |
| Android | 🟡 Coded, needs SDK | Android SDK + JDK 17 |
| Windows | 🟡 Coded, needs VS | Visual Studio 2022 + C++ workload |
| macOS/iOS | ❌ Not started | Needs Mac + Xcode |
| Linux | ❌ Not started | Needs GTK (flutter build linux) |

## Why This Exists

Nayan needed a markdown editor that:
1. Works offline with no cloud dependency
2. Can open/edit large document sets locally
3. Syncs between desktop (web) and phone (Android) over local network
4. Converts office docs (PDF, DOCX, etc.) to markdown cleanly
5. Lives entirely on his E: drive (not C:)

## User

**Name:** Nayan  
**Machine:** Windows 11 Pro 64-bit, 23H2  
**Constraints:**
- All tools on E: drive (32 GB free), NOT C:
- No Visual Studio installed
- No Android SDK installed
- Prefers CLI over GUI
- Wants privacy-first, no cloud
- Reports hate: purple/blue gradients, perfect box shadows, "generic modern" look
