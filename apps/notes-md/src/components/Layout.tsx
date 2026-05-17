import { Link, useNavigate } from 'react-router-dom'
import { useStore } from '../store/useStore'
import { useAuth } from '../context/AuthContext'
import TabBar from './TabBar'
import Sidebar from './Sidebar'
import Editor from './Editor'
import Preview from './Preview'
import Toolbar from './Toolbar'
import StatusBar from './StatusBar'
import WelcomeScreen from './WelcomeScreen'
import SettingsModal from './SettingsModal'

function UserBadge({ user, logout }: { user: { username: string } | null; logout: () => void }) {
  const navigate = useNavigate()
  if (!user) return null
  return (
    <div className="flex items-center justify-end gap-3 px-3 py-1.5 bg-surface-alt border-t border-border text-xs">
      <span className="text-text-secondary">
        <span className="font-medium text-text-primary">{user.username}</span>
      </span>
      <Link to="/pair" className="text-accent hover:text-accent-hover hover:underline">
        Pair Device
      </Link>
      <button
        onClick={() => { logout(); navigate('/login') }}
        className="text-text-secondary hover:text-red-500 transition-colors"
      >
        Sign out
      </button>
    </div>
  )
}

function EditorArea() {
  const viewMode = useStore((s) => s.viewMode)
  const sideBySide = useStore((s) => s.settings.sideBySide)
  const showEdit = viewMode === 'edit' || viewMode === 'both'
  const showPreview = viewMode === 'preview' || viewMode === 'both'

  return (
    <div className="flex-1 flex overflow-hidden">
      {showEdit && (
        <div className={`flex-1 overflow-hidden ${showPreview && sideBySide ? 'border-r border-border' : ''}`}
          style={{ minWidth: showPreview && sideBySide ? '40%' : '100%' }}>
          <Editor />
        </div>
      )}
      {showPreview && (
        <div className="flex-1 overflow-hidden" style={{ minWidth: showEdit && sideBySide ? '40%' : '100%' }}>
          <Preview />
        </div>
      )}
    </div>
  )
}

function ClassicLayout() {
  const { user, logout } = useAuth()
  const showSidebar = useStore((s) => s.settings.showSidebar)
  const docs = useStore((s) => s.docs)

  if (docs.length === 0) {
    return (
      <div className="h-full flex flex-col">
        <Toolbar />
        <div className="flex-1 flex items-center justify-center">
          <WelcomeScreen />
        </div>
        <StatusBar />
        <UserBadge user={user} logout={logout} />
        <SettingsModal />
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col">
      <Toolbar />
      <div className="flex flex-1 overflow-hidden">
        {showSidebar && <Sidebar />}
        <div className="flex-1 flex flex-col overflow-hidden">
          <TabBar />
          <EditorArea />
        </div>
      </div>
      <StatusBar />
      <UserBadge user={user} logout={logout} />
      <SettingsModal />
    </div>
  )
}

function VSCodeLayout() {
  const { user, logout } = useAuth()
  const docs = useStore((s) => s.docs)
  const showSidebar = useStore((s) => s.settings.showSidebar)
  const setLayoutMode = useStore((s) => s.setLayoutMode)
  const toggleSettings = useStore((s) => s.toggleSettings)

  if (docs.length === 0) {
    return (
      <div className="h-full flex flex-col">
        <div className="flex flex-1 overflow-hidden">
          <nav className="w-11 bg-surface-alt border-r border-border flex flex-col items-center py-2 gap-2">
            <button onClick={() => setLayoutMode('classic')} className="w-8 h-8 flex items-center justify-center rounded text-text-secondary hover:text-text-primary hover:bg-surface-hover transition-colors" title="Switch layout">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>
            </button>
            <button onClick={toggleSettings} className="w-8 h-8 flex items-center justify-center rounded text-text-secondary hover:text-text-primary hover:bg-surface-hover transition-colors" title="Settings">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
            </button>
          </nav>
          <div className="flex-1 flex items-center justify-center">
            <WelcomeScreen />
          </div>
        </div>
        <UserBadge user={user} logout={logout} />
        <SettingsModal />
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col">
      <div className="flex flex-1 overflow-hidden">
        <nav className="w-11 bg-surface-alt border-r border-border flex flex-col items-center py-2 gap-2 flex-shrink-0">
          <button onClick={() => setLayoutMode('classic')} className="w-8 h-8 flex items-center justify-center rounded text-text-secondary hover:text-text-primary hover:bg-surface-hover transition-colors" title="Switch layout">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>
          </button>
          <button onClick={toggleSettings} className="w-8 h-8 flex items-center justify-center rounded text-text-secondary hover:text-text-primary hover:bg-surface-hover transition-colors" title="Settings">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
          </button>
        </nav>
        {showSidebar && <Sidebar />}
        <div className="flex-1 flex flex-col overflow-hidden">
          <TabBar />
          <EditorArea />
        </div>
      </div>
      <StatusBar />
      <UserBadge user={user} logout={logout} />
      <SettingsModal />
    </div>
  )
}

function NotesLayout() {
  const { user } = useAuth()
  const docs = useStore((s) => s.docs)
  const setLayoutMode = useStore((s) => s.setLayoutMode)
  const toggleSettings = useStore((s) => s.toggleSettings)

  return (
    <div className="h-full flex flex-col">
      <header className="flex items-center justify-between px-3 py-2 border-b border-border bg-surface-alt">
        <button
          onClick={() => setLayoutMode('classic')}
          className="flex items-center gap-1.5 text-sm text-text-secondary hover:text-text-primary transition-colors"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          Exit focus mode
        </button>
        <div className="flex items-center gap-2">
          <button onClick={toggleSettings} className="w-7 h-7 flex items-center justify-center rounded text-text-secondary hover:text-text-primary hover:bg-surface-hover transition-colors" title="Settings">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
          </button>
        </div>
      </header>
      <div className="flex-1 overflow-hidden">
        {docs.length === 0 ? <WelcomeScreen /> : <Editor />}
      </div>
      <SettingsModal />
    </div>
  )
}

export default function Layout() {
  const layoutMode = useStore((s) => s.settings.layoutMode)

  if (layoutMode === 'notes') return <NotesLayout />
  if (layoutMode === 'vscode') return <VSCodeLayout />
  return <ClassicLayout />
}
