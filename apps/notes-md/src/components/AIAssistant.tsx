import { useState, useRef, useEffect } from 'react'
import { useStore } from '../store/useStore'
import { askAI, formatAsMarkdown, getAIConfig, getConversationHistory, saveConversationHistory, clearConversationHistory, getAISkills, type ChatMessage } from '../utils/ai'

interface Message {
  role: 'user' | 'assistant'
  content: string
  timestamp?: number
}

export default function AIAssistant() {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>(() => {
    const history = getConversationHistory()
    return history.map(msg => ({ role: msg.role, content: msg.content, timestamp: msg.timestamp }))
  })
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [smartMode, setSmartMode] = useState(false)
  const activeDocId = useStore((s) => s.activeDocId)
  const doc = activeDocId ? useStore.getState().getDoc(activeDocId) : undefined
  const endRef = useRef<HTMLDivElement>(null)
  const configured = !!getAIConfig()
  const customSkills = getAISkills()

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  // Save history whenever messages change
  useEffect(() => {
    if (messages.length > 0) {
      const history: ChatMessage[] = messages.map(msg => ({
        role: msg.role,
        content: msg.content,
        timestamp: msg.timestamp || Date.now()
      }))
      saveConversationHistory(history)
    }
  }, [messages])

  const handleSend = async () => {
    if (!input.trim() || loading) return
    const userMsg = input.trim()
    setInput('')
    setMessages(prev => [...prev, { role: 'user', content: userMsg, timestamp: Date.now() }])
    setLoading(true)
    try {
      const context = doc ? `Current document content:\n\n${doc.content.slice(0, 3000)}` : ''
      const systemPrompt = `${customSkills} ${context ? `Current document context:\n${context}` : ''}`
      const reply = await askAI(userMsg, systemPrompt)
      setMessages(prev => [...prev, { role: 'assistant', content: reply, timestamp: Date.now() }])
    } catch (err: any) {
      setMessages(prev => [...prev, { role: 'assistant', content: `Error: ${err.message}`, timestamp: Date.now() }])
    } finally {
      setLoading(false)
    }
  }

  const handleSmartWrite = async () => {
    if (!input.trim() || loading || !activeDocId) return
    setSmartMode(true)
    const text = input.trim()
    setInput('')
    setMessages(prev => [...prev, { role: 'user', content: `Format this as markdown:\n${text}`, timestamp: Date.now() }])
    setLoading(true)
    try {
      const formatted = await formatAsMarkdown(text)
      useStore.getState().updateDoc(activeDocId, formatted)
      setMessages(prev => [...prev, { role: 'assistant', content: '✅ Formatted and inserted into the editor.', timestamp: Date.now() }])
    } catch (err: any) {
      setMessages(prev => [...prev, { role: 'assistant', content: `Error: ${err.message}`, timestamp: Date.now() }])
    } finally {
      setLoading(false)
      setSmartMode(false)
    }
  }

  const applyToEditor = (content: string) => {
    if (!activeDocId) return
    useStore.getState().updateDoc(activeDocId, content)
  }

  const handleClearHistory = () => {
    clearConversationHistory()
    setMessages([])
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-16 right-4 w-10 h-10 rounded-full bg-accent text-white flex items-center justify-center shadow-lg hover:opacity-90 transition-opacity z-30"
        title="AI Assistant"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M12 2a4 4 0 0 1 4 4v2a4 4 0 0 1-8 0V6a4 4 0 0 1 4-4z" />
          <path d="M16 14H8a4 4 0 0 0-4 4v2h16v-2a4 4 0 0 0-4-4z" />
        </svg>
      </button>
    )
  }

  return (
    <div className="fixed bottom-16 right-4 w-80 max-h-96 bg-surface border border-border rounded-lg shadow-xl flex flex-col z-30">
      <div className="flex items-center justify-between px-3 py-2 border-b border-border">
        <span className="text-sm font-medium text-text-primary">AI Assistant</span>
        <div className="flex items-center gap-1">
          {messages.length > 0 && (
            <button onClick={handleClearHistory} className="text-[10px] text-text-secondary hover:text-red-500 px-1" title="Clear history">
              Clear
            </button>
          )}
          {!configured && (
            <span className="text-[10px] text-red-500">Not configured</span>
          )}
          <button onClick={() => setOpen(false)} className="text-text-secondary hover:text-text-primary">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-2 text-sm max-h-60">
        {messages.length === 0 && (
          <p className="text-text-secondary text-xs text-center py-4">
            Ask me to edit, format, or help with markdown.<br />
            Or type text and use <strong>Smart Write</strong> to format it.
          </p>
        )}
        {messages.map((msg, i) => (
          <div key={i} className={`p-2 rounded ${msg.role === 'user' ? 'bg-surface-alt ml-4' : 'bg-surface-hover mr-4'}`}>
            <p className="text-xs font-medium text-text-secondary mb-1">{msg.role === 'user' ? 'You' : 'AI'}</p>
            <p className="text-text-primary whitespace-pre-wrap">{msg.content}</p>
            {msg.role === 'assistant' && msg.content.length > 10 && !msg.content.startsWith('Error') && !msg.content.startsWith('✅') && (
              <button
                onClick={() => applyToEditor(msg.content)}
                className="mt-1 text-xs text-accent hover:underline"
              >
                Apply to editor
              </button>
            )}
          </div>
        ))}
        {loading && <div className="text-xs text-text-secondary italic">Thinking...</div>}
        <div ref={endRef} />
      </div>

      <div className="p-3 border-t border-border">
        <div className="flex gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
            placeholder={configured ? "Ask AI anything..." : "Configure AI in Settings..."}
            className="flex-1 bg-surface-alt border border-border rounded px-2 py-1.5 text-sm text-text-primary placeholder-text-secondary outline-none focus:border-accent"
          />
          <button onClick={handleSend} disabled={loading || !input.trim() || !configured}
            className="px-2 py-1.5 rounded bg-accent text-white text-sm disabled:opacity-40 hover:opacity-90 transition-opacity">
            Send
          </button>
        </div>
        <button onClick={handleSmartWrite} disabled={loading || !input.trim() || !configured || !activeDocId}
          className="w-full mt-1 px-2 py-1 rounded text-xs bg-surface-alt text-text-secondary hover:text-text-primary disabled:opacity-40 transition-colors">
          {smartMode ? 'Formatting...' : 'Smart Write — format as markdown'}
        </button>
      </div>
    </div>
  )
}
