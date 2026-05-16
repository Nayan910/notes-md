import { useStore } from '../store/useStore'

export default function WelcomeScreen() {
  const createDoc = useStore((s) => s.createDoc)
  const importDoc = useStore((s) => s.importDoc)

  const handleCreate = () => createDoc()
  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText()
      if (text) importDoc(text)
    } catch {}
  }

  return (
    <div className="text-center max-w-lg px-8">
      <div className="mb-6">
        <svg className="mx-auto" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <line x1="16" y1="13" x2="8" y2="13" />
          <line x1="16" y1="17" x2="8" y2="17" />
          <polyline points="10 9 9 9 8 9" />
        </svg>
      </div>
      <h1 className="text-2xl font-bold mb-2 text-text-primary">notes.md</h1>
      <p className="text-text-secondary mb-8">A distraction-free markdown editor</p>

      <div className="grid grid-cols-2 gap-4 mb-8">
        <button onClick={handleCreate} className="flex flex-col items-center gap-2 p-4 rounded-lg border border-border hover:bg-surface-hover transition-colors">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 5v14M5 12h14" />
          </svg>
          <span className="text-sm font-medium">New Document</span>
        </button>
        <button onClick={handlePaste} className="flex flex-col items-center gap-2 p-4 rounded-lg border border-border hover:bg-surface-hover transition-colors">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
            <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
          </svg>
          <span className="text-sm font-medium">Paste from Clipboard</span>
        </button>
      </div>

      <div className="text-left text-sm text-text-secondary bg-surface-alt rounded-lg p-4">
        <h3 className="font-semibold mb-2 text-text-primary">Keyboard Shortcuts</h3>
        <div className="grid grid-cols-2 gap-1 text-xs">
          <span><kbd className="px-1.5 py-0.5 rounded bg-surface border border-border text-text-primary">Ctrl+N</kbd> New doc</span>
          <span><kbd className="px-1.5 py-0.5 rounded bg-surface border border-border text-text-primary">Ctrl+S</kbd> Save file</span>
          <span><kbd className="px-1.5 py-0.5 rounded bg-surface border border-border text-text-primary">Ctrl+O</kbd> Open file</span>
          <span><kbd className="px-1.5 py-0.5 rounded bg-surface border border-border text-text-primary">Ctrl+Z</kbd> Undo</span>
        </div>
      </div>

      <div className="mt-4 text-xs text-text-secondary">
        <h3 className="font-semibold mb-1">Formatting Reference</h3>
        <p><code className="text-blue-500"># Heading</code> · <code className="text-blue-500">**bold**</code> · <code className="text-blue-500">*italic*</code></p>
        <p><code className="text-blue-500">`code`</code> · <code className="text-blue-500">```code block```</code> · <code className="text-blue-500">$$math$$</code></p>
        <p><code className="text-blue-500">```mermaid</code> for diagrams · GFM tables · task lists</p>
      </div>
    </div>
  )
}
