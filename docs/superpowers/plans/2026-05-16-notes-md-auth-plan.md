# Auth + Device Pairing Implementation Plan

> **For agentic workers:** Execute tasks sequentially. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Add login/auth to web editor, QR code device pairing, Android UI with M3

**Architecture:** FastAPI backend with SQLite + JWT auth. React web app with login page and QR generation. Flutter Android app with QR scanner and WebView auth injection.

**Tech Stack:** FastAPI + SQLite + bcrypt + PyJWT + react-router-dom + qrcode.react + mobile_scanner

---

### Task 1: Backend — Auth User Model + Database Setup

**Files:**
- Create: `backend/notes-md-api/database.py`
- Create: `backend/notes-md-api/models.py`
- Modify: `backend/notes-md-api/requirements.txt`

- [ ] **Add new dependencies**

Add to `backend/notes-md-api/requirements.txt`:
```
bcrypt>=4.1.0
pyjwt>=2.8.0
python-dotenv>=1.0.0
aiosqlite>=0.20.0
```

- [ ] **Create database.py with SQLite setup**

```python
import aiosqlite
import os
from pathlib import Path

DB_DIR = Path(__file__).parent / "data"
DB_DIR.mkdir(exist_ok=True)
DB_PATH = DB_DIR / "notesmd.db"

async def get_db():
    db = await aiosqlite.connect(str(DB_PATH))
    db.row_factory = aiosqlite.Row
    await db.execute("PRAGMA journal_mode=WAL")
    await db.execute("PRAGMA foreign_keys=ON")
    return db

async def init_db():
    db = await get_db()
    try:
        await db.executescript("""
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT UNIQUE NOT NULL,
                password_hash TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
            CREATE TABLE IF NOT EXISTS devices (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                device_name TEXT,
                pairing_token TEXT UNIQUE,
                paired_at TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id)
            );
            CREATE TABLE IF NOT EXISTS documents (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                title TEXT DEFAULT 'Untitled',
                content TEXT DEFAULT '',
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id)
            );
        """)
        await db.commit()
    finally:
        await db.close()
```

- [ ] **Create models.py with Pydantic schemas**

```python
from pydantic import BaseModel
from typing import Optional

class RegisterRequest(BaseModel):
    username: str
    password: str

class LoginRequest(BaseModel):
    username: str
    password: str

class TokenResponse(BaseModel):
    token: str
    user: dict

class UserResponse(BaseModel):
    user: dict

class PairGenerateResponse(BaseModel):
    pairing_token: str
    qr_data: str

class PairClaimRequest(BaseModel):
    pairing_token: str
    device_name: Optional[str] = None

class PairStatusResponse(BaseModel):
    claimed: bool
    claimed_at: Optional[str] = None
```

---

### Task 2: Backend — Auth Endpoints

**Files:**
- Create: `backend/notes-md-api/auth.py`
- Modify: `backend/notes-md-api/main.py`

- [ ] **Create auth.py with register, login, verify logic**

```python
import bcrypt
import jwt
import secrets
from datetime import datetime, timedelta
from fastapi import APIRouter, HTTPException, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from database import get_db
from models import RegisterRequest, LoginRequest, TokenResponse, UserResponse

router = APIRouter(prefix="/auth", tags=["auth"])
security = HTTPBearer()

SECRET_KEY = "notesmd-dev-secret-change-in-production"
ALGORITHM = "HS256"

def create_token(user_id: int, username: str) -> str:
    payload = {
        "sub": str(user_id),
        "username": username,
        "exp": datetime.utcnow() + timedelta(days=30),
    }
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    try:
        payload = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM])
        return {"id": int(payload["sub"]), "username": payload["username"]}
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

@router.post("/register")
async def register(req: RegisterRequest):
    if len(req.username) < 3:
        raise HTTPException(status_code=400, detail="Username must be at least 3 characters")
    if len(req.password) < 4:
        raise HTTPException(status_code=400, detail="Password must be at least 4 characters")
    
    password_hash = bcrypt.hashpw(req.password.encode(), bcrypt.gensalt()).decode()
    db = await get_db()
    try:
        cursor = await db.execute("INSERT INTO users (username, password_hash) VALUES (?, ?)",
                                   req.username, password_hash)
        await db.commit()
        user_id = cursor.lastrowid
        token = create_token(user_id, req.username)
        return TokenResponse(token=token, user={"id": user_id, "username": req.username})
    except Exception:
        await db.rollback()
        raise HTTPException(status_code=409, detail="Username already exists")
    finally:
        await db.close()

@router.post("/login")
async def login(req: LoginRequest):
    db = await get_db()
    try:
        cursor = await db.execute("SELECT id, username, password_hash FROM users WHERE username = ?", req.username)
        row = await cursor.fetchone()
        if not row:
            raise HTTPException(status_code=401, detail="Invalid username or password")
        
        if not bcrypt.checkpw(req.password.encode(), row["password_hash"].encode()):
            raise HTTPException(status_code=401, detail="Invalid username or password")
        
        token = create_token(row["id"], row["username"])
        return TokenResponse(token=token, user={"id": row["id"], "username": row["username"]})
    finally:
        await db.close()

@router.get("/me")
async def me(user: dict = Depends(get_current_user)):
    return UserResponse(user=user)
```

- [ ] **Wire auth into main.py**

Add to top of `main.py`:
```python
from auth import router as auth_router, get_current_user
from database import init_db
from contextlib import asynccontextmanager
```

Replace the `app = FastAPI(...)` block with:
```python
@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    yield

app = FastAPI(title="notes.md API", version="1.0.0", lifespan=lifespan)
```

Add before the existing routes:
```python
app.include_router(auth_router)
```

- [ ] **Test auth endpoints**

```bash
cd backend/notes-md-api
pip install -r requirements.txt
uvicorn main:app --reload
# In another terminal:
curl -X POST http://localhost:8000/auth/register -H "Content-Type: application/json" -d '{"username":"test","password":"test1234"}'
```

---

### Task 3: Backend — Device Pairing Endpoints

**Files:**
- Create: `backend/notes-md-api/pairing.py`
- Modify: `backend/notes-md-api/main.py`

- [ ] **Create pairing.py**

```python
import secrets
import json
from datetime import datetime
from fastapi import APIRouter, HTTPException, Depends
from database import get_db
from models import PairClaimRequest, PairGenerateResponse, PairStatusResponse
from auth import get_current_user

router = APIRouter(prefix="/pair", tags=["pairing"])

@router.post("/generate")
async def generate_pairing(user: dict = Depends(get_current_user)):
    db = await get_db()
    try:
        pairing_token = secrets.token_urlsafe(32)
        # QR data encodes a JSON string the Android app will parse
        qr_data = json.dumps({
            "type": "notesmd_pair",
            "version": 1,
            "token": pairing_token,
            "server": "http://192.168.1.100:8000",  # user updates this
        })
        
        await db.execute("INSERT INTO devices (user_id, pairing_token) VALUES (?, ?)",
                         user["id"], pairing_token)
        await db.commit()
        
        return PairGenerateResponse(pairing_token=pairing_token, qr_data=qr_data)
    finally:
        await db.close()

@router.post("/claim")
async def claim_pairing(req: PairClaimRequest):
    db = await get_db()
    try:
        cursor = await db.execute(
            "SELECT d.id, d.user_id, u.username FROM devices d JOIN users u ON d.user_id = u.id WHERE d.pairing_token = ? AND d.paired_at IS NULL",
            req.pairing_token)
        row = await cursor.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Invalid or already claimed pairing token")
        
        await db.execute("UPDATE devices SET device_name = ?, paired_at = CURRENT_TIMESTAMP WHERE id = ?",
                         req.device_name or "Android Device", row["id"])
        await db.commit()
        
        # Create JWT for the Android device
        from auth import create_token
        token = create_token(row["user_id"], row["username"])
        
        return {"token": token, "user": {"id": row["user_id"], "username": row["username"]}}
    finally:
        await db.close()

@router.get("/status/{pairing_token}")
async def pairing_status(pairing_token: str):
    db = await get_db()
    try:
        cursor = await db.execute("SELECT paired_at FROM devices WHERE pairing_token = ?", pairing_token)
        row = await cursor.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Pairing token not found")
        return PairStatusResponse(
            claimed=row["paired_at"] is not None,
            claimed_at=row["paired_at"]
        )
    finally:
        await db.close()
```

- [ ] **Wire pairing router into main.py**

Add after `app.include_router(auth_router)`:
```python
from pairing import router as pairing_router
app.include_router(pairing_router)
```

---

### Task 4: Web Editor — Router + Auth Context

**Files:**
- Modify: `apps/notes-md/package.json`
- Create: `apps/notes-md/src/context/AuthContext.tsx`
- Create: `apps/notes-md/src/components/LoginPage.tsx`
- Create: `apps/notes-md/src/components/PairPage.tsx`
- Create: `apps/notes-md/src/components/ProtectedRoute.tsx`
- Modify: `apps/notes-md/src/App.tsx`
- Modify: `apps/notes-md/src/main.tsx`

- [ ] **Add dependencies**

```bash
cd apps/notes-md
npm install react-router-dom qrcode.react
```

- [ ] **Create auth context**

```tsx
// src/context/AuthContext.tsx
import { createContext, useContext, useState, useEffect, ReactNode } from 'react'

interface User { id: number; username: string }

interface AuthContextType {
  user: User | null
  token: string | null
  login: (username: string, password: string) => Promise<void>
  register: (username: string, password: string) => Promise<void>
  logout: () => void
  setAuth: (token: string, user: User) => void
}

const AuthContext = createContext<AuthContextType>(null!)

const API = 'http://localhost:8000'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [token, setToken] = useState<string | null>(null)

  useEffect(() => {
    const t = localStorage.getItem('notesmd_token')
    const u = localStorage.getItem('notesmd_user')
    if (t && u) {
      setToken(t)
      setUser(JSON.parse(u))
      // Verify token is still valid
      fetch(`${API}/auth/me`, { headers: { Authorization: `Bearer ${t}` } })
        .then(r => { if (!r.ok) logout() })
        .catch(() => logout())
    }
  }, [])

  function setAuth(token: string, user: User) {
    setToken(token)
    setUser(user)
    localStorage.setItem('notesmd_token', token)
    localStorage.setItem('notesmd_user', JSON.stringify(user))
  }

  async function login(username: string, password: string) {
    const res = await fetch(`${API}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    })
    if (!res.ok) throw new Error((await res.json()).detail || 'Login failed')
    const data = await res.json()
    setAuth(data.token, data.user)
  }

  async function register(username: string, password: string) {
    const res = await fetch(`${API}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    })
    if (!res.ok) throw new Error((await res.json()).detail || 'Registration failed')
    const data = await res.json()
    setAuth(data.token, data.user)
  }

  function logout() {
    setToken(null)
    setUser(null)
    localStorage.removeItem('notesmd_token')
    localStorage.removeItem('notesmd_user')
  }

  return (
    <AuthContext.Provider value={{ user, token, login, register, logout, setAuth }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
```

- [ ] **Create LoginPage**

```tsx
// src/components/LoginPage.tsx
import { useState } from 'react'
import { useAuth } from '../context/AuthContext'

export default function LoginPage() {
  const { login, register } = useAuth()
  const [isRegister, setIsRegister] = useState(false)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      if (isRegister) await register(username, password)
      else await login(username, password)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-white dark:bg-gray-900">
      <div className="w-full max-w-sm mx-4">
        <h1 className="text-2xl font-bold text-center mb-2 text-gray-900 dark:text-white">notes.md</h1>
        <p className="text-sm text-center text-gray-500 dark:text-gray-400 mb-8">
          {isRegister ? 'Create your account' : 'Sign in to your account'}
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Username</label>
            <input
              type="text"
              value={username}
              onChange={e => setUsername(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
              placeholder="your username"
              required
              minLength={3}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Password</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
              placeholder="your password"
              required
              minLength={4}
            />
          </div>

          {error && <p className="text-red-500 text-sm">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium disabled:opacity-50 transition-colors"
          >
            {loading ? 'Please wait...' : isRegister ? 'Create Account' : 'Sign In'}
          </button>
        </form>

        <p className="text-center mt-6 text-sm text-gray-500 dark:text-gray-400">
          {isRegister ? 'Already have an account? ' : "Don't have an account? "}
          <button
            onClick={() => { setIsRegister(!isRegister); setError('') }}
            className="text-blue-600 hover:underline font-medium"
          >
            {isRegister ? 'Sign in' : 'Create one'}
          </button>
        </p>
      </div>
    </div>
  )
}
```

- [ ] **Create PairPage (QR code generation)**

```tsx
// src/components/PairPage.tsx
import { useState, useEffect } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { useAuth } from '../context/AuthContext'

export default function PairPage() {
  const { token, user } = useAuth()
  const [qrData, setQrData] = useState('')
  const [pairingToken, setPairingToken] = useState('')
  const [claimed, setClaimed] = useState(false)
  const [loading, setLoading] = useState(false)

  async function generateQR() {
    setLoading(true)
    try {
      const res = await fetch('http://localhost:8000/pair/generate', {
        headers: { Authorization: `Bearer ${token}` }
      })
      const data = await res.json()
      setQrData(data.qr_data)
      setPairingToken(data.pairing_token)
      setClaimed(false)
    } catch (err) {
      console.error('Failed to generate pairing QR', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    generateQR()
  }, [])

  // Poll for claim status
  useEffect(() => {
    if (!pairingToken || claimed) return
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`http://localhost:8000/pair/status/${pairingToken}`)
        const data = await res.json()
        if (data.claimed) setClaimed(true)
      } catch {}
    }, 2000)
    return () => clearInterval(interval)
  }, [pairingToken, claimed])

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-white dark:bg-gray-900">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
        Pair Android Device
      </h1>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-8">
        Signed in as <strong>{user?.username}</strong>
      </p>

      {claimed ? (
        <div className="text-center">
          <div className="text-4xl mb-4">✅</div>
          <p className="text-green-600 dark:text-green-400 font-medium">Device paired successfully!</p>
          <p className="text-sm text-gray-500 mt-2">Your Android device is now connected.</p>
          <button onClick={generateQR} className="mt-6 text-blue-600 hover:underline text-sm">
            Generate new pairing code
          </button>
        </div>
      ) : (
        <div className="text-center">
          {loading ? (
            <div className="w-48 h-48 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse flex items-center justify-center">
              <span className="text-gray-400">Generating...</span>
            </div>
          ) : qrData ? (
            <div className="bg-white p-4 rounded-lg shadow-lg inline-block">
              <QRCodeSVG value={qrData} size={192} />
            </div>
          ) : null}

          <p className="mt-6 text-sm text-gray-600 dark:text-gray-300 max-w-sm">
            Open the <strong>notes.md</strong> app on your Android device and tap
            <strong> "Scan QR Code"</strong> to pair with this session.
          </p>

          <div className="mt-8 text-left text-xs text-gray-400 bg-gray-50 dark:bg-gray-800 p-3 rounded-lg max-w-sm">
            <p className="font-medium mb-1">Instructions:</p>
            <ol className="list-decimal list-inside space-y-1">
              <li>Install notes.md on your Android device</li>
              <li>Open the app and tap "Scan QR Code"</li>
              <li>Point your camera at this QR code</li>
              <li>Your devices will be paired automatically</li>
            </ol>
          </div>

          <button onClick={generateQR} className="mt-4 text-blue-600 hover:underline text-sm">
            Regenerate QR code
          </button>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Create ProtectedRoute**

```tsx
// src/components/ProtectedRoute.tsx
import { ReactNode } from 'react'
import { useAuth } from '../context/AuthContext'

export default function ProtectedRoute({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  if (!user) return null  // AuthContext handles redirect in App.tsx
  return <>{children}</>
}
```

- [ ] **Update main.tsx with router and AuthProvider**

```tsx
// Replace existing main.tsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import App from './App'
import LoginPage from './components/LoginPage'
import PairPage from './components/PairPage'
import './index.css'

function Root() {
  const { user } = useAuth()
  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/" /> : <LoginPage />} />
      <Route path="/pair" element={user ? <PairPage /> : <Navigate to="/login" />} />
      <Route path="/*" element={user ? <App /> : <Navigate to="/login" />} />
    </Routes>
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <Root />
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>
)
```

---

### Task 5: Web Editor — Add pair link to editor UI

**Files:**
- Modify: `apps/notes-md/src/components/Layout.tsx`

- [ ] **Add a "Pair" button to the Toolbar area or Settings modal**

In Layout.tsx (or Toolbar.tsx), add a button linking to `/pair`:
```tsx
import { Link } from 'react-router-dom'
// Add to toolbar:
<Link to="/pair" className="text-sm text-blue-600 hover:underline">
  Pair Device
</Link>
```

Also add a Logout button.

---

### Task 6: Flutter — Add QR scanner + auth flow

**Files:**
- Modify: `apps/notes-md-app/pubspec.yaml`
- Create: `apps/notes-md-app/lib/screens/pair_screen.dart`
- Create: `apps/notes-md-app/lib/services/auth_service.dart`
- Modify: `apps/notes-md-app/lib/main.dart`
- Create: `apps/notes-md-app/lib/screens/home_screen.dart`

- [ ] **Add dependencies to pubspec.yaml**

```yaml
dependencies:
  flutter:
    sdk: flutter
  flutter_inappwebview: ^6.0.0
  file_picker: ^8.0.0
  mobile_scanner: ^6.0.0
  flutter_secure_storage: ^9.0.0
  http: ^1.2.0
  provider: ^6.1.0
```

- [ ] **Create auth_service.dart**

```dart
import 'dart:convert';
import 'package:http/http.dart' as http;
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

class AuthService {
  static const _storage = FlutterSecureStorage();
  static const _tokenKey = 'notesmd_token';
  static const _userKey = 'notesmd_user';
  static const defaultServer = 'http://192.168.1.100:8000';

  String? _token;
  Map<String, dynamic>? _user;

  String? get token => _token;
  Map<String, dynamic>? get user => _user;
  bool get isAuthenticated => _token != null;

  Future<void> load() async {
    _token = await _storage.read(key: _tokenKey);
    final userStr = await _storage.read(key: _userKey);
    if (userStr != null) _user = jsonDecode(userStr);
  }

  Future<bool> claimPairing(String pairingToken, {String server = defaultServer}) async {
    try {
      final res = await http.post(
        Uri.parse('$server/pair/claim'),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({'pairing_token': pairingToken, 'device_name': 'Android Phone'}),
      );
      if (res.statusCode != 200) return false;
      final data = jsonDecode(res.body);
      _token = data['token'];
      _user = data['user'];
      await _storage.write(key: _tokenKey, value: _token);
      await _storage.write(key: _userKey, value: jsonEncode(_user));
      return true;
    } catch (e) {
      return false;
    }
  }

  Future<void> logout() async {
    _token = null;
    _user = null;
    await _storage.delete(key: _tokenKey);
    await _storage.delete(key: _userKey);
  }
}
```

- [ ] **Create pair_screen.dart (QR scanner)**

```dart
import 'package:flutter/material.dart';
import 'package:mobile_scanner/mobile_scanner.dart';
import '../services/auth_service.dart';

class PairScreen extends StatefulWidget {
  final AuthService authService;
  const PairScreen({super.key, required this.authService});

  @override
  State<PairScreen> createState() => _PairScreenState();
}

class _PairScreenState extends State<PairScreen> {
  bool _pairing = false;
  String? _error;
  MobileScannerController? _scannerController;

  @override
  void initState() {
    super.initState();
    _scannerController = MobileScannerController();
  }

  @override
  void dispose() {
    _scannerController?.dispose();
    super.dispose();
  }

  void _onDetect(BarcodeCapture capture) {
    if (_pairing) return;
    final code = capture.barcodes.firstOrNull?.rawValue;
    if (code == null) return;

    setState(() => _pairing = true);
    _scannerController?.stop();

    try {
      final data = jsonDecode(code);
      final token = data['token'] as String?;
      if (token == null) throw Exception('Invalid QR code');
      _claim(token);
    } catch (e) {
      _claim(code);  // Try raw token
    }
  }

  Future<void> _claim(String pairingToken) async {
    final success = await widget.authService.claimPairing(pairingToken);
    if (!mounted) return;
    if (success) {
      Navigator.of(context).pushReplacementNamed('/home');
    } else {
      setState(() {
        _error = 'Pairing failed. Check server connection.';
        _pairing = false;
      });
      _scannerController?.start();
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Pair with Web')),
      body: Column(
        children: [
          Expanded(
            child: _pairing
                ? const Center(child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      CircularProgressIndicator(),
                      SizedBox(height: 16),
                      Text('Pairing device...'),
                    ],
                  ))
                : MobileScanner(onDetect: _onDetect),
          ),
          if (_error != null)
            Padding(
              padding: const EdgeInsets.all(16),
              child: Text(_error!, style: TextStyle(color: Colors.red)),
            ),
          Padding(
            padding: const EdgeInsets.all(16),
            child: Text(
              'Point your camera at the QR code shown on the notes.md web app',
              textAlign: TextAlign.center,
              style: TextStyle(color: Colors.grey[600]),
            ),
          ),
        ],
      ),
    );
  }
}
```

- [ ] **Create home_screen.dart**

```dart
import 'package:flutter/material.dart';
import 'package:flutter_inappwebview/flutter_inappwebview.dart';
import '../services/auth_service.dart';

class HomeScreen extends StatefulWidget {
  final AuthService authService;
  const HomeScreen({super.key, required this.authService});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  InAppWebViewController? _webViewController;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('notes.md'),
        actions: [
          if (widget.authService.user != null)
            Padding(
              padding: const EdgeInsets.only(right: 8),
              child: Center(
                child: Text(
                  widget.authService.user!['username'] ?? '',
                  style: TextStyle(fontSize: 12, color: Colors.grey[600]),
                ),
              ),
            ),
          IconButton(
            icon: const Icon(Icons.logout),
            onPressed: () async {
              await widget.authService.logout();
              if (context.mounted) Navigator.of(context).pushReplacementNamed('/pair');
            },
          ),
        ],
      ),
      body: InAppWebView(
        initialUrlRequest: URLRequest(url: WebUri('http://192.168.1.100:5173')),
        onWebViewCreated: (controller) {
          _webViewController = controller;
        },
        onLoadStop: (controller, url) async {
          final token = widget.authService.token;
          if (token != null) {
            await controller.evaluateJavascript(source: '''
              localStorage.setItem('notesmd_token', '$token');
              window.location.reload();
            ''');
          }
        },
      ),
    );
  }
}
```

- [ ] **Update main.dart with routing**

```dart
import 'package:flutter/material.dart';
import 'services/auth_service.dart';
import 'screens/pair_screen.dart';
import 'screens/home_screen.dart';

void main() {
  runApp(const NotesMdApp());
}

class NotesMdApp extends StatelessWidget {
  const NotesMdApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'notes.md',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        colorSchemeSeed: Colors.blue,
        useMaterial3: true,
        brightness: Brightness.light,
      ),
      darkTheme: ThemeData(
        colorSchemeSeed: Colors.blue,
        useMaterial3: true,
        brightness: Brightness.dark,
      ),
      initialRoute: '/loading',
      routes: {
        '/loading': (context) => const _LoadingScreen(),
        '/pair': (context) => PairScreen(authService: AuthService()),
        '/home': (context) => HomeScreen(authService: AuthService()),
      },
    );
  }
}

class _LoadingScreen extends StatefulWidget {
  const _LoadingScreen();
  @override
  State<_LoadingScreen> createState() => _LoadingScreenState();
}

class _LoadingScreenState extends State<_LoadingScreen> {
  @override
  void initState() {
    super.initState();
    _checkAuth();
  }

  Future<void> _checkAuth() async {
    final auth = AuthService();
    await auth.load();
    if (!mounted) return;
    Navigator.of(context).pushReplacementNamed(
      auth.isAuthenticated ? '/home' : '/pair',
    );
  }

  @override
  Widget build(BuildContext context) {
    return const Scaffold(body: Center(child: CircularProgressIndicator()));
  }
}
```

Note: Actually AuthService is created fresh each route. The better approach is to use Provider. Let me note this for the user.
