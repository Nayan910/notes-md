import { useEffect, useRef } from 'react'
import { useStore } from '../store/useStore'

export function useAutoSave(docId: string | null, content: string) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const autoSave = useStore((s) => s.settings.autoSave)
  const delay = useStore((s) => s.settings.autoSaveDelay)

  useEffect(() => {
    if (!autoSave || !docId) return

    if (timerRef.current) clearTimeout(timerRef.current)

    timerRef.current = setTimeout(() => {
      useStore.getState().updateDoc(docId, content)
    }, delay)

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [docId, content, autoSave, delay])
}
