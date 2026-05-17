import { useState, useCallback, useEffect } from 'react'
import { useStore } from '../store/useStore'

export default function SpeechBar() {
  const [speaking, setSpeaking] = useState(false)
  const [listening, setListening] = useState(false)
  const [interim, setInterim] = useState('')
  const activeDocId = useStore((s) => s.activeDocId)
  const doc = activeDocId ? useStore.getState().getDoc(activeDocId) : undefined

  const speak = useCallback(() => {
    if (!doc?.content) return
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel()
      const utter = new SpeechSynthesisUtterance(doc.content)
      utter.onend = () => setSpeaking(false)
      utter.onerror = () => setSpeaking(false)
      setSpeaking(true)
      window.speechSynthesis.speak(utter)
    }
  }, [doc])

  const stopSpeak = useCallback(() => {
    window.speechSynthesis?.cancel()
    setSpeaking(false)
  }, [])

  useEffect(() => {
    if (!listening || !('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) return
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    const recognition = new SpeechRecognition()
    recognition.continuous = true
    recognition.interimResults = true
    recognition.lang = 'en-US'

    recognition.onresult = (event: any) => {
      let final = ''
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          final += event.results[i][0].transcript
        } else {
          setInterim(event.results[i][0].transcript)
        }
      }
      if (final && activeDocId) {
        const store = useStore.getState()
        const current = store.getDoc(activeDocId)
        if (current) {
          store.updateDoc(activeDocId, current.content + final)
        }
      }
    }
    recognition.onerror = () => setListening(false)
    recognition.onend = () => { if (listening) recognition.start() }

    recognition.start()
    return () => { recognition.stop(); setInterim('') }
  }, [listening, activeDocId])

  return (
    <div className="flex items-center gap-1 px-2 py-1 bg-surface-alt border-t border-border">
      <button
        onClick={() => speaking ? stopSpeak() : speak()}
        className={`toolbar-btn ${speaking ? 'text-accent' : ''}`}
        title={speaking ? 'Stop reading' : 'Read aloud (TTS)'}
        disabled={!doc?.content}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          {speaking ? (
            <><rect x="6" y="4" width="4" height="16" /><rect x="14" y="4" width="4" height="16" /></>
          ) : (
            <><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" /><path d="M15.54 8.46a5 5 0 0 1 0 7.07" /><path d="M19.07 4.93a10 10 0 0 1 0 14.14" /></>
          )}
        </svg>
      </button>
      <button
        onClick={() => setListening(!listening)}
        className={`toolbar-btn ${listening ? 'text-red-500' : ''}`}
        title={listening ? 'Stop dictation' : 'Start dictation (STT)'}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
          <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
          <line x1="12" y1="19" x2="12" y2="23" />
          <line x1="8" y1="23" x2="16" y2="23" />
        </svg>
      </button>
      {interim && <span className="text-xs text-text-secondary italic ml-2">{interim}...</span>}
      {listening && <span className="text-xs text-red-500 font-medium">Listening...</span>}
    </div>
  )
}
