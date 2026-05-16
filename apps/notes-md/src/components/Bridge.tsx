import { useEffect, useRef } from 'react'
import { useStore } from '../store/useStore'

/**
 * WebView postMessage bridge for Flutter embedding.
 *
 * Messages FROM Flutter (received via postMessage):
 *   { type: 'open-file', payload: { content, title } }
 *   { type: 'save-file', payload: { id } }
 *   { type: 'set-theme', payload: { theme } }
 *   { type: 'set-font-size', payload: { size } }
 *
 * Messages TO Flutter (dispatched via window.flutter_postMessage):
 *   { type: 'ready' }
 *   { type: 'save-file-content', payload: { id, content, title } }
 *   { type: 'file-changed', payload: { id } }
 *   { type: 'request-theme' }
 */

declare global {
  interface Window {
    flutter_postMessage?: (message: string) => void
  }
}

export default function Bridge() {
  const initialized = useRef(false)
  const createDoc = useStore((s) => s.createDoc)
  const updateDoc = useStore((s) => s.updateDoc)
  const getDoc = useStore((s) => s.getDoc)
  const activeDocId = useStore((s) => s.activeDocId)
  const updateSettings = useStore((s) => s.updateSettings)

  useEffect(() => {
    if (initialized.current) return
    initialized.current = true

    // Signal that the editor is ready
    const signalReady = () => {
      if (window.flutter_postMessage) {
        window.flutter_postMessage(JSON.stringify({ type: 'ready' }))
      }
    }

    // Set a small delay to ensure Flutter WebView is listening
    setTimeout(signalReady, 500)

    // Handle messages from Flutter
    const handleMessage = (event: MessageEvent) => {
      try {
        const msg = typeof event.data === 'string' ? JSON.parse(event.data) : event.data
        const { type, payload } = msg

        switch (type) {
          case 'open-file':
            if (payload?.content !== undefined) {
              const title = payload.title || 'Imported'
              createDoc(title, payload.content)
            }
            break

          case 'save-file':
            if (payload?.id) {
              const doc = getDoc(payload.id)
              if (doc && window.flutter_postMessage) {
                window.flutter_postMessage(JSON.stringify({
                  type: 'save-file-content',
                  payload: { id: doc.id, content: doc.content, title: doc.title },
                }))
              }
            }
            break

          case 'set-theme':
            if (payload?.theme) {
              updateSettings({ theme: payload.theme })
            }
            break

          case 'set-font-size':
            if (payload?.size) {
              updateSettings({ fontSize: payload.size })
            }
            break
        }
      } catch {
        // Ignore non-JSON messages
      }
    }

    window.addEventListener('message', handleMessage)

    // Also listen for changes to notify Flutter
    const unsub = useStore.subscribe((state, prev) => {
      if (state.activeDocId !== prev.activeDocId && state.activeDocId && window.flutter_postMessage) {
        const doc = state.getDoc(state.activeDocId)
        if (doc) {
          window.flutter_postMessage(JSON.stringify({
            type: 'file-changed',
            payload: { id: doc.id, title: doc.title },
          }))
        }
      }
    })

    return () => {
      window.removeEventListener('message', handleMessage)
      unsub()
    }
  }, [])

  return null
}
