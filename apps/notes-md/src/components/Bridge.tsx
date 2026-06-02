import { useEffect, useRef } from 'react'
import { useStore } from '../store/useStore'
import { loadFile } from '../utils/bridge-storage'

/**
 * WebView postMessage bridge for Flutter embedding.
 *
 * Messages FROM Flutter (received via postMessage):
 *   { type: 'open-file',              payload: { path, content, title? } }
 *   { type: 'save-file',              payload: { path } }
 *   { type: 'notes-list-updated',     payload: { notes: [...] } }
 *   { type: 'file-changed-externally',payload: { path } }
 *   { type: 'file-closed',            payload: { path } }
 *   { type: 'set-theme',              payload: { theme } }
 *   { type: 'set-font-size',          payload: { size } }
 *
 * Messages TO Flutter (dispatched via window.flutter_postMessage):
 *   { type: 'ready' }
 *   { type: 'save-file-content', payload: { id, content, title, path? } }
 *   { type: 'file-changed',      payload: { id, title, path? } }
 *
 * The `notes-list-updated` and `save-file` events are handled at the
 * main.tsx level (the former is global because it shouldn't depend on
 * auth state). This component handles the per-document events.
 */

// `window.flutter_postMessage` is declared globally in
// `../utils/bridge-storage.ts`. Importing it for its side effects
// also gives us the type without redeclaring it.
import '../utils/bridge-storage'

const TRUSTED_ORIGINS = ['', 'file://', 'null', 'app://']

function originIsTrusted(origin: string): boolean {
  // `origin` is an empty string for some Flutter WebView setups; trust
  // it. Otherwise require an exact match against one of the well-known
  // origins, or a same-origin request.
  if (origin === '') return true
  if (TRUSTED_ORIGINS.includes(origin)) return true
  if (typeof window !== 'undefined' && origin === window.location.origin) return true
  return false
}

export default function Bridge() {
  const initialized = useRef(false)
  const openFileFromBridge = useStore((s) => s.openFileFromBridge)
  const createDoc = useStore((s) => s.createDoc)
  const updateDoc = useStore((s) => s.updateDoc)
  const activeDocId = useStore((s) => s.activeDocId)
  const updateSettings = useStore((s) => s.updateSettings)
  const closeTab = useStore((s) => s.closeTab)

  useEffect(() => {
    if (initialized.current) return
    initialized.current = true

    // Signal that the editor is ready. A small delay gives Flutter's
    // `onLoadStop` time to finish wiring up the bridge handler.
    const signalReady = () => {
      if (window.flutter_postMessage) {
        window.flutter_postMessage(JSON.stringify({ type: 'ready' }))
      }
    }
    const readyTimer = window.setTimeout(signalReady, 500)

    const handleMessage = (event: MessageEvent) => {
      if (!originIsTrusted(event.origin)) return

      let msg: { type?: string; payload?: Record<string, unknown> } | null = null
      try {
        msg = typeof event.data === 'string' ? JSON.parse(event.data) : (event.data as { type?: string; payload?: Record<string, unknown> })
      } catch {
        return // ignore non-JSON messages
      }
      if (!msg || typeof msg.type !== 'string') return

      const { type, payload } = msg

      switch (type) {
        case 'open-file': {
          // payload: { path, content, title? }
          const path = typeof payload?.path === 'string' ? payload.path : undefined
          const content = typeof payload?.content === 'string' ? payload.content : ''
          const title = typeof payload?.title === 'string' ? payload.title : undefined
          if (path) {
            openFileFromBridge(path, content, title)
          } else {
            // Legacy payload shape (no path) — fall back to creating a
            // fresh in-memory doc.
            createDoc(title || 'Imported', content)
          }
          break
        }

        case 'save-file': {
          // payload: { path }  — Flutter wants the current on-disk
          // contents for `path`. We reply with the in-memory content
          // (which may be a dirty edit).
          const path = typeof payload?.path === 'string' ? payload.path : undefined
          if (!path || !window.flutter_postMessage) break
          // Look up by path first, fall back to the active doc. The
          // store's `getDoc` keys by id, not path, so we search the
          // docs array directly.
          const state = useStore.getState()
          const doc = state.docs.find((d) => d.path === path)
            ?? (activeDocId ? state.docs.find((d) => d.id === activeDocId) : undefined)
          if (doc) {
            window.flutter_postMessage(JSON.stringify({
              type: 'save-file-content',
              payload: { id: doc.id, content: doc.content, title: doc.title, path: doc.path ?? null },
            }))
          }
          break
        }

        case 'file-changed-externally': {
          // payload: { path }  — the file changed on disk; reload it.
          const path = typeof payload?.path === 'string' ? payload.path : undefined
          if (!path) break
          void (async () => {
            try {
              const { content } = await loadFile(path)
              // Find the in-memory doc for this path and update its
              // content. If we don't have one, just open it.
              const state = useStore.getState()
              const existing = state.docs.find((d) => d.path === path)
              if (existing) {
                updateDoc(existing.id, content)
                useStore.setState((s) => ({
                  tabs: s.tabs.map((t) => t.docId === existing.id ? { ...t, isDirty: false } : t),
                }))
              } else {
                openFileFromBridge(path, content)
              }
            } catch (e) {
              console.warn('[bridge] file-changed-externally reload failed:', e)
            }
          })()
          break
        }

        case 'file-closed': {
          // payload: { path }  — close any tab for this path.
          const path = typeof payload?.path === 'string' ? payload.path : undefined
          if (!path) break
          const doc = useStore.getState().docs.find((d) => d.path === path)
          if (doc) closeTab(doc.id)
          break
        }

        case 'set-theme': {
          const theme = payload?.theme
          if (theme === 'light' || theme === 'dark' || theme === 'system') {
            updateSettings({ theme })
          }
          break
        }

        case 'set-font-size': {
          const size = payload?.size
          if (typeof size === 'number' && size > 0) {
            updateSettings({ fontSize: size })
          }
          break
        }
      }
    }

    window.addEventListener('message', handleMessage)

    // Tell Flutter when the active file changes so it can keep its
    // internal state in sync (toolbar, file association on Android).
    const unsub = useStore.subscribe((state, prev) => {
      if (state.activeDocId !== prev.activeDocId && state.activeDocId && window.flutter_postMessage) {
        const doc = state.getDoc(state.activeDocId)
        if (doc) {
          window.flutter_postMessage(JSON.stringify({
            type: 'file-changed',
            payload: { id: doc.id, title: doc.title, path: doc.path ?? null },
          }))
        }
      }
    })

    return () => {
      window.clearTimeout(readyTimer)
      window.removeEventListener('message', handleMessage)
      unsub()
    }
  }, [
    openFileFromBridge,
    createDoc,
    updateDoc,
    activeDocId,
    updateSettings,
    closeTab,
  ])

  return null
}
