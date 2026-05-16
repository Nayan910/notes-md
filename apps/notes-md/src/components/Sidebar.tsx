import { useState } from 'react'
import { useStore } from '../store/useStore'

export default function Sidebar() {
  const docs = useStore((s) => s.docs)
  const activeDocId = useStore((s) => s.activeDocId)
  const setActiveTab = useStore((s) => s.setActiveTab)
  const deleteDoc = useStore((s) => s.deleteDoc)
  const renameDoc = useStore((s) => s.renameDoc)
  const createDoc = useStore((s) => s.createDoc)
  const toggleSettings = useStore((s) => s.toggleSettings)
  const showSidebar = useStore((s) => s.settings.showSidebar)

  const [editingId, setEditingId] = useState<string | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const [hoveredId, setHoveredId] = useState<string | null>(null)

  if (!showSidebar) return null

  const startRename = (doc: { id: string; title: string }) => {
    setEditingId(doc.id)
    setEditTitle(doc.title)
  }

  const finishRename = () => {
    if (editingId && editTitle.trim()) {
      renameDoc(editingId, editTitle.trim())
    }
    setEditingId(null)
  }

  return (
    <div className="w-52 bg-surface-alt border-r border-border flex flex-col overflow-hidden flex-shrink-0">
      <div className="flex items-center justify-between px-3 py-2 border-b border-border">
        <span className="text-xs font-semibold text-text-secondary uppercase tracking-wider">Files</span>
        <button
          onClick={() => createDoc()}
          className="p-1 rounded hover:bg-surface-hover text-text-secondary hover:text-text-primary transition-colors"
          title="New document"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 5v14M5 12h14" />
          </svg>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {docs.map((doc) => (
          <div
            key={doc.id}
            onMouseEnter={() => setHoveredId(doc.id)}
            onMouseLeave={() => setHoveredId(null)}
            onClick={() => setActiveTab(doc.id)}
            className={`
              group flex items-center justify-between px-3 py-1.5 cursor-pointer text-sm
              transition-colors duration-150
              ${doc.id === activeDocId
                ? 'bg-surface-hover text-text-primary border-l-2 border-l-blue-500'
                : 'text-text-secondary hover:bg-surface-hover hover:text-text-primary'
              }
            `}
          >
            {editingId === doc.id ? (
              <input
                autoFocus
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                onBlur={finishRename}
                onKeyDown={(e) => { if (e.key === 'Enter') finishRename(); if (e.key === 'Escape') setEditingId(null) }}
                onClick={(e) => e.stopPropagation()}
                className="flex-1 bg-surface text-text-primary border border-border rounded px-1 py-0.5 text-sm outline-none"
              />
            ) : (
              <>
                <span className="truncate flex-1">{doc.title}</span>
                <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={(e) => { e.stopPropagation(); startRename(doc) }}
                    className="p-0.5 rounded hover:bg-surface-hover text-text-secondary hover:text-blue-500"
                    title="Rename"
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
                    </svg>
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); deleteDoc(doc.id) }}
                    className="p-0.5 rounded hover:bg-surface-hover text-text-secondary hover:text-red-500"
                    title="Delete"
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M18 6L6 18M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </>
            )}
          </div>
        ))}
        {docs.length === 0 && (
          <div className="px-3 py-4 text-xs text-text-secondary text-center">
            No documents yet. Click + to create one.
          </div>
        )}
      </div>
    </div>
  )
}
