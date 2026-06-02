import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useStore } from '../store/useStore'
import type { LayoutMode } from '../types'
import { useAuth } from '../context/AuthContext'
import TabBar from './TabBar'
import Sidebar from './Sidebar'
import Editor from './Editor'
import Preview from './Preview'
import Toolbar from './Toolbar'
import StatusBar from './StatusBar'
import WelcomeScreen from './WelcomeScreen'
import SettingsModal from './SettingsModal'
import SpeechBar from './SpeechBar'
import AIAssistant from './AIAssistant'
import SearchPalette from './SearchPalette'

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
        <SpeechBar />
        <StatusBar />
        <UserBadge user={user} logout={logout} />
        <SettingsModal />
        <AIAssistant />
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
      <SpeechBar />
      <StatusBar />
      <UserBadge user={user} logout={logout} />
      <SettingsModal />
      <AIAssistant />
      <SearchPalette />
    </div>
  )
}

function VSCodeLayout() {
  const { user, logout } = useAuth()
  const docs = useStore((s) => s.docs)
  const showSidebar = useStore((s) => s.settings.showSidebar)
  const setLayoutMode = useStore((s) => s.setLayoutMode)
  const toggleSettings = useStore((s) => s.toggleSettings)
  const updateSettings = useStore((s) => s.updateSettings)
  const [activePanel, setActivePanel] = useState<'files' | 'search' | 'git' | null>('files')

  const activityItems = [
    { id: 'files', icon: 'M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z', label: 'Files' },
    { id: 'search', icon: 'M10 3a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM21 21l-6-6', label: 'Search' },
    { id: 'git', icon: 'M22 12h-4l-3 9L9 3l-3 9H2', label: 'Source Control' },
  ] as const

  const activityBar = (
    <nav className="w-11 bg-surface-alt border-r border-border flex flex-col items-center py-2 gap-1 flex-shrink-0">
      {activityItems.map(({ id, icon, label }) => (
        <button key={id} onClick={() => {
          if (id === 'files') updateSettings({ showSidebar: !showSidebar })
          setActivePanel(activePanel === id ? null : id as typeof activePanel)
        }}
          className={`w-8 h-8 flex items-center justify-center rounded transition-colors ${
            activePanel === id ? 'text-accent bg-accent/10 border-l-2 border-accent rounded-none' : 'text-text-secondary hover:text-text-primary hover:bg-surface-hover'
          }`} title={label}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d={icon} /></svg>
        </button>
      ))}
      <div className="flex-1" />
      <div className="flex flex-col items-center gap-1 pt-2 border-t border-border w-full">
        {(['classic', 'vscode', 'notes'] as LayoutMode[]).map((mode) => (
          <button key={mode} onClick={() => setLayoutMode(mode)}
            className={`w-7 h-7 flex items-center justify-center rounded text-[9px] font-bold uppercase transition-colors ${
              mode === 'vscode' ? 'text-accent bg-accent/10' : 'text-text-secondary hover:text-text-primary hover:bg-surface-hover'
            }`} title={`${mode} layout`}>
            {mode === 'classic' ? 'Cl' : mode === 'vscode' ? 'Vs' : 'Nt'}
          </button>
        ))}
      </div>
      <button onClick={toggleSettings} className="w-8 h-8 flex items-center justify-center rounded text-text-secondary hover:text-text-primary hover:bg-surface-hover transition-colors mt-1" title="Settings">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
      </button>
    </nav>
  )

  if (docs.length === 0) {
    return (
      <div className="h-full flex flex-col">
        <div className="flex flex-1 overflow-hidden">
          {activityBar}
          <div className="flex-1 flex items-center justify-center">
            <WelcomeScreen />
          </div>
        </div>
        <UserBadge user={user} logout={logout} />
        <SettingsModal />
        <AIAssistant />
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col">
      <div className="flex flex-1 overflow-hidden">
        {activityBar}
        {showSidebar && activePanel === 'files' && <Sidebar />}
        <div className="flex-1 flex flex-col overflow-hidden">
          <TabBar />
          <EditorArea />
        </div>
      </div>
      <SpeechBar />
      <StatusBar />
      <UserBadge user={user} logout={logout} />
      <SettingsModal />
      <AIAssistant />
      <SearchPalette />
    </div>
  )
}

function NotesLayout() {
  const { user } = useAuth()
  const docs = useStore((s) => s.docs)
  const activeDocId = useStore((s) => s.activeDocId)
  const doc = activeDocId ? useStore.getState().getDoc(activeDocId) : undefined
  const setLayoutMode = useStore((s) => s.setLayoutMode)
  const toggleSettings = useStore((s) => s.toggleSettings)

  return (
    <div className="h-full flex flex-col bg-surface">
      {/* Minimal header */}
      <header className="flex items-center justify-between px-4 py-3 border-b border-border/50">
        <div className="flex items-center gap-3">
          <Link to="/" className="text-sm font-medium text-accent tracking-tight">notes.md</Link>
          <span className="text-xs text-text-secondary">/</span>
          <div className="text-sm text-text-primary font-medium">
            {doc?.title || 'untitled'}
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={() => setLayoutMode('classic')} className="px-2 py-1 text-xs text-text-secondary hover:text-text-primary transition-colors rounded hover:bg-surface-hover">
            Classic
          </button>
          <button onClick={toggleSettings} className="w-7 h-7 flex items-center justify-center rounded text-text-secondary hover:text-text-primary hover:bg-surface-hover transition-colors">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
          </button>
        </div>
      </header>

      {/* Editor area - full width, distraction-free */}
      <div className="flex-1 overflow-y-auto px-4 py-6 max-w-3xl mx-auto w-full">
        {docs.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-accent/60 mb-4">
              <path d="M12 20h9M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
            </svg>
            <p className="text-text-secondary text-sm mb-4">Start writing...</p>
            <button
              onClick={() => useStore.getState().createDoc()}
              className="px-4 py-2 rounded-lg bg-accent text-white text-sm hover:opacity-90 transition-opacity"
            >
              New note
            </button>
          </div>
        ) : (
          <Editor />
        )}
      </div>

      <SpeechBar />
      <SettingsModal />
      <AIAssistant />
      <SearchPalette />
    </div>
  )
}

export default function Layout() {
  const layoutMode = useStore((s) => s.settings.layoutMode)

  if (layoutMode === 'notes') return <NotesLayout />
  if (layoutMode === 'vscode') return <VSCodeLayout />
  return <ClassicLayout />
}
