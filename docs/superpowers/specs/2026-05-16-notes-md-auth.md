# notes.md — Auth, Device Pairing & Android UI Design

## Overview
Add user authentication to the web editor and QR-code-based device pairing so the Android app can connect to the same workspace (WhatsApp Web model). Android app gets a Material Design 3 UI.

## Architecture
- **Backend (FastAPI)**: SQLite users table, bcrypt passwords, JWT tokens, pairing tokens
- **Web Editor (React)**: Login/Register page, auth context, QR code generation, protected editor routes
- **Flutter Android**: QR scanner, auth state, WebView with JWT injection

## Auth Flow
1. User registers (username + password) or logs in via web app → gets JWT
2. After login, web app shows "Pair Device" option → server generates a pairing token → displayed as QR code
3. Android app has "Scan QR to Pair" → scans QR → sends token to server → server links device & returns JWT
4. Android stores JWT, loads WebView injecting the token → authenticated session

## Backend Endpoints

### Auth
| Method | Path | Body | Response |
|--------|------|------|----------|
| POST | /auth/register | `{ username, password }` | `{ token, user: { id, username } }` |
| POST | /auth/login | `{ username, password }` | `{ token, user: { id, username } }` |
| GET | /auth/me | Header: Authorization | `{ user: { id, username } }` |
| POST | /auth/refresh | Header: Authorization | `{ token }` |

### Device Pairing
| Method | Path | Body | Response |
|--------|------|------|----------|
| POST | /pair/generate | Header: Authorization | `{ pairing_token, qr_data }` |
| POST | /pair/claim | `{ pairing_token, device_name }` | `{ token, user }` |
| GET | /pair/status/:token | — | `{ claimed: bool, claimed_at }` |

### Documents (future sync)
| Method | Path | Body | Response |
|--------|------|------|----------|
| GET | /docs | Header: Authorization | `[{ id, title, updated_at }]` |
| POST | /docs | `{ title, content }` | `{ id, title }` |
| GET | /docs/:id | Header: Authorization | `{ id, title, content }` |
| PUT | /docs/:id | `{ title?, content? }` | `{ id, title, updated_at }` |

## Web App Pages
- **/login** — Login form (username/password) with link to register; if no account, show register form instead
- **/pair** — After login: "Pair Android Device" section with QR code (regenerates on click), shows pairing instructions
- **/editor** — Protected route; if not authenticated, redirect to /login

## Android UI (Material Design 3)
- **Color scheme**: Dynamic Material You colors (Android 12+) with fallback palette
- **Bottom navigation**: 3 tabs — Editor (WebView), Files (local documents), Settings (pairing, about)
- **First launch**: "Welcome to notes.md — Pair with Web or Start Local" screen
  - Option A: "Scan QR Code" → camera scanner → pair with web account
  - Option B: "Start Locally" → use without pairing
- **Editor tab**: WebView fills the screen, native bottom toolbar (new/open/save), swipe back to files
- **Files tab**: List of local .md files, sorted by date, swipe to delete, tap to open
- **Settings tab**: Show paired account, unpair, app version, theme toggle
- **Edge-to-edge**: Content draws behind system bars, scrim for nav bar
- **Adaptive layout**: Phone = single pane, foldable/tablet = dual pane (nav rail + content)

## Tech Changes

### Backend (new deps)
- `bcrypt==4.1.*` — password hashing
- `pyjwt==2.8.*` — JWT tokens  
- `python-dotenv==1.0.*` — config
- `aiosqlite==0.20.*` — async SQLite

### Web Editor (new deps)
- `qrcode.react` — QR code component
- `react-router-dom` — routing for /login, /pair, /editor

### Flutter (new deps)
- `mobile_scanner` — QR code scanning (Android camera)
- `flutter_secure_storage` — store JWT securely
- Provider or Riverpod for auth state
