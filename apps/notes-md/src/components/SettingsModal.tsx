import { useState } from 'react'
import { useStore } from '../store/useStore'
import type { Settings, LayoutMode } from '../types'
import { getAIConfig, saveAIConfig, clearAIConfig, getAISkills, saveAISkills, resetAISkills } from '../utils/ai'

export default function SettingsModal() {
  const isOpen = useStore((s) => s.isSettingsOpen)
  const settings = useStore((s) => s.settings)
  const updateSettings = useStore((s) => s.updateSettings)
  const toggleSettings = useStore((s) => s.toggleSettings)
  const setLayoutMode = useStore((s) => s.setLayoutMode)
  const aiConfig = getAIConfig()
  const [aiEndpoint, setAiEndpoint] = useState(aiConfig?.endpoint || 'https://api.openai.com/v1')
  const [aiKey, setAiKey] = useState(aiConfig?.apiKey || '')
  const [aiModel, setAiModel] = useState(aiConfig?.model || 'gpt-4o-mini')
  const [aiSaved, setAiSaved] = useState(false)
  const [aiSkills, setAiSkills] = useState(getAISkills())
  const [skillsSaved, setSkillsSaved] = useState(false)

  if (!isOpen) return null

  const set = (key: keyof Settings, value: unknown) => {
    updateSettings({ [key]: value })
  }

  const handleSaveAi = () => {
    saveAIConfig({ endpoint: aiEndpoint, apiKey: aiKey, model: aiModel })
    setAiSaved(true)
    setTimeout(() => setAiSaved(false), 2000)
  }

  const handleSaveSkills = () => {
    saveAISkills(aiSkills)
    setSkillsSaved(true)
    setTimeout(() => setSkillsSaved(false), 2000)
  }

  const handleResetSkills = () => {
    resetAISkills()
    setAiSkills('You are a helpful markdown writing assistant.')
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={toggleSettings}>
      <div
        className="bg-surface rounded-lg shadow-xl border border-border w-full max-w-md mx-4 max-h-[80vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h2 className="text-lg font-semibold text-text-primary">Settings</h2>
          <button onClick={toggleSettings} className="text-text-secondary hover:text-text-primary">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-5 space-y-5">
          {/* Theme */}
          <section>
            <label className="block text-sm font-medium text-text-primary mb-2">Theme</label>
            <div className="flex gap-2">
              {(['light', 'dark', 'system'] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => set('theme', t)}
                  className={`flex-1 py-2 px-3 rounded text-sm capitalize transition-colors ${
                    settings.theme === t
                      ? 'bg-accent text-white'
                      : 'bg-surface-alt text-text-secondary hover:bg-surface-hover'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </section>

          {/* Editor */}
          <section>
            <h3 className="text-sm font-medium text-text-primary mb-3">Editor</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-sm text-text-secondary">Font Size</label>
                <div className="flex items-center gap-2">
                  <input
                    type="range"
                    min={10}
                    max={24}
                    value={settings.fontSize}
                    onChange={(e) => set('fontSize', parseInt(e.target.value))}
                    className="w-24"
                  />
                  <span className="text-sm text-text-primary w-8 text-right">{settings.fontSize}</span>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <label className="text-sm text-text-secondary">Font Family</label>
                <select
                  value={settings.fontFamily}
                  onChange={(e) => set('fontFamily', e.target.value)}
                  className="bg-surface-alt border border-border rounded px-2 py-1 text-sm text-text-primary"
                >
                  <option value="Fira Code, Consolas, monospace">Fira Code</option>
                  <option value="Consolas, monospace">Consolas</option>
                  <option value="'Courier New', monospace">Courier New</option>
                  <option value="'JetBrains Mono', monospace">JetBrains Mono</option>
                </select>
              </div>
              <div className="flex items-center justify-between">
                <label className="text-sm text-text-secondary">Show Line Numbers</label>
                <input
                  type="checkbox"
                  checked={settings.showLineNumbers}
                  onChange={(e) => set('showLineNumbers', e.target.checked)}
                  className="rounded border-border"
                />
              </div>
              <div className="flex items-center justify-between">
                <label className="text-sm text-text-secondary">Word Wrap</label>
                <input
                  type="checkbox"
                  checked={settings.wordWrap}
                  onChange={(e) => set('wordWrap', e.target.checked)}
                  className="rounded border-border"
                />
              </div>
            </div>
          </section>

          {/* Auto-save */}
          <section>
            <h3 className="text-sm font-medium text-text-primary mb-3">Auto-save</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-sm text-text-secondary">Enable Auto-save</label>
                <input
                  type="checkbox"
                  checked={settings.autoSave}
                  onChange={(e) => set('autoSave', e.target.checked)}
                  className="rounded border-border"
                />
              </div>
              {settings.autoSave && (
                <div className="flex items-center justify-between">
                  <label className="text-sm text-text-secondary">Delay (ms)</label>
                  <input
                    type="number"
                    min={500}
                    max={30000}
                    step={500}
                    value={settings.autoSaveDelay}
                    onChange={(e) => set('autoSaveDelay', parseInt(e.target.value))}
                    className="w-20 bg-surface-alt border border-border rounded px-2 py-1 text-sm text-text-primary text-right"
                  />
                </div>
              )}
            </div>
          </section>

          {/* Layout Mode */}
          <section>
            <h3 className="text-sm font-medium text-text-primary mb-3">Layout Mode</h3>
            <div className="flex gap-2">
              {(['classic', 'vscode', 'notes'] as LayoutMode[]).map((mode) => (
                <button
                  key={mode}
                  onClick={() => setLayoutMode(mode)}
                  className={`flex-1 py-2 px-3 rounded text-sm capitalize transition-colors ${
                    settings.layoutMode === mode
                      ? 'bg-accent text-white'
                      : 'bg-surface-alt text-text-secondary hover:bg-surface-hover'
                  }`}
                >
                  {mode}
                </button>
              ))}
            </div>
          </section>

          {/* Layout */}
          <section>
            <h3 className="text-sm font-medium text-text-primary mb-3">Layout</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-sm text-text-secondary">Show File Sidebar</label>
                <input
                  type="checkbox"
                  checked={settings.showSidebar}
                  onChange={(e) => set('showSidebar', e.target.checked)}
                  className="rounded border-border"
                />
              </div>
              <div className="flex items-center justify-between">
                <label className="text-sm text-text-secondary">Side-by-side View</label>
                <input
                  type="checkbox"
                  checked={settings.sideBySide}
                  onChange={(e) => set('sideBySide', e.target.checked)}
                  className="rounded border-border"
                />
              </div>
            </div>
          </section>
        </div>

        {/* AI Assistant */}
        <div className="px-5">
          <section>
            <h3 className="text-sm font-medium text-text-primary mb-3">AI Assistant</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-text-secondary mb-1">API Endpoint</label>
                <input value={aiEndpoint} onChange={(e) => setAiEndpoint(e.target.value)}
                  placeholder="https://api.openai.com/v1"
                  className="w-full bg-surface-alt border border-border rounded px-2 py-1.5 text-sm text-text-primary outline-none focus:border-accent" />
              </div>
              <div>
                <label className="block text-xs text-text-secondary mb-1">API Key</label>
                <input type="password" value={aiKey} onChange={(e) => setAiKey(e.target.value)}
                  placeholder="sk-..."
                  className="w-full bg-surface-alt border border-border rounded px-2 py-1.5 text-sm text-text-primary outline-none focus:border-accent" />
              </div>
              <div>
                <label className="block text-xs text-text-secondary mb-1">Model</label>
                <input value={aiModel} onChange={(e) => setAiModel(e.target.value)}
                  placeholder="gpt-4o-mini"
                  className="w-full bg-surface-alt border border-border rounded px-2 py-1.5 text-sm text-text-primary outline-none focus:border-accent" />
              </div>
              <div className="flex gap-2">
                <button onClick={handleSaveAi}
                  className="flex-1 py-1.5 rounded bg-accent text-white text-sm hover:opacity-90 transition-opacity">
                  {aiSaved ? 'Saved!' : 'Save AI Config'}
                </button>
                <button onClick={() => { clearAIConfig(); setAiKey('') }}
                  className="py-1.5 px-3 rounded bg-surface-alt text-text-secondary text-sm hover:text-red-500 transition-colors">
                  Clear
                </button>
              </div>
              <div className="mt-4">
                <label className="block text-xs text-text-secondary mb-1">Custom Instructions</label>
                <textarea
                  value={aiSkills}
                  onChange={(e) => setAiSkills(e.target.value)}
                  placeholder="You are a helpful markdown writing assistant."
                  rows={3}
                  className="w-full bg-surface-alt border border-border rounded px-2 py-1.5 text-sm text-text-primary outline-none focus:border-accent resize-none"
                />
                <div className="flex gap-2 mt-2">
                  <button onClick={handleSaveSkills}
                    className="flex-1 py-1.5 rounded bg-surface-alt text-text-primary text-sm hover:bg-surface-hover transition-colors">
                    {skillsSaved ? 'Saved!' : 'Save Instructions'}
                  </button>
                  <button onClick={handleResetSkills}
                    className="py-1.5 px-3 rounded bg-surface-alt text-text-secondary text-sm hover:text-red-500 transition-colors">
                    Reset
                  </button>
                </div>
                <p className="text-[10px] text-text-secondary mt-1">These instructions are used as the AI's system prompt.</p>
              </div>
              <p className="text-[10px] text-text-secondary">Compatible with OpenAI, OpenRouter, Ollama, or any OpenAI-compatible API.</p>
            </div>
          </section>
        </div>

        {/* About */}
        <div className="px-5 pb-5">
          <section>
            <h3 className="text-sm font-medium text-text-primary mb-3">About notes.md</h3>
            <div className="space-y-2 text-sm text-text-secondary">
              <p>Cross-platform markdown editor with backend conversion and mobile app.</p>
              <div>
                <a
                  href={`${window.location.protocol}//${window.location.hostname}:8000/download/apk`}
                  className="inline-flex items-center gap-1.5 text-accent hover:underline"
                  download
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="7 10 12 15 17 10" />
                    <line x1="12" y1="15" x2="12" y2="3" />
                  </svg>
                  Download Android APK (alpha)
                </a>
              </div>
            </div>
          </section>
        </div>

        <div className="px-5 py-3 border-t border-border text-right">
          <button
            onClick={toggleSettings}
            className="px-4 py-2 rounded bg-surface-alt text-text-primary hover:bg-surface-hover transition-colors text-sm"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
