import { createContext, useContext, useState, useEffect, ReactNode } from 'react'

interface User {
  id: number
  username: string
}

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
  const [loading, setLoading] = useState(true)

  // Restore session from localStorage on mount
  useEffect(() => {
    const t = localStorage.getItem('notesmd_token')
    const u = localStorage.getItem('notesmd_user')
    if (t && u) {
      setToken(t)
      setUser(JSON.parse(u))
      // Verify token is still valid
      fetch(`${API}/auth/me`, { headers: { Authorization: `Bearer ${t}` } })
        .then(r => {
          if (!r.ok) logout()
        })
        .catch(() => logout())
        .finally(() => setLoading(false))
    } else {
      setLoading(false)
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
    if (!res.ok) {
      const err = await res.json()
      throw new Error(err.detail || 'Login failed')
    }
    const data = await res.json()
    setAuth(data.token, data.user)
  }

  async function register(username: string, password: string) {
    const res = await fetch(`${API}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    })
    if (!res.ok) {
      const err = await res.json()
      throw new Error(err.detail || 'Registration failed')
    }
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
      {loading ? (
        <div className="min-h-screen flex items-center justify-center bg-white dark:bg-gray-900">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
        </div>
      ) : (
        children
      )}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
