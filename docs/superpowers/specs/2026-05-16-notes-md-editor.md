# notes.md — Cross-platform Markdown Editor

## Architecture
**Option A**: Web-based markdown editor embedded in Flutter WebView via postMessage bridge

## Tech Stack
| Layer | Technology |
|-------|-----------|
| Web Editor | React 18 + TypeScript + Vite 5 |
| State | Zustand + localStorage |
| Editor | CodeMirror 6 (markdown, syntax highlight) |
| Rendering | react-markdown + remark/rehype pipeline |
| Math | KaTeX via rehype-katex |
| Diagrams | Mermaid (client-side rendering) |
| Code Highlight | Prism via rehype-prism-plus |
| Styling | Tailwind CSS 3 (dark/light/system) |
| Mobile Shell | Flutter 3.38 + flutter_inappwebview |
| File Access | file_picker (Android) + native dialogs (Windows) |
| Backend (future) | FastAPI + MarkItDown |

## Phases

### Phase 1 — Web Editor (DONE)
Full-featured markdown editor in the browser:
- [x] CodeMirror 6 with markdown syntax highlighting
- [x] Split view: editor + live preview
- [x] GFM tables, task lists, strikethrough
- [x] KaTeX math rendering ($$ and $)
- [x] Mermaid diagrams
- [x] Code syntax highlighting (Prism)
- [x] Dark/light/system theme
- [x] Tabbed document interface
- [x] File sidebar with rename/delete
- [x] localStorage persistence + auto-save
- [x] Toolbar: New, Open, Save, Export
- [x] Settings modal (font, theme, layout)
- [x] Status bar (word count, reading time)
- [x] Welcome screen with keyboard shortcuts
- [x] WebView postMessage bridge (Bridge.tsx)
- [x] Drag-and-drop file import

### Phase 2 — Flutter App Shell (CODED)
Native app wrapping the web editor:
- [x] InAppWebView loading notes.md
- [x] Native toolbar (new, open, save)
- [x] File picker for .md files
- [x] JavaScript bridge (bidirectional)
- [ ] Windows build (needs Developer Mode)
- [ ] Android build
- [ ] Local file management

### Phase 3 — Backend API (TODO)
- [ ] FastAPI server
- [ ] MarkItDown document conversion
- [ ] File upload/download endpoints
- [ ] OCR pipeline for images

### Phase 4 — P2P Sync (TODO)
- [ ] CRDT-based sync engine
- [ ] WebRTC peer-to-peer transport
- [ ] No central server
