import { useRef } from 'react'
import { useStore } from '../store/useStore'
import type { ViewMode } from '../types'

export default function Toolbar() {
  const createDoc = useStore((s) => s.createDoc)
  const viewMode = useStore((s) => s.viewMode)
  const setViewMode = useStore((s) => s.setViewMode)
  const toggleSettings = useStore((s) => s.toggleSettings)
  const settings = useStore((s) => s.settings)
  const updateSettings = useStore((s) => s.updateSettings)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleNew = () => createDoc()

  const handleOpen = () => {
    // If inside Flutter WebView, use bridge to native file picker
    if (window.flutter_postMessage) {
      window.flutter_postMessage(JSON.stringify({ type: 'pick-file', payload: {} }))
    } else {
      fileInputRef.current?.click()
    }
  }

  const handleFileImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      const content = ev.target?.result as string
      const title = file.name.replace(/\.md$/i, '')
      useStore.getState().importDoc(content, title)
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  const handleSave = () => {
    const doc = useStore.getState().activeDocId
      ? useStore.getState().getDoc(useStore.getState().activeDocId!)
      : undefined
    if (!doc) return

    const blob = new Blob([doc.content], { type: 'text/markdown' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${doc.title}.md`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)

    useStore.getState().markClean(doc.id)
  }

  const toggleTheme = () => {
    const order: Array<'light' | 'dark' | 'system'> = ['light', 'dark', 'system']
    const idx = order.indexOf(settings.theme)
    updateSettings({ theme: order[(idx + 1) % 3] })
  }

  const viewModes: Array<{ mode: ViewMode; label: string; icon: string }> = [
    { mode: 'edit', label: 'Edit', icon: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z' },
    { mode: 'preview', label: 'Preview', icon: 'M15 12a3 3 0 11-6 0 3 3 0 016 0z' },
    { mode: 'both', label: 'Both', icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' },
  ]

  return (
    <div className="flex items-center justify-between px-2 py-1 bg-surface-alt border-b border-border">
      <div className="flex items-center gap-1">
        <button onClick={handleNew} className="toolbar-btn" title="New document">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="12" y1="18" x2="12" y2="12" />
            <line x1="9" y1="15" x2="15" y2="15" />
          </svg>
        </button>
        <button onClick={handleOpen} className="toolbar-btn" title="Open file">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
          </svg>
        </button>
        <input ref={fileInputRef} type="file" accept=".md,.markdown,.txt" onChange={handleFileImport} className="hidden" />
        <button onClick={handleSave} className="toolbar-btn" title="Save .md file">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
            <polyline points="17 21 17 13 7 13 7 21" />
            <polyline points="7 3 7 8 15 8" />
          </svg>
        </button>
        <div className="w-px h-5 bg-border mx-1" />
        {viewModes.map(({ mode, label, icon }) => (
          <button
            key={mode}
            onClick={() => setViewMode(mode)}
            className={`toolbar-btn ${viewMode === mode ? 'text-blue-500 bg-surface-hover' : ''}`}
            title={label}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d={icon} />
            </svg>
          </button>
        ))}
      </div>

      <div className="flex items-center gap-1">
        <button onClick={toggleTheme} className="toolbar-btn" title={`Theme: ${settings.theme}`}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            {settings.theme === 'dark' ? (
              <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
            ) : (
              <>
                <circle cx="12" cy="12" r="5" />
                <line x1="12" y1="1" x2="12" y2="3" /><line x1="12" y1="21" x2="12" y2="23" />
                <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" /><line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
                <line x1="1" y1="12" x2="3" y2="12" /><line x1="21" y1="12" x2="23" y2="12" />
                <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" /><line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
              </>
            )}
          </svg>
        </button>
        <button onClick={toggleSettings} className="toolbar-btn" title="Settings">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
          </svg>
        </button>
      </div>
    </div>
  )
}
