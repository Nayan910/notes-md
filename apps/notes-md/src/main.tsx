import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import App from './App'
import LoginPage from './components/LoginPage'
import PairPage from './components/PairPage'
import ProtectedRoute from './components/ProtectedRoute'
import { bootstrapStore } from './store/bootstrap'
import './index.css'

// Kick off async IDB rehydration as early as possible.
// The store is initialized synchronously with whatever localStorage has
// (which will be empty after the first migration). This promise resolves
// once IDB data is loaded and the store is updated.
bootstrapStore().catch((e) => {
  console.error('[main] Store bootstrap failed:', e);
})

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
