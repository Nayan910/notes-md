import { useEffect, useMemo, useRef, useState } from 'react'
import { useStore } from '../store/useStore'
import {
  isBridgeAvailable,
  callBridge,
  type SearchResult as BridgeSearchResult,
} from '../utils/bridge-storage'

/**
 * Cmd/Ctrl-K command palette for jumping between files.
 *
 * When the Flutter bridge is available, the palette calls the native
 * FTS5 index via `search-notes` and renders highlighted snippets.
 * Otherwise it falls back to the same in-memory filter the old
 * palette used, so the editor still works standalone in a browser.
 *
 * - Opens on `Cmd+K` (macOS) or `Ctrl+K` (Windows/Linux).
 * - Type to search — debounced 200ms before the bridge call.
 * - `↑` / `↓` to move, `Enter` to open, `Esc` to close.
 */
export default function SearchPalette() {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [activeIndex, setActiveIndex] = useState(0)
  const [bridgeResults, setBridgeResults] = useState<BridgeSearchResult[] | null>(null)
  const [searching, setSearching] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const debounceRef = useRef<number | null>(null)
  const requestSeq = useRef(0)

  const docs = useStore((s) => s.docs)
  const activeDocId = useStore((s) => s.activeDocId)
  const setActiveTab = useStore((s) => s.setActiveTab)
  const openByPath = useStore((s) => s.openByPath)
  const createDoc = useStore((s) => s.createDoc)
  const bridgeAvailable = useStore((s) => s.bridgeAvailable)

  // Cmd/Ctrl+K opens the palette. Prevent the default browser behavior
  // (Chromium focuses the URL bar on Ctrl+K).
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const isK = e.key === 'k' || e.key === 'K'
      if (isK && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setOpen((prev) => !prev)
      } else if (e.key === 'Escape' && open) {
        setOpen(false)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open])

  // Focus the input as soon as the palette opens.
  useEffect(() => {
    if (open) {
      setQuery('')
      setActiveIndex(0)
      setBridgeResults(null)
      // Wait one frame for the input to mount.
      const t = window.setTimeout(() => inputRef.current?.focus(), 0)
      return () => window.clearTimeout(t)
    }
  }, [open])

  // Debounced bridge search. Only kicks in when the bridge is present;
  // the in-memory fallback lives in the `results` memo below.
  useEffect(() => {
    if (!open) return
    if (!bridgeAvailable || !isBridgeAvailable()) {
      setBridgeResults(null)
      return
    }
    const trimmed = query.trim()
    if (!trimmed) {
      setBridgeResults([])
      return
    }
    if (debounceRef.current) {
      window.clearTimeout(debounceRef.current)
    }
    setSearching(true)
    const myReq = ++requestSeq.current
    debounceRef.current = window.setTimeout(async () => {
      try {
        const res = await callBridge<BridgeSearchResult[]>('search-notes', {
          query: trimmed,
          limit: 20,
        })
        // Discard stale responses so a slow older query can't
        // overwrite the latest results.
        if (myReq !== requestSeq.current) return
        setBridgeResults(res ?? [])
      } catch (e) {
        console.warn('[search] bridge query failed:', e)
        if (myReq === requestSeq.current) setBridgeResults([])
      } finally {
        if (myReq === requestSeq.current) setSearching(false)
      }
    }, 200)
    return () => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current)
    }
  }, [query, open, bridgeAvailable])

  // Bridge-mode results are rendered as plain rows. The store is
  // updated separately by the editor's existing note-list handling.
  const bridgeRows = useMemo(() => {
    if (bridgeResults === null) return null
    return bridgeResults
  }, [bridgeResults])

  // Fallback (standalone browser) — exact-prefix matches first, then
  // substring matches, sorted by recency.
  const fallbackResults = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) {
      return [...docs].sort((a, b) => {
        if (a.id === activeDocId) return -1
        if (b.id === activeDocId) return 1
        return b.updatedAt - a.updatedAt
      })
    }
    const prefix: typeof docs = []
    const substring: typeof docs = []
    for (const doc of docs) {
      const title = doc.title.toLowerCase()
      if (title.startsWith(q)) {
        prefix.push(doc)
      } else if (title.includes(q)) {
        substring.push(doc)
      }
    }
    return [...prefix, ...substring]
  }, [docs, query, activeDocId])

  const results = bridgeRows ?? fallbackResults
  const isBridge = bridgeRows !== null

  // Clamp the active index if the results list shrinks.
  useEffect(() => {
    if (activeIndex >= results.length) {
      setActiveIndex(Math.max(0, results.length - 1))
    }
  }, [results.length, activeIndex])

  const close = () => {
    setOpen(false)
    setQuery('')
    setBridgeResults(null)
  }

  const selectIndex = (idx: number) => {
    const row: any = results[idx]
    if (!row) {
      // Maybe the user wants to create a new note with this title.
      if (query.trim()) {
        createDoc(query.trim())
        close()
      }
      return
    }
    // Bridge row: {path, name, snippet, score}
    // Fallback row: a Document from the store
    const path: string | undefined = isBridge ? row.path : row.path
    if (path && bridgeAvailable) {
      void openByPath(path).catch(() => {
        if (!isBridge) setActiveTab(row.id)
      })
    } else if (!isBridge) {
      setActiveTab(row.id)
    }
    close()
  }

  if (!open) return null

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Search notes"
      className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh] bg-black/40 backdrop-blur-sm"
      onClick={close}
    >
      <div
        className="w-full max-w-lg bg-surface border border-border rounded-lg shadow-2xl overflow-hidden flex flex-col"
        style={{ maxHeight: '60vh' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 px-3 py-2 border-b border-border">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-text-secondary flex-shrink-0">
            <circle cx="11" cy="11" r="7" />
            <path d="M21 21l-4.35-4.35" />
          </svg>
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') {
                e.preventDefault()
                setActiveIndex((i) => Math.min(i + 1, results.length - 1))
              } else if (e.key === 'ArrowUp') {
                e.preventDefault()
                setActiveIndex((i) => Math.max(i - 1, 0))
              } else if (e.key === 'Enter') {
                e.preventDefault()
                selectIndex(activeIndex)
              }
            }}
            placeholder="Search notes…"
            className="flex-1 bg-transparent text-text-primary placeholder-text-secondary/60 outline-none text-sm py-1"
            aria-label="Search notes"
          />
          {searching && isBridge && (
            <span className="text-[10px] text-text-secondary">searching…</span>
          )}
          <kbd className="text-[10px] text-text-secondary px-1.5 py-0.5 rounded border border-border bg-surface-alt">
            Esc
          </kbd>
        </div>

        <div className="flex-1 overflow-y-auto">
          {results.length === 0 ? (
            <button
              onClick={() => selectIndex(-1)}
              className="w-full text-left px-4 py-3 text-sm hover:bg-surface-hover text-text-primary"
            >
              <div className="flex items-center gap-2">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 5v14M5 12h14" />
                </svg>
                <span>
                  Create new note:{' '}
                  <span className="text-accent">{query.trim() || 'Untitled'}</span>
                </span>
              </div>
            </button>
          ) : isBridge ? (
            (results as BridgeSearchResult[]).map((hit, idx) => {
              const isActive = idx === activeIndex
              return (
                <button
                  key={hit.path}
                  data-testid="search-palette-item"
                  onClick={() => selectIndex(idx)}
                  onMouseEnter={() => setActiveIndex(idx)}
                  className={`
                    w-full text-left px-4 py-2 text-sm flex flex-col gap-1
                    ${isActive ? 'bg-surface-hover text-text-primary' : 'text-text-secondary hover:bg-surface-hover hover:text-text-primary'}
                  `}
                >
                  <div className="flex items-center gap-2">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="flex-shrink-0">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                      <polyline points="14 2 14 8 20 8" />
                    </svg>
                    <span className="truncate flex-1 font-medium">
                      {hit.name}
                    </span>
                    {typeof hit.score === 'number' && (
                      <span className="text-[9px] font-mono text-text-secondary/70">
                        {hit.score.toFixed(2)}
                      </span>
                    )}
                  </div>
                  {hit.snippet && (
                    <div
                      className="text-[11px] text-text-secondary/80 truncate pl-5"
                      // The snippet comes from the FTS5 helper which
                      // wraps matches in <<…>>. Render that as
                      // <mark> for a basic visual highlight.
                      dangerouslySetInnerHTML={{
                        __html: hit.snippet.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>>/g, '&gt;&gt;').replace(/<<(.*?)>>/g, '<mark>$1</mark>'),
                      }}
                    />
                  )}
                </button>
              )
            })
          ) : (
            (results as typeof docs).map((doc, idx) => {
              const isActive = idx === activeIndex
              const isCurrent = doc.id === activeDocId
              return (
                <button
                  key={doc.id}
                  data-testid="search-palette-item"
                  onClick={() => selectIndex(idx)}
                  onMouseEnter={() => setActiveIndex(idx)}
                  className={`
                    w-full text-left px-4 py-2 text-sm flex items-center gap-2
                    ${isActive ? 'bg-surface-hover text-text-primary' : 'text-text-secondary hover:bg-surface-hover hover:text-text-primary'}
                  `}
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="flex-shrink-0">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                  </svg>
                  <span className="truncate flex-1">{doc.title}</span>
                  {isCurrent && (
                    <span className="text-[9px] font-medium px-1.5 py-0.5 rounded bg-accent/10 text-accent">
                      ACTIVE
                    </span>
                  )}
                </button>
              )
            })
          )}
        </div>

        <div className="px-3 py-1.5 border-t border-border text-[10px] text-text-secondary flex items-center gap-3">
          <span><kbd className="font-mono">↑</kbd> <kbd className="font-mono">↓</kbd> navigate</span>
          <span><kbd className="font-mono">↵</kbd> open</span>
          <span><kbd className="font-mono">Esc</kbd> close</span>
          {isBridge && (
            <span className="ml-auto text-accent/70">
              {results.length} {results.length === 1 ? 'match' : 'matches'}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
