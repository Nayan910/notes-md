import { useEffect, useRef } from 'react'
import { EditorView, basicSetup } from 'codemirror'
import { EditorState } from '@codemirror/state'
import { markdown, markdownLanguage } from '@codemirror/lang-markdown'
import { oneDark } from '@codemirror/theme-one-dark'
import { languages } from '@codemirror/language-data'
import { keymap, lineNumbers, highlightActiveLineGutter } from '@codemirror/view'
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands'
import { indentWithTab } from '@codemirror/commands'
import { searchKeymap, highlightSelectionMatches } from '@codemirror/search'
import { closeBrackets } from '@codemirror/autocomplete'
import { foldGutter, indentOnInput, bracketMatching, foldKeymap } from '@codemirror/language'
import { useStore } from '../store/useStore'
import { useAutoSave } from '../hooks/useAutoSave'

export default function Editor() {
  const editorRef = useRef<HTMLDivElement>(null)
  const viewRef = useRef<EditorView | null>(null)
  const isInternalChange = useRef(false)

  const activeDocId = useStore((s) => s.activeDocId)
  const doc = useStore((s) => activeDocId ? s.getDoc(activeDocId) : undefined)
  const updateDoc = useStore((s) => s.updateDoc)
  const settings = useStore((s) => s.settings)

  useAutoSave(activeDocId, doc?.content || '')

  // Create or recreate editor
  useEffect(() => {
    if (!editorRef.current) return
    if (viewRef.current) {
      viewRef.current.destroy()
      viewRef.current = null
    }

    const isDark = settings.theme === 'dark' ||
      (settings.theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)

    const extensions = [
      // Core setup (without line numbers — we add those separately for control)
      basicSetup,
      // Markdown language support
      markdown({ base: markdownLanguage, codeLanguages: languages }),
      // Key bindings
      keymap.of([indentWithTab, ...defaultKeymap, ...searchKeymap, ...foldKeymap]),
      // Theme
      isDark ? oneDark : [],
      // Custom styling
      EditorView.theme({
        '&': { fontSize: `${settings.fontSize}px`, height: '100%' },
        '.cm-scroller': { fontFamily: settings.fontFamily, overflow: 'auto' },
        '&.cm-focused': { outline: 'none' },
        '.cm-gutters': settings.showLineNumbers ? {} : { display: 'none' },
      }),
      // Content change listener
      EditorView.updateListener.of((update) => {
        if (update.docChanged) {
          isInternalChange.current = true
          updateDoc(activeDocId!, update.state.doc.toString())
          setTimeout(() => { isInternalChange.current = false }, 0)
        }
      }),
    ]

    const state = EditorState.create({
      doc: doc?.content || '',
      extensions,
    })

    viewRef.current = new EditorView({ state, parent: editorRef.current })

    return () => {
      viewRef.current?.destroy()
      viewRef.current = null
    }
  }, [activeDocId])

  // Sync content from external changes
  useEffect(() => {
    if (!viewRef.current || isInternalChange.current) return
    const currentText = viewRef.current.state.doc.toString()
    if (doc && doc.content !== currentText) {
      viewRef.current.dispatch({
        changes: { from: 0, to: currentText.length, insert: doc.content },
      })
    }
  }, [doc?.content])

  return (
    <div ref={editorRef} className="h-full overflow-hidden" />
  )
}
