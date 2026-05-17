import { useState } from 'react'
import { useStore } from '../store/useStore'
import { downloadAsFile, generateHtmlDocument } from '../utils/export'
import { exportDocument } from '../utils/api'

interface Props {
  onClose: () => void
}

const EXPORT_FORMATS = [
  { format: 'md', label: 'Markdown', icon: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z', local: true },
  { format: 'html', label: 'HTML (simple)', icon: 'M16 18l6-6-6-6M8 6l-6 6 6 6', local: true },
  { format: 'docx', label: 'Word (.docx)', icon: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z', local: false },
  { format: 'odt', label: 'OpenDocument (.odt)', icon: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z', local: false },
  { format: 'html', label: 'HTML (pandoc)', icon: 'M16 18l6-6-6-6M8 6l-6 6 6 6', local: false },
  { format: 'txt', label: 'Plain text', icon: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z', local: false },
  { format: 'rst', label: 'reStructuredText', icon: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z', local: false },
  { format: 'latex', label: 'LaTeX', icon: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z', local: false },
  { format: 'epub', label: 'EPUB ebook', icon: 'M4 6h16M4 12h16M4 18h12', local: false },
]

export default function ExportMenu({ onClose }: Props) {
  const [exporting, setExporting] = useState<string | null>(null)
  const activeDocId = useStore((s) => s.activeDocId)
  const doc = useStore((s) => activeDocId ? s.getDoc(activeDocId) : undefined)

  if (!doc) return null

  const handleExport = async (format: string, local: boolean) => {
    setExporting(format)
    try {
      if (local) {
        if (format === 'md') {
          downloadAsFile(doc.content, `${doc.title}.md`, 'text/markdown')
        } else if (format === 'html') {
          const htmlBody = doc.content
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/\n\n/g, '</p><p>').replace(/\n/g, '<br>')
          const html = generateHtmlDocument(doc.content, `<p>${htmlBody}</p>`)
          downloadAsFile(html, `${doc.title}.html`, 'text/html')
        }
      } else {
        const blob = await exportDocument(doc.content, format, doc.title)
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `${doc.title}.${format}`
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)
      }
    } catch (err) {
      console.error(`Export to ${format} failed:`, err)
    } finally {
      setExporting(null)
      onClose()
    }
  }

  return (
    <div className="absolute right-0 top-full mt-1 bg-surface border border-border rounded-lg shadow-lg py-1 z-40 min-w-[180px]" onMouseLeave={onClose}>
      <div className="px-3 py-1.5 text-xs font-medium text-text-secondary uppercase tracking-wider">Quick Export</div>
      {EXPORT_FORMATS.slice(0, 2).map(({ format, label, icon, local }) => (
        <button key={`local-${format}`} onClick={() => handleExport(format, local)} disabled={exporting !== null}
          className="w-full text-left px-3 py-2 text-sm text-text-primary hover:bg-surface-hover transition-colors flex items-center gap-2 disabled:opacity-50"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d={icon} /></svg>
          {exporting === format ? 'Exporting...' : label}
        </button>
      ))}
      <div className="border-t border-border my-1" />
      <div className="px-3 py-1.5 text-xs font-medium text-text-secondary uppercase tracking-wider">Pandoc Export</div>
      {EXPORT_FORMATS.slice(2).map(({ format, label, icon, local }) => (
        <button key={`pandoc-${format}`} onClick={() => handleExport(format, local)} disabled={exporting !== null}
          className="w-full text-left px-3 py-2 text-sm text-text-primary hover:bg-surface-hover transition-colors flex items-center gap-2 disabled:opacity-50"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d={icon} /></svg>
          {exporting === format ? 'Exporting...' : label}
        </button>
      ))}
    </div>
  )
}
