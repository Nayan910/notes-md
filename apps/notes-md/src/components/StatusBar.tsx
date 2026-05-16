import { useMemo } from 'react'
import { useStore } from '../store/useStore'

export default function StatusBar() {
  const activeDocId = useStore((s) => s.activeDocId)
  const doc = useStore((s) => activeDocId ? s.getDoc(activeDocId) : undefined)

  const stats = useMemo(() => {
    if (!doc) return { words: 0, chars: 0, lines: 0, readingTime: 0 }
    const content = doc.content
    const chars = content.length
    const words = content.trim() ? content.trim().split(/\s+/).length : 0
    const lines = content ? content.split('\n').length : 0
    const readingTime = Math.max(1, Math.ceil(words / 200))
    return { words, chars, lines, readingTime }
  }, [doc])

  if (!activeDocId) return null

  return (
    <div className="flex items-center justify-between px-3 py-1 bg-surface-alt border-t border-border text-xs text-text-secondary">
      <div className="flex items-center gap-4">
        <span>{stats.words} words</span>
        <span>{stats.chars} characters</span>
        <span>{stats.lines} lines</span>
      </div>
      <div className="flex items-center gap-4">
        <span>{stats.readingTime} min read</span>
        <span className="flex items-center gap-1">
          <span className={`w-2 h-2 rounded-full ${doc ? 'bg-green-500' : 'bg-gray-400'}`} />
          {doc ? 'Saved' : 'No document'}
        </span>
      </div>
    </div>
  )
}
