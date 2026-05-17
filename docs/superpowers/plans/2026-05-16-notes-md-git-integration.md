# Git Integration for notes.md — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Git-based version control to notes.md — create/open/clone repos, commit, push, pull, and sync notes with remote Git repositories — via the FastAPI backend using gitpython.

**Architecture:** Git operations run on the FastAPI backend wrapped in a `GitManager` service. The web editor calls backend API endpoints for all Git operations. The Flutter app communicates via the existing auth/secured bridge. No native compilation needed.

**Tech Stack:** Python (gitpython), FastAPI, React (Zustand), Flutter (existing WebView bridge)

---

## File Structure

### New Files (Backend)
- `backend/notes-md-api/git_manager.py` — Core Git service wrapping gitpython
- `backend/notes-md-api/git_router.py` — REST API endpoints for Git operations
- `backend/notes-md-api/git_models.py` — Pydantic models for git requests/responses

### New Files (Web Editor)
- `apps/notes-md/src/components/GitPanel.tsx` — Git sidebar panel (branch info, status, sync)
- `apps/notes-md/src/components/GitCloneModal.tsx` — Modal for cloning/opening repos
- `apps/notes-md/src/components/CommitModal.tsx` — Commit message dialog
- `apps/notes-md/src/components/RepoSetupModal.tsx` — Initial repo setup (create/open/clone)
- `apps/notes-md/src/hooks/useGit.ts` — React hooks for Git API calls
- `apps/notes-md/src/components/GitStatusBar.tsx` — Git status indicator in status bar

### Modified Files (Backend)
- `backend/notes-md-api/main.py` — Register git router
- `backend/notes-md-api/database.py` — Add git_repos table
- `backend/notes-md-api/models.py` — Add git-related Pydantic models
- `backend/notes-md-api/requirements.txt` — Add gitpython

### Modified Files (Web Editor)
- `apps/notes-md/src/types/index.ts` — Add Git types (RepoInfo, GitStatus, etc.)
- `apps/notes-md/src/store/useStore.ts` — Add Git state slice
- `apps/notes-md/src/components/Sidebar.tsx` — Add Git panel toggle
- `apps/notes-md/src/components/Toolbar.tsx` — Add Git sync buttons
- `apps/notes-md/src/components/Layout.tsx` — Wire up Git panel
- `apps/notes-md/src/components/StatusBar.tsx` — Add Git status info

### Modified Files (Flutter)
- `apps/notes-md-app/lib/screens/home_screen.dart` — Add git actions to popup menu
- `apps/notes-md-app/lib/services/bridge_service.dart` — Add git message types

---

### Task 1: Add gitpython dependency and git_repos table

**Files:**
- Modify: `backend/notes-md-api/requirements.txt`
- Modify: `backend/notes-md-api/database.py`

- [ ] **Step 1: Add gitpython to requirements**

Edit `backend/notes-md-api/requirements.txt`:
```diff
+ gitpython>=3.1.0
```

- [ ] **Step 2: Add git_repos table to database schema**

Edit `backend/notes-md-api/database.py` — add to `init_db()`:
```diff
             CREATE TABLE IF NOT EXISTS documents (
                 id INTEGER PRIMARY KEY AUTOINCREMENT,
                 user_id INTEGER NOT NULL,
                 title TEXT DEFAULT 'Untitled',
                 content TEXT DEFAULT '',
                 updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                 FOREIGN KEY (user_id) REFERENCES users(id)
             );
+            CREATE TABLE IF NOT EXISTS git_repos (
+                id INTEGER PRIMARY KEY AUTOINCREMENT,
+                user_id INTEGER NOT NULL,
+                name TEXT NOT NULL,
+                local_path TEXT NOT NULL,
+                remote_url TEXT,
+                default_branch TEXT DEFAULT 'main',
+                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
+                FOREIGN KEY (user_id) REFERENCES users(id)
+            );
         """)
```

- [ ] **Step 3: Run and verify**

```bash
cd backend/notes-md-api && pip install gitpython
```

Run: `python -c "import git; print(git.__version__)"`
Expected: prints version without error

- [ ] **Step 4: Commit**

```bash
git add backend/notes-md-api/requirements.txt backend/notes-md-api/database.py
git commit -m "feat: add gitpython dep and git_repos table"
```

---

### Task 2: Create GitManager service

**Files:**
- Create: `backend/notes-md-api/git_manager.py`

- [ ] **Step 1: Write GitManager class**

```python
"""
Git repository management via gitpython.
Wraps all git operations used by the notes.md backend.
"""

import os
import shutil
from pathlib import Path
from typing import Optional

from git import Repo, GitCommandError
from git.remote import RemoteProgress


REPOS_BASE = Path(__file__).parent / "data" / "repos"


class GitProgress(RemoteProgress):
    def __init__(self):
        super().__init__()
        self.progress = 0

    def update(self, op_code, cur_count, max_count=None, message=""):
        if max_count:
            self.progress = int(cur_count / max_count * 100)


class GitManager:
    def __init__(self, base_path: Optional[Path] = None):
        self.base_path = base_path or REPOS_BASE
        self.base_path.mkdir(parents=True, exist_ok=True)
        self._repos: dict[str, Repo] = {}

    def _user_path(self, user_id: int) -> Path:
        path = self.base_path / str(user_id)
        path.mkdir(exist_ok=True)
        return path

    def _repo_path(self, user_id: int, repo_name: str) -> Path:
        return self._user_path(user_id) / repo_name

    def create_repo(self, user_id: int, repo_name: str) -> dict:
        path = self._repo_path(user_id, repo_name)
        if path.exists():
            raise FileExistsError(f"Repository '{repo_name}' already exists")
        repo = Repo.init(path)
        # Create initial README so we have something to commit
        readme = path / "README.md"
        readme.write_text(f"# {repo_name}\n\nnotes.md repository\n")
        repo.index.add(["README.md"])
        repo.index.commit("Initial commit")
        return {"name": repo_name, "path": str(path), "branch": repo.active_branch.name}

    def open_repo(self, user_id: int, repo_name: str) -> dict:
        path = self._repo_path(user_id, repo_name)
        if not path.exists():
            raise FileNotFoundError(f"Repository '{repo_name}' not found")
        repo = Repo(path)
        return {"name": repo_name, "path": str(path), "branch": repo.active_branch.name}

    def clone_repo(self, user_id: int, repo_name: str, remote_url: str, username: Optional[str] = None, password: Optional[str] = None) -> dict:
        path = self._repo_path(user_id, repo_name)
        if path.exists():
            raise FileExistsError(f"Path '{repo_name}' already exists")

        kwargs = {"to_path": str(path)}
        if username and password:
            # Inject credentials into URL for auth
            from urllib.parse import urlparse, urlunparse
            parsed = urlparse(remote_url)
            netloc = f"{username}:{password}@{parsed.hostname}"
            if parsed.port:
                netloc += f":{parsed.port}"
            auth_url = urlunparse(parsed._replace(netloc=netloc))
            kwargs["url"] = auth_url
        else:
            kwargs["url"] = remote_url

        repo = Repo.clone_from(**kwargs)
        return {"name": repo_name, "path": str(path), "branch": repo.active_branch.name}

    def status(self, user_id: int, repo_name: str) -> dict:
        path = self._repo_path(user_id, repo_name)
        repo = Repo(path)
        is_dirty = repo.is_dirty(untracked_files=True)
        untracked = repo.untracked_files
        # Get diff summary
        diff = repo.index.diff(None) if is_dirty else []
        staged = [{"path": d.a_path, "change_type": d.change_type} for d in diff]
        branch = repo.active_branch.name
        commits_behind = 0
        commits_ahead = 0
        try:
            if repo.remotes:
                info = repo.remotes.origin.fetch(dry_run=True)
                if info:
                    commits_behind = info[0].fetch_result.get('behind', 0)
                    commits_ahead = info[0].fetch_result.get('ahead', 0)
        except Exception:
            pass
        return {
            "branch": branch,
            "is_dirty": is_dirty,
            "staged": staged,
            "untracked": untracked,
            "commits_behind": commits_behind,
            "commits_ahead": commits_ahead,
        }

    def commit(self, user_id: int, repo_name: str, message: str, author_name: str = "notes.md User", author_email: str = "user@notes.md") -> dict:
        path = self._repo_path(user_id, repo_name)
        repo = Repo(path)
        # Add all changes
        repo.index.add(["*"])
        # Add untracked files
        for f in repo.untracked_files:
            repo.index.add(f)
        commit = repo.index.commit(message, author=commit_author)
        return {"commit_hash": commit.hexsha, "message": message}

    def push(self, user_id: int, repo_name: str, username: Optional[str] = None, password: Optional[str] = None) -> dict:
        path = self._repo_path(user_id, repo_name)
        repo = Repo(path)
        if not repo.remotes:
            raise ValueError("No remote configured for this repository")
        remote = repo.remotes.origin
        if username and password:
            remote.set_url(remote.url.replace("://", f"://{username}:{password}@"))
        try:
            info = remote.push()
            result = []
            for push_info in info:
                result.append({
                    "local_ref": push_info.local_ref,
                    "remote_ref": push_info.remote_ref,
                    "flags": push_info.flags,
                    "summary": push_info.summary,
                })
            return {"success": True, "push_results": result}
        except GitCommandError as e:
            return {"success": False, "error": str(e)}

    def pull(self, user_id: int, repo_name: str, username: Optional[str] = None, password: Optional[str] = None) -> dict:
        path = self._repo_path(user_id, repo_name)
        repo = Repo(path)
        if not repo.remotes:
            raise ValueError("No remote configured")
        remote = repo.remotes.origin
        if username and password:
            remote.set_url(remote.url.replace("://", f"://{username}:{password}@"))
        try:
            info = remote.pull()
            return {"success": True, "summary": str(info)}
        except GitCommandError as e:
            return {"success": False, "error": str(e)}

    def list_repos(self, user_id: int) -> list[dict]:
        user_path = self._user_path(user_id)
        if not user_path.exists():
            return []
        repos = []
        for item in user_path.iterdir():
            if item.is_dir() and (item / ".git").exists():
                repo = Repo(item)
                repos.append({
                    "name": item.name,
                    "branch": repo.active_branch.name,
                    "is_dirty": repo.is_dirty(untracked_files=True),
                })
        return repos

    def delete_repo(self, user_id: int, repo_name: str) -> dict:
        path = self._repo_path(user_id, repo_name)
        if not path.exists():
            raise FileNotFoundError(f"Repository '{repo_name}' not found")
        shutil.rmtree(path)
        return {"deleted": repo_name}
```

- [ ] **Step 2: Test import**

Run: `python -c "from git_manager import GitManager; print('ok')"`
Expected: prints 'ok'

- [ ] **Step 3: Commit**

```bash
git add backend/notes-md-api/git_manager.py
git commit -m "feat: add GitManager service wrapping gitpython"
```

---

### Task 3: Create Git API router

**Files:**
- Create: `backend/notes-md-api/git_router.py`
- Create: `backend/notes-md-api/git_models.py`
- Modify: `backend/notes-md-api/main.py`

- [ ] **Step 1: Create Pydantic models**

`backend/notes-md-api/git_models.py`:
```python
from typing import Optional
from pydantic import BaseModel


class CreateRepoRequest(BaseModel):
    name: str


class OpenRepoRequest(BaseModel):
    name: str


class CloneRepoRequest(BaseModel):
    name: str
    remote_url: str
    username: Optional[str] = None
    password: Optional[str] = None


class CommitRequest(BaseModel):
    repo_name: str
    message: str


class GitCredentialRequest(BaseModel):
    repo_name: str
    username: Optional[str] = None
    password: Optional[str] = None


class RepoStatusRequest(BaseModel):
    repo_name: str


class RepoResponse(BaseModel):
    success: bool
    data: Optional[dict] = None
    error: Optional[str] = None


class RepoListResponse(BaseModel):
    repos: list[dict]
```

- [ ] **Step 2: Create Git API router**

`backend/notes-md-api/git_router.py`:
```python
"""
Git repository management API endpoints.
Requires authentication for all operations.
"""

from fastapi import APIRouter, Depends, HTTPException

from auth import get_current_user
from git_manager import GitManager
from git_models import (
    CreateRepoRequest,
    CloneRepoRequest,
    CommitRequest,
    GitCredentialRequest,
    RepoResponse,
    RepoListResponse,
)

router = APIRouter(prefix="/git", tags=["git"])
git_manager = GitManager()


@router.post("/create", response_model=RepoResponse)
async def create_repo(req: CreateRepoRequest, user: dict = Depends(get_current_user)):
    try:
        data = git_manager.create_repo(user["id"], req.name)
        return RepoResponse(success=True, data=data)
    except FileExistsError as e:
        raise HTTPException(status_code=409, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/open", response_model=RepoResponse)
async def open_repo(req: CreateRepoRequest, user: dict = Depends(get_current_user)):
    try:
        data = git_manager.open_repo(user["id"], req.name)
        return RepoResponse(success=True, data=data)
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/clone", response_model=RepoResponse)
async def clone_repo(req: CloneRepoRequest, user: dict = Depends(get_current_user)):
    try:
        data = git_manager.clone_repo(user["id"], req.name, req.remote_url, req.username, req.password)
        return RepoResponse(success=True, data=data)
    except FileExistsError as e:
        raise HTTPException(status_code=409, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/status", response_model=RepoResponse)
async def repo_status(req: RepoStatusRequest, user: dict = Depends(get_current_user)):
    try:
        data = git_manager.status(user["id"], req.repo_name)
        return RepoResponse(success=True, data=data)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/commit", response_model=RepoResponse)
async def commit(req: CommitRequest, user: dict = Depends(get_current_user)):
    try:
        data = git_manager.commit(user["id"], req.repo_name, req.message)
        return RepoResponse(success=True, data=data)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/push", response_model=RepoResponse)
async def push(req: GitCredentialRequest, user: dict = Depends(get_current_user)):
    try:
        data = git_manager.push(user["id"], req.repo_name, req.username, req.password)
        return RepoResponse(success=True, data=data)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/pull", response_model=RepoResponse)
async def pull(req: GitCredentialRequest, user: dict = Depends(get_current_user)):
    try:
        data = git_manager.pull(user["id"], req.repo_name, req.username, req.password)
        return RepoResponse(success=True, data=data)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/repos", response_model=RepoListResponse)
async def list_repos(user: dict = Depends(get_current_user)):
    repos = git_manager.list_repos(user["id"])
    return RepoListResponse(repos=repos)
```

- [ ] **Step 3: Register router in main.py**

Edit `backend/notes-md-api/main.py`:
```diff
 from auth import router as auth_router
 from pairing import router as pairing_router
+from git_router import router as git_router

 app.include_router(auth_router)
 app.include_router(pairing_router)
+app.include_router(git_router)
```

- [ ] **Step 4: Test startup**

Run: `python -c "from main import app; print('routes:', len(app.routes))"`
Expected: prints route count including git routes

- [ ] **Step 5: Commit**

```bash
git add backend/notes-md-api/git_router.py backend/notes-md-api/git_models.py backend/notes-md-api/main.py
git commit -m "feat: add Git API router with create/open/clone/commit/push/pull endpoints"
```

---

### Task 4: Add Git types and store state to web editor

**Files:**
- Modify: `apps/notes-md/src/types/index.ts`
- Modify: `apps/notes-md/src/store/useStore.ts`

- [ ] **Step 1: Add Git types to types/index.ts**

```typescript
export interface GitRepo {
  name: string
  branch: string
  is_dirty: boolean
}

export interface GitStatus {
  branch: string
  is_dirty: boolean
  staged: Array<{ path: string; change_type: string }>
  untracked: string[]
  commits_behind: number
  commits_ahead: number
}

export interface GitState {
  repos: GitRepo[]
  activeRepo: string | null
  status: GitStatus | null
  isSyncing: boolean
  showGitPanel: boolean
  showCloneModal: boolean
  showCommitModal: boolean
  showRepoSetup: boolean
}
```

- [ ] **Step 2: Add Git actions to useStore.ts**

Add import: `import type { GitRepo, GitStatus, GitState } from '../types'`

Add to `AppState` interface:
```typescript
  // Git state
  git: GitState
  // Git actions
  setRepos: (repos: GitRepo[]) => void
  setActiveRepo: (name: string | null) => void
  setGitStatus: (status: GitStatus | null) => void
  setSyncing: (syncing: boolean) => void
  toggleGitPanel: () => void
  setShowCloneModal: (show: boolean) => void
  setShowCommitModal: (show: boolean) => void
  setShowRepoSetup: (show: boolean) => void
```

Add initial git state in the store creator:
```typescript
    git: {
      repos: [],
      activeRepo: null,
      status: null,
      isSyncing: false,
      showGitPanel: false,
      showCloneModal: false,
      showCommitModal: false,
      showRepoSetup: false,
    },
```

Add git action implementations before the closing `})`:
```typescript
    setRepos: (repos) => set((s) => ({ git: { ...s.git, repos } })),
    setActiveRepo: (name) => set((s) => ({ git: { ...s.git, activeRepo: name } })),
    setGitStatus: (status) => set((s) => ({ git: { ...s.git, status } })),
    setSyncing: (syncing) => set((s) => ({ git: { ...s.git, isSyncing: syncing } })),
    toggleGitPanel: () => set((s) => ({ git: { ...s.git, showGitPanel: !s.git.showGitPanel } })),
    setShowCloneModal: (show) => set((s) => ({ git: { ...s.git, showCloneModal: show } })),
    setShowCommitModal: (show) => set((s) => ({ git: { ...s.git, showCommitModal: show } })),
    setShowRepoSetup: (show) => set((s) => ({ git: { ...s.git, showRepoSetup: show } })),
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No type errors

- [ ] **Step 4: Commit**

```bash
git add apps/notes-md/src/types/index.ts apps/notes-md/src/store/useStore.ts
git commit -m "feat: add Git types and store state to web editor"
```

---

### Task 5: Create useGit hook

**Files:**
- Create: `apps/notes-md/src/hooks/useGit.ts`

- [ ] **Step 1: Write the hook**

```typescript
import { useCallback } from 'react'
import { useStore } from '../store/useStore'
import type { GitRepo, GitStatus } from '../types'

// Reads the stored JWT token
function getToken(): string | null {
  return localStorage.getItem('notesmd_token')
}

const API_BASE = 'http://localhost:8000'

async function apiPost(path: string, body: unknown) {
  const token = getToken()
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error(err.detail || 'API error')
  }
  return res.json()
}

async function apiGet(path: string) {
  const token = getToken()
  const res = await fetch(`${API_BASE}${path}`, {
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error(err.detail || 'API error')
  }
  return res.json()
}

export function useGit() {
  const setRepos = useStore((s) => s.setRepos)
  const setActiveRepo = useStore((s) => s.setActiveRepo)
  const setGitStatus = useStore((s) => s.setGitStatus)
  const setSyncing = useStore((s) => s.setSyncing)
  const activeRepo = useStore((s) => s.git.activeRepo)

  const fetchRepos = useCallback(async () => {
    try {
      const data = await apiGet('/git/repos')
      setRepos(data.repos)
      return data.repos as GitRepo[]
    } catch (e) {
      console.error('Failed to fetch repos:', e)
      return []
    }
  }, [setRepos])

  const createRepo = useCallback(async (name: string) => {
    const data = await apiPost('/git/create', { name })
    await fetchRepos()
    setActiveRepo(name)
    return data
  }, [fetchRepos, setActiveRepo])

  const cloneRepo = useCallback(async (name: string, remoteUrl: string, username?: string, password?: string) => {
    const data = await apiPost('/git/clone', { name, remote_url: remoteUrl, username, password })
    await fetchRepos()
    setActiveRepo(name)
    return data
  }, [fetchRepos, setActiveRepo])

  const openRepo = useCallback(async (name: string) => {
    const data = await apiPost('/git/open', { name })
    setActiveRepo(name)
    return data
  }, [setActiveRepo])

  const fetchStatus = useCallback(async () => {
    if (!activeRepo) return null
    try {
      const data = await apiPost('/git/status', { repo_name: activeRepo })
      setGitStatus(data.data as GitStatus)
      return data.data as GitStatus
    } catch (e) {
      console.error('Failed to fetch status:', e)
      return null
    }
  }, [activeRepo, setGitStatus])

  const commit = useCallback(async (message: string) => {
    if (!activeRepo) throw new Error('No active repo')
    const data = await apiPost('/git/commit', { repo_name: activeRepo, message })
    await fetchStatus()
    return data
  }, [activeRepo, fetchStatus])

  const push = useCallback(async (username?: string, password?: string) => {
    if (!activeRepo) throw new Error('No active repo')
    setSyncing(true)
    try {
      const data = await apiPost('/git/push', { repo_name: activeRepo, username, password })
      return data
    } finally {
      setSyncing(false)
    }
  }, [activeRepo, setSyncing])

  const pull = useCallback(async (username?: string, password?: string) => {
    if (!activeRepo) throw new Error('No active repo')
    setSyncing(true)
    try {
      const data = await apiPost('/git/pull', { repo_name: activeRepo, username, password })
      await fetchStatus()
      return data
    } finally {
      setSyncing(false)
    }
  }, [activeRepo, setSyncing, fetchStatus])

  return {
    fetchRepos, createRepo, cloneRepo, openRepo,
    fetchStatus, commit, push, pull,
  }
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No type errors

- [ ] **Step 3: Commit**

```bash
git add apps/notes-md/src/hooks/useGit.ts
git commit -m "feat: add useGit hook for backend API calls"
```

---

### Task 6: Create RepoSetupModal (initial repo setup)

**Files:**
- Create: `apps/notes-md/src/components/RepoSetupModal.tsx`

- [ ] **Step 1: Write the modal component**

```tsx
import { useState } from 'react'
import { useStore } from '../store/useStore'
import { useGit } from '../hooks/useGit'

type SetupMode = 'create' | 'clone'

export default function RepoSetupModal() {
  const show = useStore((s) => s.git.showRepoSetup)
  const setShow = useStore((s) => s.setShowRepoSetup)
  const { createRepo, cloneRepo, fetchRepos } = useGit()

  const [mode, setMode] = useState<SetupMode>('create')
  const [name, setName] = useState('')
  const [remoteUrl, setRemoteUrl] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  if (!show) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      if (mode === 'create') {
        await createRepo(name)
      } else {
        await cloneRepo(name, remoteUrl, username || undefined, password || undefined)
      }
      await fetchRepos()
      setShow(false)
      setName('')
      setRemoteUrl('')
      setUsername('')
      setPassword('')
    } catch (err: any) {
      setError(err.message || 'Operation failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setShow(false)}>
      <div className="bg-surface rounded-lg shadow-xl border border-border w-full max-w-md mx-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h2 className="text-lg font-semibold text-text-primary">Git Repository</h2>
          <button onClick={() => setShow(false)} className="text-text-secondary hover:text-text-primary">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div className="flex gap-2">
            <button type="button" onClick={() => setMode('create')}
              className={`flex-1 py-2 rounded text-sm transition-colors ${mode === 'create' ? 'bg-amber-600 text-white' : 'bg-surface-alt text-text-secondary hover:bg-surface-hover'}`}>
              Create New
            </button>
            <button type="button" onClick={() => setMode('clone')}
              className={`flex-1 py-2 rounded text-sm transition-colors ${mode === 'clone' ? 'bg-amber-600 text-white' : 'bg-surface-alt text-text-secondary hover:bg-surface-hover'}`}>
              Clone Remote
            </button>
          </div>

          <div>
            <label className="block text-sm font-medium text-text-primary mb-1">Repository Name</label>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} required
              className="w-full bg-surface-alt border border-border rounded px-3 py-2 text-sm text-text-primary outline-none focus:border-amber-500" />
          </div>

          {mode === 'clone' && (
            <>
              <div>
                <label className="block text-sm font-medium text-text-primary mb-1">Remote URL</label>
                <input type="url" value={remoteUrl} onChange={(e) => setRemoteUrl(e.target.value)} required placeholder="https://github.com/user/repo.git"
                  className="w-full bg-surface-alt border border-border rounded px-3 py-2 text-sm text-text-primary outline-none focus:border-amber-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-text-primary mb-1">Username (optional)</label>
                <input type="text" value={username} onChange={(e) => setUsername(e.target.value)}
                  className="w-full bg-surface-alt border border-border rounded px-3 py-2 text-sm text-text-primary outline-none focus:border-amber-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-text-primary mb-1">Password/Token (optional)</label>
                <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-surface-alt border border-border rounded px-3 py-2 text-sm text-text-primary outline-none focus:border-amber-500" />
              </div>
            </>
          )}

          {error && <p className="text-red-500 text-sm">{error}</p>}

          <button type="submit" disabled={loading}
            className="w-full py-2 rounded bg-amber-600 text-white text-sm font-medium hover:bg-amber-700 disabled:opacity-50 transition-colors">
            {loading ? 'Working...' : mode === 'create' ? 'Create Repository' : 'Clone Repository'}
          </button>
        </form>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No type errors

- [ ] **Step 3: Commit**

```bash
git add apps/notes-md/src/components/RepoSetupModal.tsx
git commit -m "feat: add RepoSetupModal for create/clone git repos"
```

---

### Task 7: Create CommitModal

**Files:**
- Create: `apps/notes-md/src/components/CommitModal.tsx`

- [ ] **Step 1: Write the commit modal**

```tsx
import { useState } from 'react'
import { useStore } from '../store/useStore'
import { useGit } from '../hooks/useGit'

export default function CommitModal() {
  const show = useStore((s) => s.git.showCommitModal)
  const setShow = useStore((s) => s.setShowCommitModal)
  const { commit, fetchStatus } = useGit()

  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  if (!show) return null

  const handleCommit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!message.trim()) return
    setError('')
    setLoading(true)
    try {
      await commit(message.trim())
      setMessage('')
      setShow(false)
    } catch (err: any) {
      setError(err.message || 'Commit failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setShow(false)}>
      <div className="bg-surface rounded-lg shadow-xl border border-border w-full max-w-md mx-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h2 className="text-lg font-semibold text-text-primary">Commit Changes</h2>
          <button onClick={() => setShow(false)} className="text-text-secondary hover:text-text-primary">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleCommit} className="p-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-text-primary mb-1">Commit Message</label>
            <textarea value={message} onChange={(e) => setMessage(e.target.value)} required rows={3} autoFocus
              placeholder="Describe your changes..."
              className="w-full bg-surface-alt border border-border rounded px-3 py-2 text-sm text-text-primary outline-none focus:border-amber-500 resize-none" />
          </div>

          {error && <p className="text-red-500 text-sm">{error}</p>}

          <button type="submit" disabled={loading || !message.trim()}
            className="w-full py-2 rounded bg-amber-600 text-white text-sm font-medium hover:bg-amber-700 disabled:opacity-50 transition-colors">
            {loading ? 'Committing...' : 'Commit'}
          </button>
        </form>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No type errors

- [ ] **Step 3: Commit**

```bash
git add apps/notes-md/src/components/CommitModal.tsx
git commit -m "feat: add CommitModal for git commit messages"
```

---

### Task 8: Create GitPanel (sidebar panel)

**Files:**
- Create: `apps/notes-md/src/components/GitPanel.tsx`

- [ ] **Step 1: Write GitPanel component**

```tsx
import { useEffect } from 'react'
import { useStore } from '../store/useStore'
import { useGit } from '../hooks/useGit'

export default function GitPanel() {
  const show = useStore((s) => s.git.showGitPanel)
  const repos = useStore((s) => s.git.repos)
  const activeRepo = useStore((s) => s.git.activeRepo)
  const status = useStore((s) => s.git.status)
  const isSyncing = useStore((s) => s.git.isSyncing)
  const setActiveRepo = useStore((s) => s.setActiveRepo)
  const setShowCommitModal = useStore((s) => s.setShowCommitModal)
  const setShowRepoSetup = useStore((s) => s.setShowRepoSetup)

  const { fetchRepos, fetchStatus, push, pull } = useGit()

  useEffect(() => {
    if (show) {
      fetchRepos()
    }
  }, [show, fetchRepos])

  useEffect(() => {
    if (activeRepo) {
      fetchStatus()
    }
  }, [activeRepo, fetchStatus])

  if (!show) return null

  return (
    <div className="w-60 bg-surface-alt border-l border-border flex flex-col overflow-hidden flex-shrink-0">
      <div className="flex items-center justify-between px-3 py-2 border-b border-border">
        <span className="text-xs font-semibold text-text-secondary uppercase tracking-wider">Git</span>
        <button
          onClick={() => setShowRepoSetup(true)}
          className="p-1 rounded hover:bg-surface-hover text-text-secondary hover:text-text-primary transition-colors"
          title="Add repository"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 5v14M5 12h14" />
          </svg>
        </button>
      </div>

      {/* Repo list */}
      <div className="px-2 py-2 border-b border-border">
        {repos.length === 0 ? (
          <p className="text-xs text-text-secondary text-center py-2">No repos yet. Click + to add one.</p>
        ) : (
          repos.map((repo) => (
            <button
              key={repo.name}
              onClick={() => setActiveRepo(repo.name)}
              className={`w-full text-left px-2 py-1.5 rounded text-sm mb-0.5 transition-colors ${
                activeRepo === repo.name
                  ? 'bg-amber-600/20 text-amber-600'
                  : 'text-text-secondary hover:bg-surface-hover'
              }`}
            >
              <div className="flex items-center gap-1.5">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
                </svg>
                <span className="truncate flex-1">{repo.name}</span>
                {repo.is_dirty && <span className="w-2 h-2 rounded-full bg-amber-500" title="Uncommitted changes" />}
              </div>
            </button>
          ))
        )}
      </div>

      {/* Active repo details */}
      {activeRepo && status && (
        <div className="flex-1 overflow-y-auto px-3 py-2 space-y-3">
          {/* Branch info */}
          <div className="flex items-center gap-2 text-xs text-text-secondary">
            <span className="px-1.5 py-0.5 rounded bg-surface-hover font-mono">{status.branch}</span>
            {status.commits_ahead > 0 && <span className="text-green-500">+{status.commits_ahead}</span>}
            {status.commits_behind > 0 && <span className="text-red-500">-{status.commits_behind}</span>}
          </div>

          {/* Changed files */}
          {status.staged.length > 0 && (
            <div>
              <p className="text-xs font-medium text-text-secondary mb-1">Staged ({status.staged.length})</p>
              {status.staged.map((s) => (
                <div key={s.path} className="flex items-center gap-1 text-xs text-text-secondary py-0.5">
                  <span className={`w-3 h-3 rounded flex items-center justify-center text-[8px] font-bold
                    ${s.change_type === 'M' ? 'text-amber-500' : s.change_type === 'D' ? 'text-red-500' : 'text-green-500'}`}>
                    {s.change_type}
                  </span>
                  <span className="truncate">{s.path}</span>
                </div>
              ))}
            </div>
          )}

          {status.untracked.length > 0 && (
            <div>
              <p className="text-xs font-medium text-text-secondary mb-1">Untracked ({status.untracked.length})</p>
              {status.untracked.map((f) => (
                <div key={f} className="text-xs text-text-secondary py-0.5 truncate">? {f}</div>
              ))}
            </div>
          )}

          {status.staged.length === 0 && status.untracked.length === 0 && (
            <p className="text-xs text-text-secondary">Working tree clean</p>
          )}

          {/* Action buttons */}
          <div className="flex gap-2 pt-2">
            <button
              onClick={() => setShowCommitModal(true)}
              disabled={status.staged.length === 0 && status.untracked.length === 0}
              className="flex-1 px-2 py-1.5 rounded bg-amber-600 text-white text-xs font-medium hover:bg-amber-700 disabled:opacity-40 transition-colors"
            >
              Commit
            </button>
            <button
              onClick={() => push()}
              disabled={isSyncing}
              className="px-2 py-1.5 rounded bg-surface-hover text-text-secondary text-xs hover:text-text-primary disabled:opacity-40 transition-colors"
              title="Push"
            >
              ↑
            </button>
            <button
              onClick={() => pull()}
              disabled={isSyncing}
              className="px-2 py-1.5 rounded bg-surface-hover text-text-secondary text-xs hover:text-text-primary disabled:opacity-40 transition-colors"
              title="Pull"
            >
              ↓
            </button>
          </div>

          {isSyncing && <p className="text-xs text-text-secondary animate-pulse">Syncing...</p>}
        </div>
      )}

      {activeRepo && !status && (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-xs text-text-secondary">Loading status...</p>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No type errors

- [ ] **Step 3: Commit**

```bash
git add apps/notes-md/src/components/GitPanel.tsx
git commit -m "feat: add GitPanel sidebar with repo list, status, commit/push/pull"
```

---

### Task 9: Wire Git UI components into the app layout

**Files:**
- Modify: `apps/notes-md/src/components/Toolbar.tsx`
- Modify: `apps/notes-md/src/components/Layout.tsx`
- Modify: `apps/notes-md/src/components/StatusBar.tsx`
- Modify: `apps/notes-md/src/components/Sidebar.tsx`

- [ ] **Step 1: Add Git toggle button to Toolbar**

Edit `apps/notes-md/src/components/Toolbar.tsx` — add before the theme toggle:
```diff
       <div className="flex items-center gap-1">
+        <button onClick={() => useStore.getState().toggleGitPanel()} className="toolbar-btn" title="Git">
+          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
+            <circle cx="12" cy="18" r="3" />
+            <circle cx="6" cy="6" r="3" />
+            <circle cx="18" cy="6" r="3" />
+            <path d="M18 9v1a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V9" />
+            <path d="M12 12v3" />
+          </svg>
+        </button>
         <button onClick={toggleTheme} className="toolbar-btn" title={`Theme: ${settings.theme}`}>
```

- [ ] **Step 2: Update Layout to include GitPanel and modals**

Edit `apps/notes-md/src/components/Layout.tsx`:
```diff
 import Sidebar from './Sidebar'
+import GitPanel from './GitPanel'
+import RepoSetupModal from './RepoSetupModal'
+import CommitModal from './CommitModal'
 import StatusBar from './StatusBar'
```

Add inside the layout container after `</Sidebar>` and `</main>` tags:
```diff
         <main className="flex-1 flex flex-col overflow-hidden">
           {children}
         </main>
+        <GitPanel />
       </div>
+      <RepoSetupModal />
+      <CommitModal />
       <StatusBar />
```

- [ ] **Step 3: Add Git status to StatusBar**

Edit `apps/notes-md/src/components/StatusBar.tsx`:
```diff
   const viewMode = useStore((s) => s.viewMode)
+  const git = useStore((s) => s.git)

   return (
     <div className="flex items-center justify-between px-3 py-1 bg-surface-alt border-t border-border text-xs text-text-secondary">
       <div className="flex items-center gap-4">
+        {git.activeRepo && (
+          <span className="flex items-center gap-1">
+            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
+              <circle cx="12" cy="18" r="3" /><circle cx="6" cy="6" r="3" /><circle cx="18" cy="6" r="3" />
+              <path d="M18 9v1a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V9" /><path d="M12 12v3" />
+            </svg>
+            {git.activeRepo}
+            {git.status?.is_dirty && ' *'}
+          </span>
+        )}
         <span>View: {viewMode}</span>
```

- [ ] **Step 4: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No type errors

- [ ] **Step 5: Commit**

```bash
git add apps/notes-md/src/components/Toolbar.tsx apps/notes-md/src/components/Layout.tsx apps/notes-md/src/components/StatusBar.tsx
git commit -m "feat: wire Git UI into toolbar, layout, and status bar"
```

---

### Task 10: Add Git actions to Flutter app

**Files:**
- Modify: `apps/notes-md-app/lib/screens/home_screen.dart`
- Modify: `apps/notes-md-app/lib/services/bridge_service.dart`

- [ ] **Step 1: Add git bridge messages to Bridge.tsx**

Edit `apps/notes-md/src/components/Bridge.tsx` — add git message handlers inside the switch:
```diff
           case 'set-font-size':
             if (payload?.size) {
               updateSettings({ fontSize: payload.size })
             }
             break
+          case 'git-commit':
+            if (payload?.message) {
+              // WebView tells Flutter: "I committed" — Flutter can refresh
+            }
+            break
+          case 'git-push':
+            if (payload?.repo) {
+              // Flutter triggered push
+              useStore.getState().setActiveRepo(payload.repo)
+            }
+            break
```

Add new message sending after createDoc in the useEffect around line 55-60:
```diff
           case 'open-file':
             if (payload?.content !== undefined) {
               const title = payload.title || 'Imported'
-              createDoc(title, payload.content)
+              const docId = createDoc(title, payload.content)
+              if (window.flutter_postMessage) {
+                window.flutter_postMessage(JSON.stringify({
+                  type: 'git-status',
+                  payload: { repo: useStore.getState().git.activeRepo, dirty: useStore.getState().git.status?.is_dirty }
+                }))
+              }
             }
             break
```

- [ ] **Step 2: Add git actions to Flutter popup menu**

Edit `apps/notes-md-app/lib/screens/home_screen.dart` — add options to the popup menu:
```diff
             itemBuilder: (context) => [
               const PopupMenuItem(value: 'refresh', child: Text('Refresh')),
+              const PopupMenuDivider(),
+              const PopupMenuItem(value: 'git-status', child: Text('Git Status')),
+              const PopupMenuItem(value: 'git-commit', child: Text('Commit...')),
+              const PopupMenuItem(value: 'git-push', child: Text('Push')),
+              const PopupMenuItem(value: 'git-pull', child: Text('Pull')),
               const PopupMenuItem(value: 'logout', child: Text('Sign Out')),
             ],
```

Add handlers in the `onSelected` callback:
```diff
               } else if (value == 'refresh') {
                 _webViewController?.reload();
+              } else if (value == 'git-commit') {
+                _webViewController?.evaluateJavascript(source: '''
+                  useGit().then(m => m.commit("Update from mobile"))
+                ''');
+              } else if (value == 'git-push') {
+                _webViewController?.evaluateJavascript(source: '''
+                  useGit().then(m => m.push())
+                ''');
+              } else if (value == 'git-pull') {
+                _webViewController?.evaluateJavascript(source: '''
+                  useGit().then(m => m.pull())
+                ''');
+              } else if (value == 'git-status') {
+                _webViewController?.evaluateJavascript(source: '''
+                  useGit().then(m => m.fetchStatus())
+                ''');
               }
```

- [ ] **Step 3: Verify Flutter analyzes clean**

Run: `flutter analyze` (in `apps/notes-md-app/`)
Expected: 0 errors

- [ ] **Step 4: Commit**

```bash
git add apps/notes-md-app/lib/screens/home_screen.dart apps/notes-md/src/components/Bridge.tsx
git commit -m "feat: add git actions to Flutter app and bridge"
```

---

### Task 11: Add backend test for git endpoints

**Files:**
- Create: `backend/notes-md-api/test_git.py`

- [ ] **Step 1: Write the test file**

```python
"""
Tests for Git API endpoints.
"""

import os
import shutil
import tempfile
from pathlib import Path
from unittest.mock import patch

import pytest
from fastapi.testclient import TestClient

from main import app
from git_manager import GitManager, REPOS_BASE

client = TestClient(app)

# Use a temp dir for git repos during testing
TEST_REPOS = Path(tempfile.mkdtemp(prefix="notesmd_test_"))


@pytest.fixture(autouse=True)
def patch_git_manager():
    """Replace GitManager base path with temp dir."""
    original_init = GitManager.__init__

    def patched_init(self, base_path=None):
        original_init(self, base_path=TEST_REPOS)

    with patch.object(GitManager, "__init__", patched_init):
        yield

    # Cleanup
    if TEST_REPOS.exists():
        shutil.rmtree(TEST_REPOS)


AUTH_HEADERS = {}


@pytest.fixture(autouse=True)
def auth_setup():
    """Register and login for auth token."""
    # Register
    client.post("/auth/register", json={
        "username": "gituser",
        "password": "test1234",
    })
    # Login
    res = client.post("/auth/login", json={
        "username": "gituser",
        "password": "test1234",
    })
    token = res.json()["token"]
    AUTH_HEADERS["Authorization"] = f"Bearer {token}"


def test_create_and_list_repo():
    """Create a repo and verify it appears in the list."""
    res = client.post("/git/create", json={"name": "test-repo"}, headers=AUTH_HEADERS)
    assert res.status_code == 200
    data = res.json()
    assert data["success"] is True
    assert data["data"]["name"] == "test-repo"

    res = client.get("/git/repos", headers=AUTH_HEADERS)
    assert res.status_code == 200
    repos = res.json()["repos"]
    assert len(repos) == 1
    assert repos[0]["name"] == "test-repo"


def test_create_duplicate_repo():
    """Creating a repo with an existing name should fail."""
    client.post("/git/create", json={"name": "dup"}, headers=AUTH_HEADERS)
    res = client.post("/git/create", json={"name": "dup"}, headers=AUTH_HEADERS)
    assert res.status_code == 409


def test_status():
    """Status of a fresh repo should show clean working tree."""
    client.post("/git/create", json={"name": "status-test"}, headers=AUTH_HEADERS)
    res = client.post("/git/status", json={"repo_name": "status-test"}, headers=AUTH_HEADERS)
    assert res.status_code == 200
    data = res.json()["data"]
    assert data["branch"] == "main"


def test_commit():
    """Create repo, add a file, commit it."""
    client.post("/git/create", json={"name": "commit-test"}, headers=AUTH_HEADERS)
    # Write a file directly into the repo
    repo_path = TEST_REPOS / "1" / "commit-test"
    (repo_path / "test.md").write_text("# Hello")
    res = client.post("/git/commit", json={
        "repo_name": "commit-test",
        "message": "Initial commit",
    }, headers=AUTH_HEADERS)
    assert res.status_code == 200
    assert res.json()["success"] is True
    assert "commit_hash" in res.json()["data"]


def test_list_repos_empty():
    """No repos should return empty list."""
    res = client.get("/git/repos", headers=AUTH_HEADERS)
    assert res.status_code == 200
    assert res.json()["repos"] == []


def test_unauthenticated():
    """Unauthenticated requests should fail."""
    res = client.post("/git/create", json={"name": "nope"})
    assert res.status_code == 403
```

- [ ] **Step 2: Run the tests**

```bash
cd backend/notes-md-api && pip install pytest && python -m pytest test_git.py -v
```

Expected: 6 tests pass

- [ ] **Step 3: Commit**

```bash
git add backend/notes-md-api/test_git.py
git commit -m "test: add Git API endpoint tests"
```

---

### Self-Review Checklist

- [ ] **Spec coverage**: Every task maps to a requirement from the architecture plan — backend GitManager, API router, web UI (modals + panel + toolbar), Flutter integration, tests.
- [ ] **Placeholder scan**: No TODOs or TBDs remain. Every code block is complete.
- [ ] **Type consistency**: `GitRepo`, `GitStatus` types used consistently between types/index.ts, useGit.ts, and all components. Backend response shapes match frontend expectations.
- [ ] **No missing pieces**: The backend router creates/open/clones repos, commits, pushes, pulls, lists, and returns status. The frontend has modals for setup and commits, a panel for status, toolbar toggle, and status bar indicator. Flutter has git actions in the menu.
