import { useStore } from '../store/useStore'
import { downloadAsFile, generateHtmlDocument } from '../utils/export'

export default function ExportMenu() {
  const activeDocId = useStore((s) => s.activeDocId)
  const doc = useStore((s) => activeDocId ? s.getDoc(activeDocId) : undefined)

  if (!doc) return null

  const handleExportMarkdown = () => {
    downloadAsFile(doc.content, `${doc.title}.md`, 'text/markdown')
    useStore.getState().markClean(doc.id)
  }

  const handleExportHtml = () => {
    // Simple HTML export using the markdown content
    const htmlBody = doc.content
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/\n\n/g, '</p><p>')
      .replace(/\n/g, '<br>')

    const html = generateHtmlDocument(doc.content, `<p>${htmlBody}</p>`)
    downloadAsFile(html, `${doc.title}.html`, 'text/html')
  }

  return (
    <div className="absolute right-0 top-full mt-1 bg-surface border border-border rounded-lg shadow-lg py-1 z-40 min-w-[160px]">
      <button
        onClick={handleExportMarkdown}
        className="w-full text-left px-3 py-2 text-sm text-text-primary hover:bg-surface-hover transition-colors flex items-center gap-2"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
        </svg>
        Export .md
      </button>
      <button
        onClick={handleExportHtml}
        className="w-full text-left px-3 py-2 text-sm text-text-primary hover:bg-surface-hover transition-colors flex items-center gap-2"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polyline points="16 18 22 12 16 6" />
          <polyline points="8 6 2 12 8 18" />
        </svg>
        Export HTML
      </button>
    </div>
  )
}
