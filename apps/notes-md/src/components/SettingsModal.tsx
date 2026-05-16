import { useStore } from '../store/useStore'
import type { Settings } from '../types'

export default function SettingsModal() {
  const isOpen = useStore((s) => s.isSettingsOpen)
  const settings = useStore((s) => s.settings)
  const updateSettings = useStore((s) => s.updateSettings)
  const toggleSettings = useStore((s) => s.toggleSettings)

  if (!isOpen) return null

  const set = (key: keyof Settings, value: unknown) => {
    updateSettings({ [key]: value })
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
                      ? 'bg-blue-500 text-white'
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
