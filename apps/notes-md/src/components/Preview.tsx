import { useMemo } from 'react'
import { useStore } from '../store/useStore'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'
import rehypePrism from 'rehype-prism-plus'
import rehypeRaw from 'rehype-raw'
import { copyToClipboard } from '../utils/export'

export default function Preview() {
  const activeDocId = useStore((s) => s.activeDocId)
  const doc = useStore((s) => activeDocId ? s.getDoc(activeDocId) : undefined)
  const content = doc?.content || ''

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="max-w-4xl mx-auto">
        {content ? (
          <div className="preview">
            <ReactMarkdown
              remarkPlugins={[remarkGfm, remarkMath]}
              rehypePlugins={[rehypeKatex, rehypePrism, rehypeRaw]}
              components={{
                pre: ({ children, ...props }) => {
                  const codeContent = extractCodeContent(children)
                  return (
                    <div className="relative group">
                      <button
                        onClick={() => codeContent && copyToClipboard(codeContent)}
                        className="absolute top-2 right-2 px-2 py-1 text-xs rounded bg-white/10 text-white/60 hover:text-white opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        Copy
                      </button>
                      <pre {...props}>{children}</pre>
                    </div>
                  )
                },
                code: ({ className, children, ...props }) => {
                  const isInline = !className
                  if (isInline) {
                    return <code {...props}>{children}</code>
                  }
                  return <code className={className} {...props}>{children}</code>
                },
              }}
            >
              {content}
            </ReactMarkdown>
          </div>
        ) : (
          <div className="flex items-center justify-center h-64 text-text-secondary">
            <div className="text-center">
              <svg className="mx-auto mb-3" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="16" y1="13" x2="8" y2="13" />
                <line x1="16" y1="17" x2="8" y2="17" />
              </svg>
              <p className="text-sm">Start typing in the editor to see the preview</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function extractCodeContent(children: React.ReactNode): string | null {
  try {
    const child = Array.isArray(children) ? children[0] : children
    if (child && typeof child === 'object' && 'props' in child) {
      return String(child.props.children || '')
    }
    if (typeof child === 'string') return child
  } catch {}
  return null
}
