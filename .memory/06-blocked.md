# Blocked Items & Open Questions

## 🔴 Critical Blockers (Must Resolve Before Continuing)

### 1. No Android SDK
**Problem:** Flutter can't build APK — `flutter doctor` shows "Unable to locate Android SDK"

**Fix:** Run `setup-android.ps1` or:
1. Download command-line tools from https://developer.android.com/studio/index.html#command-line-tools-only
2. Extract to `E:\apps\android-sdk`
3. Run `sdkmanager "platforms;android-35" "build-tools;35.0.0" "platform-tools"`
4. Set `$env:ANDROID_HOME = "E:\apps\android-sdk"`
5. `flutter doctor --android-licenses`

### 2. No JDK 17
**Problem:** Android builds need JDK 17+ for Gradle

**Fix:** Download from https://adoptium.net/ (Temurin JDK 17). Set `JAVA_HOME`.

### 3. Hardcoded IP Addresses
**Problem:** Two files have hardcoded IPs that need to be your machine's actual local network IP

**Files to update:**
- `backend/notes-md-api/pairing.py` line 22 — `DEFAULT_SERVER`
- `apps/notes-md-app/lib/screens/home_screen.dart` line 14 — `_webViewUrl`

**Why:** The QR code the web app generates contains the server URL. For your Android phone to reach the server, that URL must be your machine's WiFi IP (e.g., `192.168.1.42`), not `localhost`.

## 🟡 Known Issues (Should Fix Eventually)

### 4. JWT Secret in Source Code
**Issue:** `SECRET_KEY` is hardcoded in `auth.py:19`. OK for dev, needs environment variable for real use.

**Fix:** `import os` and use `os.getenv("JWT_SECRET", "fallback-for-dev")`.

### 5. No Test Coverage
**Issue:** Web editor and Flutter app have no automated tests. Backend has minimal manual tests.

**Needs:** React Testing Library tests for components, `pytest` for backend, `flutter test` for Dart.

### 6. Web Editor API URL Hardcoded
**Issue:** `AuthContext.tsx` line 14 has `const API = 'http://localhost:8000'`. Should be configurable.

### 7. No Rate Limiting
**Issue:** Auth endpoints have no rate limiting. Brute-force protection is missing.

### 8. No HTTPS
**Issue:** Everything runs over HTTP. Fine for localhost but a concern if exposed to network.

## ❓ Open Questions

### Q1: Server URL for QR Code
What is your machine's local IP? The QR code generated for Android pairing needs to point to your machine.
```
Run: ipconfig
Look for: IPv4 Address under your active WiFi adapter
```

### Q2: Android SDK Location Preference
Do you want the SDK on E: drive (`E:\apps\android-sdk`) or would you rather use a different path?

### Q3: App Name & Icon
The Flutter app uses the default Material icon. Do you want a custom icon/name for the APK?

### Q4: Windows Build Priority
Windows build needs Visual Studio 2022 + "Desktop development with C++" workload. Do you want to install it?

### Q5: Syncing Strategy
Phase 4 (P2P sync) can use either:
- **Yrs/Yjs** — mature CRDT library, JavaScript, could run in WebView
- **Automerge** — Rust-based, more efficient for large docs
- **Custom** — lighter but more work

Which direction do you prefer?

### Q6: Multiple Users
Currently auth supports multiple users on the same server (each with their own docs). Is this needed or is it single-user only?

## Config Checklist (For First Android Build)

- [ ] Install JDK 17 (Temurin)
- [ ] Run `setup-android.ps1` (or manually install Android SDK)
- [ ] Update pairing token server URL to local IP
- [ ] Update Flutter WebView URL to local IP
- [ ] Update backend CORS to allow Android device origin
- [ ] Accept Android licenses (`flutter doctor --android-licenses`)
- [ ] `flutter build apk --debug`
- [ ] Sideload APK to phone
- [ ] Test pairing flow end-to-end
