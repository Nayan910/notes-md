import { useEffect, useRef, useState } from 'react'
import { useStore } from '../store/useStore'
import { createFile as bridgeCreateFile, deleteFile as bridgeDeleteFile, renameFile as bridgeRenameFile } from '../utils/bridge-storage'
import type { Document } from '../types'

/**
 * File browser component.
 *
 * Lists every .md document the store knows about. In Flutter-bridge mode
 * the bootstrap loads every file from disk into the store, so the list
 * is the union of "open tabs" and "files on disk" — there is no separate
 * "open" vs "saved" distinction.
 *
 * Interactions:
 *  - Click a file → set it as the active tab.
 *  - "+" button   → create a new note (sync, opens immediately).
 *  - Right-click  → context menu with Rename / Delete.
 *  - Double-click → start renaming inline.
 */
export default function FileList() {
  const docs = useStore((s) => s.docs)
  const activeDocId = useStore((s) => s.activeDocId)
  const bridgeAvailable = useStore((s) => s.bridgeAvailable)

  const setActiveTab = useStore((s) => s.setActiveTab)
  const openByPath = useStore((s) => s.openByPath)
  const createDoc = useStore((s) => s.createDoc)
  const deleteDoc = useStore((s) => s.deleteDoc)
  const renameDoc = useStore((s) => s.renameDoc)

  const [editingId, setEditingId] = useState<string | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; doc: Document } | null>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  // Dismiss the context menu on any outside click or Escape.
  useEffect(() => {
    if (!contextMenu) return
    const handleClick = () => setContextMenu(null)
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setContextMenu(null)
    }
    window.addEventListener('click', handleClick)
    window.addEventListener('keydown', handleKey)
    return () => {
      window.removeEventListener('click', handleClick)
      window.removeEventListener('keydown', handleKey)
    }
  }, [contextMenu])

  const startRename = (doc: Document) => {
    setEditingId(doc.id)
    setEditTitle(doc.title)
    setContextMenu(null)
  }

  const finishRename = () => {
    if (editingId && editTitle.trim()) {
      const target = docs.find((d) => d.id === editingId)
      if (target && target.title !== editTitle.trim()) {
        renameDoc(editingId, editTitle.trim())
      }
    }
    setEditingId(null)
  }

  const handleOpen = (doc: Document) => {
    if (editingId) return
    // We use openByPath when we have a real path (Flutter bridge mode)
    // so we get the latest content from disk. For IDB-only docs we
    // just set the active tab — the in-memory content is authoritative.
    if (doc.path && bridgeAvailable) {
      void openByPath(doc.path).catch(() => {
        // If the bridge call fails, fall back to switching tabs.
        setActiveTab(doc.id)
      })
    } else {
      setActiveTab(doc.id)
    }
  }

  const handleNew = () => {
    createDoc()
  }

  const handleDelete = (doc: Document) => {
    setContextMenu(null)
    const confirmed = window.confirm(`Delete "${doc.title}"? This cannot be undone.`)
    if (confirmed) deleteDoc(doc.id)
  }

  const handleContextMenu = (e: React.MouseEvent, doc: Document) => {
    e.preventDefault()
    setContextMenu({ x: e.clientX, y: e.clientY, doc })
  }

  // Sort: active doc on top, then by updatedAt descending.
  const sortedDocs = [...docs].sort((a, b) => {
    if (a.id === activeDocId) return -1
    if (b.id === activeDocId) return 1
    return b.updatedAt - a.updatedAt
  })

  return (
    <>
      <div className="flex items-center justify-between px-3 py-2 border-b border-border">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-text-secondary uppercase tracking-wider">Files</span>
          {bridgeAvailable && (
            <span
              className="text-[9px] font-medium px-1.5 py-0.5 rounded bg-accent/10 text-accent"
              title="Files are saved to disk via Flutter"
            >
              BRIDGE
            </span>
          )}
        </div>
        <button
          onClick={handleNew}
          className="p-1 rounded hover:bg-surface-hover text-text-secondary hover:text-text-primary transition-colors"
          title="New document"
          aria-label="New document"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 5v14M5 12h14" />
          </svg>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {sortedDocs.map((doc) => {
          const isActive = doc.id === activeDocId
          const isEditing = editingId === doc.id
          return (
            <div
              key={doc.id}
              onClick={() => handleOpen(doc)}
              onDoubleClick={() => startRename(doc)}
              onContextMenu={(e) => handleContextMenu(e, doc)}
              className={`
                group flex flex-col px-3 py-1.5 cursor-pointer text-sm
                transition-colors duration-150 border-l-2
                ${isActive
                  ? 'bg-surface-hover text-text-primary border-l-accent'
                  : 'text-text-secondary hover:bg-surface-hover hover:text-text-primary border-l-transparent'
                }
              `}
              data-testid="file-list-item"
              data-path={doc.path ?? ''}
            >
              {isEditing ? (
                <input
                  autoFocus
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  onBlur={finishRename}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') finishRename()
                    if (e.key === 'Escape') setEditingId(null)
                  }}
                  onClick={(e) => e.stopPropagation()}
                  className="flex-1 bg-surface text-text-primary border border-border rounded px-1 py-0.5 text-sm outline-none"
                />
              ) : (
                <>
                  <div className="flex items-center gap-1 min-w-0">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="flex-shrink-0 text-text-secondary/60">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                      <polyline points="14 2 14 8 20 8" />
                    </svg>
                    <span className="truncate flex-1">{doc.title}</span>
                  </div>
                  <div className="text-[10px] text-text-secondary/70 mt-0.5 pl-4">
                    {formatRelativeTime(doc.updatedAt)}
                  </div>
                </>
              )}
            </div>
          )
        })}
        {sortedDocs.length === 0 && (
          <div className="px-3 py-4 text-xs text-text-secondary text-center">
            No documents yet. Click + to create one.
          </div>
        )}
      </div>

      {contextMenu && (
        <div
          ref={menuRef}
          role="menu"
          className="fixed z-50 min-w-[140px] bg-surface border border-border rounded shadow-lg py-1 text-sm"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            role="menuitem"
            onClick={() => startRename(contextMenu.doc)}
            className="w-full text-left px-3 py-1.5 hover:bg-surface-hover text-text-primary flex items-center gap-2"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M17 3a2.828 2.828 0 0 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
            </svg>
            Rename
          </button>
          <div className="my-1 border-t border-border" />
          <button
            role="menuitem"
            onClick={() => handleDelete(contextMenu.doc)}
            className="w-full text-left px-3 py-1.5 hover:bg-red-500/10 text-red-500 flex items-center gap-2"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
            </svg>
            Delete
          </button>
        </div>
      )}
    </>
  )
}

/* ------------------------------------------------------------------ *
 * Helpers
 * ------------------------------------------------------------------ */

const NOW = () => Date.now()

function formatRelativeTime(timestamp: number): string {
  const now = NOW()
  const diff = now - timestamp
  if (diff < 0) return 'in the future'

  const seconds = Math.floor(diff / 1000)
  if (seconds < 60) return 'just now'

  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`

  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`

  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`

  const weeks = Math.floor(days / 7)
  if (weeks < 4) return `${weeks}w ago`

  const months = Math.floor(days / 30)
  if (months < 12) return `${months}mo ago`

  const years = Math.floor(days / 365)
  return `${years}y ago`
}
