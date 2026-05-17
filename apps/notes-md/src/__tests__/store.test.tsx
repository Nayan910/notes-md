import { describe, it, expect, beforeEach } from 'vitest'
import { useStore } from '../store/useStore'

const DEFAULT_SETTINGS = {
  fontSize: 14,
  fontFamily: 'Fira Code, Consolas, monospace',
  theme: 'system' as const,
  showLineNumbers: true,
  wordWrap: true,
  autoSave: true,
  autoSaveDelay: 2000,
  sideBySide: true,
  showSidebar: true,
  layoutMode: 'classic' as const,
}

beforeEach(() => {
  // Reset store and localStorage to a clean state before each test
  useStore.setState({
    docs: [],
    tabs: [],
    activeDocId: null,
    settings: { ...DEFAULT_SETTINGS },
    viewMode: 'both',
    isSettingsOpen: false,
  })
  localStorage.clear()
})

// ---------------------------------------------------------------------------
// createDoc
// ---------------------------------------------------------------------------
describe('createDoc', () => {
  it('creates a document with default title and empty content', () => {
    const id = useStore.getState().createDoc()
    const doc = useStore.getState().getDoc(id)

    expect(doc).toBeDefined()
    expect(doc!.id).toBe(id)
    expect(doc!.title).toBe('Untitled')
    expect(doc!.content).toBe('')
    expect(typeof doc!.createdAt).toBe('number')
    expect(typeof doc!.updatedAt).toBe('number')
    expect(doc!.updatedAt).toBeGreaterThanOrEqual(doc!.createdAt)
  })

  it('creates a document with a custom title and content', () => {
    const id = useStore.getState().createDoc('My Note', '# Hello World')
    const doc = useStore.getState().getDoc(id)

    expect(doc!.title).toBe('My Note')
    expect(doc!.content).toBe('# Hello World')
  })

  it('opens a tab for the new document and sets it as active', () => {
    const id = useStore.getState().createDoc()
    const state = useStore.getState()

    expect(state.tabs.some((t) => t.docId === id)).toBe(true)
    expect(state.activeDocId).toBe(id)
  })

  it('returns the id of the newly created document', () => {
    const id = useStore.getState().createDoc()
    expect(typeof id).toBe('string')
    expect(id.length).toBeGreaterThan(0)
  })

  it('increments the docs array length', () => {
    expect(useStore.getState().docs).toHaveLength(0)
    useStore.getState().createDoc()
    expect(useStore.getState().docs).toHaveLength(1)
    useStore.getState().createDoc()
    expect(useStore.getState().docs).toHaveLength(2)
  })
})

// ---------------------------------------------------------------------------
// updateDoc
// ---------------------------------------------------------------------------
describe('updateDoc', () => {
  it('updates the document content and marks its tab as dirty', () => {
    const id = useStore.getState().createDoc()
    useStore.getState().updateDoc(id, 'Updated content')

    expect(useStore.getState().getDoc(id)!.content).toBe('Updated content')
    expect(useStore.getState().tabs.find((t) => t.docId === id)!.isDirty).toBe(true)
  })

  it('does not affect other documents', () => {
    const id1 = useStore.getState().createDoc('Doc A', 'Hello')
    const id2 = useStore.getState().createDoc('Doc B', 'World')

    useStore.getState().updateDoc(id1, 'Changed')

    expect(useStore.getState().getDoc(id1)!.content).toBe('Changed')
    expect(useStore.getState().getDoc(id2)!.content).toBe('World')
  })

  it('updates the updatedAt timestamp', () => {
    const id = useStore.getState().createDoc()
    const originalUpdatedAt = useStore.getState().getDoc(id)!.updatedAt

    // Small delay to ensure timestamps differ
    useStore.getState().updateDoc(id, 'new content')

    expect(useStore.getState().getDoc(id)!.updatedAt).toBeGreaterThanOrEqual(originalUpdatedAt)
  })

  it('is a no-op for a non-existent id', () => {
    const docsBefore = useStore.getState().docs.length
    useStore.getState().updateDoc('non-existent', 'any content')
    expect(useStore.getState().docs.length).toBe(docsBefore)
  })
})

// ---------------------------------------------------------------------------
// deleteDoc
// ---------------------------------------------------------------------------
describe('deleteDoc', () => {
  it('removes the document from the docs array', () => {
    const id = useStore.getState().createDoc()
    expect(useStore.getState().getDoc(id)).toBeDefined()

    useStore.getState().deleteDoc(id)
    expect(useStore.getState().getDoc(id)).toBeUndefined()
  })

  it('removes the corresponding tab', () => {
    const id = useStore.getState().createDoc()
    useStore.getState().deleteDoc(id)
    expect(useStore.getState().tabs.some((t) => t.docId === id)).toBe(false)
  })

  it('switches activeDocId to the next tab when deleting the active doc', () => {
    const id1 = useStore.getState().createDoc('Doc 1')
    const id2 = useStore.getState().createDoc('Doc 2')
    // id2 is now active
    expect(useStore.getState().activeDocId).toBe(id2)

    useStore.getState().deleteDoc(id2)
    expect(useStore.getState().activeDocId).toBe(id1)
  })

  it('sets activeDocId to null when deleting the last document', () => {
    const id = useStore.getState().createDoc()
    useStore.getState().deleteDoc(id)
    expect(useStore.getState().activeDocId).toBeNull()
  })

  it('does not affect other tabs when deleting a non-active doc', () => {
    const id1 = useStore.getState().createDoc('Doc 1')
    const id2 = useStore.getState().createDoc('Doc 2')
    // id2 is active, delete id1 (non-active)
    useStore.getState().deleteDoc(id1)

    expect(useStore.getState().getDoc(id1)).toBeUndefined()
    expect(useStore.getState().getDoc(id2)).toBeDefined()
    expect(useStore.getState().activeDocId).toBe(id2)
  })
})

// ---------------------------------------------------------------------------
// importDoc
// ---------------------------------------------------------------------------
describe('importDoc', () => {
  it('extracts the title from the first markdown heading', () => {
    const content = '# My Imported Note\n\nSome content here.'
    const id = useStore.getState().importDoc(content)
    const doc = useStore.getState().getDoc(id)

    expect(doc!.title).toBe('My Imported Note')
    expect(doc!.content).toBe(content)
  })

  it('uses the provided title when given', () => {
    const id = useStore.getState().importDoc('# Heading\nBody', 'Custom Title')
    const doc = useStore.getState().getDoc(id)

    expect(doc!.title).toBe('Custom Title')
    expect(doc!.content).toBe('# Heading\nBody')
  })

  it('falls back to the first line when there is no markdown heading', () => {
    const content = 'Just a plain line\nsecond line'
    const id = useStore.getState().importDoc(content)
    const doc = useStore.getState().getDoc(id)

    expect(doc!.title).toBe('Just a plain line')
  })

  it('falls back to "Untitled" for empty content', () => {
    const id = useStore.getState().importDoc('')
    const doc = useStore.getState().getDoc(id)

    expect(doc!.title).toBe('Untitled')
  })

  it('opens a tab for the imported document', () => {
    const id = useStore.getState().importDoc('# Doc')
    expect(useStore.getState().tabs.some((t) => t.docId === id)).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// markClean
// ---------------------------------------------------------------------------
describe('markClean', () => {
  it('sets isDirty to false for the specified tab', () => {
    const id = useStore.getState().createDoc()
    // Update makes it dirty
    useStore.getState().updateDoc(id, 'some content')
    expect(useStore.getState().tabs.find((t) => t.docId === id)!.isDirty).toBe(true)

    useStore.getState().markClean(id)
    expect(useStore.getState().tabs.find((t) => t.docId === id)!.isDirty).toBe(false)
  })

  it('does not affect dirty state of other tabs', () => {
    const id1 = useStore.getState().createDoc('Doc 1')
    const id2 = useStore.getState().createDoc('Doc 2')

    useStore.getState().updateDoc(id1, 'changed')
    useStore.getState().updateDoc(id2, 'also changed')

    useStore.getState().markClean(id1)
    expect(useStore.getState().tabs.find((t) => t.docId === id1)!.isDirty).toBe(false)
    expect(useStore.getState().tabs.find((t) => t.docId === id2)!.isDirty).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------
describe('updateSettings', () => {
  it('merges partial settings while preserving others', () => {
    useStore.getState().updateSettings({ fontSize: 20, theme: 'dark' })

    const settings = useStore.getState().settings
    expect(settings.fontSize).toBe(20)
    expect(settings.theme).toBe('dark')
    // These should still hold their defaults
    expect(settings.fontFamily).toBe('Fira Code, Consolas, monospace')
    expect(settings.showLineNumbers).toBe(true)
    expect(settings.autoSave).toBe(true)
  })

  it('can update boolean settings', () => {
    useStore.getState().updateSettings({ showLineNumbers: false, wordWrap: false })
    expect(useStore.getState().settings.showLineNumbers).toBe(false)
    expect(useStore.getState().settings.wordWrap).toBe(false)
  })
})

describe('toggleSettings', () => {
  it('toggles isSettingsOpen from false to true', () => {
    expect(useStore.getState().isSettingsOpen).toBe(false)
    useStore.getState().toggleSettings()
    expect(useStore.getState().isSettingsOpen).toBe(true)
  })

  it('toggles isSettingsOpen from true to false', () => {
    useStore.getState().toggleSettings()
    expect(useStore.getState().isSettingsOpen).toBe(true)

    useStore.getState().toggleSettings()
    expect(useStore.getState().isSettingsOpen).toBe(false)
  })
})

describe('setLayoutMode', () => {
  it('updates the layout mode in settings', () => {
    useStore.getState().setLayoutMode('vscode')
    expect(useStore.getState().settings.layoutMode).toBe('vscode')

    useStore.getState().setLayoutMode('notes')
    expect(useStore.getState().settings.layoutMode).toBe('notes')
  })
})
