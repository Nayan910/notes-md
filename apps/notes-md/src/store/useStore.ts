import { create } from 'zustand'
import { v4 as uuidv4 } from 'uuid'
import type { Document, Settings, ViewMode, Tab, LayoutMode } from '../types'
import {
  loadDocs, saveDocs,
  loadSettings, saveSettings,
  loadTabs, saveTabs,
  loadActiveDoc, saveActiveDoc,
} from '../utils/storage'

const DEFAULT_SETTINGS: Settings = {
  fontSize: 14,
  fontFamily: 'Fira Code, Consolas, monospace',
  theme: 'system',
  showLineNumbers: true,
  wordWrap: true,
  autoSave: true,
  autoSaveDelay: 2000,
  sideBySide: true,
  showSidebar: true,
  layoutMode: 'classic',
}

interface AppState {
  docs: Document[]
  tabs: Tab[]
  activeDocId: string | null
  settings: Settings
  viewMode: ViewMode
  isSettingsOpen: boolean

  // Doc actions
  createDoc: (title?: string, content?: string) => string
  updateDoc: (id: string, content: string) => void
  renameDoc: (id: string, title: string) => void
  deleteDoc: (id: string) => void
  getDoc: (id: string) => Document | undefined
  isDirty: (id: string) => boolean
  markClean: (id: string) => void
  importDoc: (content: string, title?: string) => string

  // Tab actions
  openTab: (docId: string) => void
  closeTab: (docId: string) => void
  setActiveTab: (docId: string) => void
  reorderTabs: (tabs: Tab[]) => void

  // Settings actions
  updateSettings: (partial: Partial<Settings>) => void
  setViewMode: (mode: ViewMode) => void
  setLayoutMode: (mode: LayoutMode) => void
  toggleSettings: () => void
}

function validateDoc(doc: Document): boolean {
  return typeof doc.id === 'string' &&
    typeof doc.title === 'string' &&
    typeof doc.content === 'string' &&
    typeof doc.createdAt === 'number' &&
    typeof doc.updatedAt === 'number'
}

function persistDocs(get: () => AppState) {
  const { docs } = get()
  saveDocs(docs)
}

function persistTabs(get: () => AppState) {
  const { tabs } = get()
  saveTabs(tabs.map((t) => t.docId))
}

function persistActive(get: () => AppState) {
  saveActiveDoc(get().activeDocId)
}

export const useStore = create<AppState>((set, get) => {
  // Initial load
  const savedDocs = loadDocs().filter(validateDoc)
  const savedTabsIds = loadTabs()
  const activeId = loadActiveDoc()
  const savedSettings = loadSettings()

  const initialTabs: Tab[] = savedTabsIds
    .filter((id) => savedDocs.some((d) => d.id === id))
    .map((id) => ({ docId: id, isDirty: false }))

  const initialActive = activeId && initialTabs.some((t) => t.docId === activeId)
    ? activeId
    : initialTabs[0]?.docId ?? null

  return {
    docs: savedDocs,
    tabs: initialTabs,
    activeDocId: initialActive,
    settings: savedSettings ? { ...DEFAULT_SETTINGS, ...savedSettings } : DEFAULT_SETTINGS,
    viewMode: 'both',
    isSettingsOpen: false,

    createDoc: (title?: string, content?: string) => {
      const doc: Document = {
        id: uuidv4(),
        title: title || 'Untitled',
        content: content || '',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }
      set((s) => ({ docs: [...s.docs, doc] }))
      get().openTab(doc.id)
      return doc.id
    },

    updateDoc: (id: string, content: string) => {
      set((s) => ({
        docs: s.docs.map((d) =>
          d.id === id ? { ...d, content, updatedAt: Date.now() } : d
        ),
        tabs: s.tabs.map((t) =>
          t.docId === id ? { ...t, isDirty: true } : t
        ),
      }))
      persistDocs(get)
    },

    renameDoc: (id: string, title: string) => {
      set((s) => ({
        docs: s.docs.map((d) =>
          d.id === id ? { ...d, title, updatedAt: Date.now() } : d
        ),
      }))
      persistDocs(get)
    },

    deleteDoc: (id: string) => {
      set((s) => ({
        docs: s.docs.filter((d) => d.id !== id),
        tabs: s.tabs.filter((t) => t.docId !== id),
        activeDocId: s.activeDocId === id
          ? (s.tabs.filter((t) => t.docId !== id)[0]?.docId ?? null)
          : s.activeDocId,
      }))
      persistDocs(get)
      persistTabs(get)
      persistActive(get)
    },

    getDoc: (id: string) => get().docs.find((d) => d.id === id),

    isDirty: (id: string) => {
      const tab = get().tabs.find((t) => t.docId === id)
      return tab?.isDirty ?? false
    },

    markClean: (id: string) => {
      set((s) => ({
        tabs: s.tabs.map((t) =>
          t.docId === id ? { ...t, isDirty: false } : t
        ),
      }))
    },

    importDoc: (content: string, title?: string) => {
      const firstLine = content.split('\n')[0]?.replace(/^#\s*/, '') || 'Untitled'
      return get().createDoc(title || firstLine || 'Imported', content)
    },

    openTab: (docId: string) => {
      set((s) => {
        if (s.tabs.some((t) => t.docId === docId)) {
          return { activeDocId: docId }
        }
        return {
          tabs: [...s.tabs, { docId, isDirty: false }],
          activeDocId: docId,
        }
      })
      persistTabs(get)
      persistActive(get)
    },

    closeTab: (docId: string) => {
      set((s) => {
        const newTabs = s.tabs.filter((t) => t.docId !== docId)
        let newActive = s.activeDocId
        if (s.activeDocId === docId) {
          const idx = s.tabs.findIndex((t) => t.docId === docId)
          newActive = newTabs[Math.min(idx, newTabs.length - 1)]?.docId ?? null
        }
        return { tabs: newTabs, activeDocId: newActive }
      })
      persistTabs(get)
      persistActive(get)
    },

    setActiveTab: (docId: string) => {
      set({ activeDocId: docId })
      persistActive(get)
    },

    reorderTabs: (tabs: Tab[]) => {
      set({ tabs })
      persistTabs(get)
    },

    updateSettings: (partial: Partial<Settings>) => {
      set((s) => {
        const newSettings = { ...s.settings, ...partial }
        saveSettings(newSettings)
        return { settings: newSettings }
      })
    },

    setViewMode: (mode: ViewMode) => set({ viewMode: mode }),
    setLayoutMode: (mode: LayoutMode) => get().updateSettings({ layoutMode: mode }),

    toggleSettings: () => set((s) => ({ isSettingsOpen: !s.isSettingsOpen })),
  }
})
