import { useStore } from '../store/useStore'

export default function TabBar() {
  const tabs = useStore((s) => s.tabs)
  const activeDocId = useStore((s) => s.activeDocId)
  const docs = useStore((s) => s.docs)
  const setActiveTab = useStore((s) => s.setActiveTab)
  const closeTab = useStore((s) => s.closeTab)

  return (
    <div className="flex items-center bg-surface-alt border-b border-border overflow-x-auto">
      {tabs.map((tab) => {
        const doc = docs.find((d) => d.id === tab.docId)
        const isActive = tab.docId === activeDocId
        return (
          <div
            key={tab.docId}
            onClick={() => setActiveTab(tab.docId)}
            className={`
              flex items-center gap-1 px-3 py-2 cursor-pointer select-none
              border-r border-border text-sm whitespace-nowrap
              transition-colors duration-150
              ${isActive
                ? 'bg-surface text-text-primary border-b-2 border-b-blue-500'
                : 'text-text-secondary hover:bg-surface-hover'
              }
            `}
          >
            {tab.isDirty && (
              <span className="w-2 h-2 rounded-full bg-yellow-500 flex-shrink-0" title="Unsaved changes" />
            )}
            <span>{doc?.title || 'Untitled'}</span>
            <button
              onClick={(e) => { e.stopPropagation(); closeTab(tab.docId) }}
              className="ml-1 p-0.5 rounded hover:bg-surface-hover text-text-secondary hover:text-text-primary transition-colors"
              title="Close tab"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          </div>
        )
      })}
    </div>
  )
}
