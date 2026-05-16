import { useRef, useCallback, RefObject } from 'react'

interface UseSyncedScrollOptions {
  source: RefObject<HTMLDivElement | null>
  target: RefObject<HTMLDivElement | null>
  enabled: boolean
}

export function useSyncedScroll({ source, target, enabled }: UseSyncedScrollOptions) {
  const isSyncing = useRef(false)

  const handleScroll = useCallback((sourceEl: HTMLDivElement, targetEl: HTMLDivElement) => {
    if (!enabled || isSyncing.current) return
    isSyncing.current = true

    const ratio = sourceEl.scrollTop / (sourceEl.scrollHeight - sourceEl.clientHeight)
    targetEl.scrollTop = ratio * (targetEl.scrollHeight - targetEl.clientHeight)

    requestAnimationFrame(() => {
      isSyncing.current = false
    })
  }, [enabled])

  return { handleScroll, isSyncing }
}
