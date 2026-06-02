import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import App from './App'
import LoginPage from './components/LoginPage'
import PairPage from './components/PairPage'
import ProtectedRoute from './components/ProtectedRoute'
import { bootstrapStore } from './store/bootstrap'
import { useStore } from './store/useStore'
import { isBridgeAvailable, onBridgeEvent, loadFileList, loadFile } from './utils/bridge-storage'
import type { Document } from './types'
import './index.css'

// Kick off async IDB rehydration as early as possible.
// The store is initialized synchronously with whatever localStorage has
// (which will be empty after the first migration). This promise resolves
// once IDB data is loaded and the store is updated.
bootstrapStore().catch((e) => {
  console.error('[main] Store bootstrap failed:', e);
})

// Bridge event subscription. Runs at app start so we don't miss any
// `notes-list-updated` pushes that happen during login, etc. This is a
// no-op when running standalone in a browser (no Flutter bridge).
if (isBridgeAvailable()) {
  onBridgeEvent((event) => {
    if (event.type !== 'notes-list-updated') return
    void refreshFromBridge()
  })
}

function stripMdExt(name: string): string {
  return name.replace(/\.md$/i, '')
}

/**
 * Reload the doc list from the bridge. Mirrors the bootstrap logic but
 * preserves the currently active doc + any in-memory dirty edits.
 */
async function refreshFromBridge(): Promise<void> {
  try {
    const files = await loadFileList()
    if (files.length === 0) {
      // Files were deleted out from under us — keep the in-memory docs
      // but mark them path-less so future writes don't try to persist
      // to a missing file.
      return
    }
    const settled = await Promise.allSettled(files.map((f) => loadFile(f.path)))
    const state = useStore.getState()
    const existingByPath = new Map<string, Document>()
    for (const d of state.docs) {
      if (d.path) existingByPath.set(d.path, d)
    }

    const freshDocs: Document[] = []
    settled.forEach((r, idx) => {
      const file = files[idx]
      if (r.status !== 'fulfilled') return
      const existing = existingByPath.get(file.path)
      if (existing) {
        freshDocs.push({ ...existing, title: stripMdExt(file.name) || existing.title })
      } else {
        freshDocs.push({
          id: `path:${file.path}`,
          title: stripMdExt(file.name),
          content: r.value.content,
          path: file.path,
          createdAt: file.modified || Date.now(),
          updatedAt: file.modified || Date.now(),
        })
      }
    })
    useStore.setState({ docs: freshDocs })

    // If the previously active doc is no longer in the list, switch to
    // the first available file.
    const activeId = useStore.getState().activeDocId
    if (activeId && !freshDocs.some((d) => d.id === activeId)) {
      useStore.setState({ activeDocId: freshDocs[0]?.id ?? null })
    }
  } catch (e) {
    console.warn('[main] refreshFromBridge failed:', e)
  }
}

function Root() {
  const { user } = useAuth()

  return (
    <Routes>
      <Route
        path="/login"
        element={user ? <Navigate to="/" replace /> : <LoginPage />}
      />
      <Route
        path="/pair"
        element={user ? <PairPage /> : <Navigate to="/login" replace />}
      />
      <Route
        path="/*"
        element={
          <ProtectedRoute>
            <App />
          </ProtectedRoute>
        }
      />
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
  </StrictMode>,
)
