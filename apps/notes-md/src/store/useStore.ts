import { create } from 'zustand'
import { v4 as uuidv4 } from 'uuid'
import type { Document, Settings, ViewMode, Tab, LayoutMode } from '../types'
import {
  loadDocs, saveDocs,
  loadSettings, saveSettings,
  loadTabs, saveTabs,
  loadActiveDoc, saveActiveDoc,
} from '../utils/storage'
import {
  isBridgeAvailable,
  createFile as bridgeCreateFile,
  saveFile as bridgeSaveFile,
  deleteFile as bridgeDeleteFile,
  renameFile as bridgeRenameFile,
  loadFile as bridgeLoadFile,
  loadFileList as bridgeLoadFileList,
  type NoteFile,
} from '../utils/bridge-storage'

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
  /**
   * `true` when running inside the Flutter app (window.flutter_postMessage
   * is available). The UI may use this to hide IDB-only controls or
   * surface bridge-specific affordances.
   */
  bridgeAvailable: boolean

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

  // Bridge actions
  /**
   * Load every .md file from the bridge (or IDB fallback) and replace the
   * in-memory doc list with the result. Called from bootstrap and from
   * the `notes-list-updated` event handler.
   *
   * Returns the list of loaded NoteFile entries so the caller can show
   * progress / error messages if desired.
   */
  loadAllFiles: () => Promise<NoteFile[]>
  /** Open an existing file by its on-disk path. */
  openByPath: (path: string) => Promise<void>
  /** Open a file whose contents Flutter just sent us. */
  openFileFromBridge: (path: string, content: string, title?: string) => void
  /** Replace the in-memory doc list wholesale (used by bootstrap). */
  replaceDocs: (docs: Document[]) => void

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

/** Strip a basename from a path (handles both `/` and `\` separators). */
function pathBasename(p: string): string {
  const m = p.match(/[^/\\]+$/);
  return m ? m[0] : p;
}

/** Strip the `.md` extension from a filename (case-insensitive). */
function stripMdExt(name: string): string {
  return name.replace(/\.md$/i, '');
}

/** Build a stable ID for a file-backed doc so we can find it again. */
function pathToDocId(path: string): string {
  // uuidv4 is overkill for a key, but a hash keeps things simple.
  // We rely on the path being unique per file on disk.
  return `path:${path}`;
}

export const useStore = create<AppState>((set, get) => {
  // Initial load
  const savedDocs = loadDocs().filter(validateDoc)
  const savedTabsIds = loadTabs()
  const activeId = loadActiveDoc()
  const savedSettings = loadSettings()
  const bridgeAvailable = isBridgeAvailable()

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
    bridgeAvailable,

    createDoc: (title?: string, content?: string) => {
      const docTitle = title || 'Untitled'
      const doc: Document = {
        id: uuidv4(),
        title: docTitle,
        content: content || '',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }
      set((s) => ({ docs: [...s.docs, doc] }))
      get().openTab(doc.id)
      persistDocs(get)

      // Background: create a real file on disk (bridge) or in IDB.
      bridgeCreateFile(docTitle).then(({ path }) => {
        set((s) => ({
          docs: s.docs.map((d) => d.id === doc.id ? { ...d, path, title: stripMdExt(pathBasename(path)) || d.title } : d),
        }))
        persistDocs(get)
      }).catch((e) => {
        // In IDB mode this is a no-op fallback; in bridge mode the file
        // creation failed — log and keep the in-memory doc anyway.
        console.warn('[store] createDoc bridge call failed:', e)
      })

      return doc.id
    },

    updateDoc: (id: string, content: string) => {
      let pathToSave: string | undefined
      set((s) => ({
        docs: s.docs.map((d) => {
          if (d.id !== id) return d
          pathToSave = d.path
          return { ...d, content, updatedAt: Date.now() }
        }),
        tabs: s.tabs.map((t) =>
          t.docId === id ? { ...t, isDirty: true } : t
        ),
      }))
      persistDocs(get)

      // Background: persist to disk. We re-read the path from the latest
      // state to capture renames that happened in between.
      const finalPath = pathToSave ?? get().docs.find((d) => d.id === id)?.path
      if (finalPath) {
        bridgeSaveFile(finalPath, content).catch((e) => {
          console.warn(`[store] updateDoc bridge save failed for ${finalPath}:`, e)
        })
      }
    },

    renameDoc: (id: string, title: string) => {
      const oldPath = get().docs.find((d) => d.id === id)?.path
      set((s) => ({
        docs: s.docs.map((d) =>
          d.id === id ? { ...d, title, updatedAt: Date.now() } : d
        ),
      }))
      persistDocs(get)

      // Background: rename on disk. We only send the *base name* to the
      // bridge (matches the existing `rename-note` protocol which takes
      // `newName`, not a full path). If the file has no path, this is a
      // no-op in IDB mode and skipped in bridge mode.
      if (oldPath) {
        bridgeRenameFile(oldPath, title).then(({ newPath }) => {
          set((s) => ({
            docs: s.docs.map((d) => d.id === id ? { ...d, path: newPath } : d),
          }))
          persistDocs(get)
        }).catch((e) => {
          console.warn(`[store] renameDoc bridge call failed for ${oldPath}:`, e)
        })
      }
    },

    deleteDoc: (id: string) => {
      const docToDelete = get().docs.find((d) => d.id === id)
      const pathToDelete = docToDelete?.path
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

      // Background: delete from disk. If the file has no path, the
      // bridge fallback uses IDB; otherwise the bridge is the source of
      // truth.
      if (pathToDelete) {
        bridgeDeleteFile(pathToDelete).catch((e) => {
          console.warn(`[store] deleteDoc bridge call failed for ${pathToDelete}:`, e)
        })
      }
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

    /* ----------------- Bridge actions ----------------- */

    loadAllFiles: async () => {
      const files = await bridgeLoadFileList()
      if (files.length === 0) return files

      // Read each file in parallel, then merge with existing docs (keeping
      // dirty in-memory edits for files we already had open).
      const results = await Promise.allSettled(
        files.map((f) => bridgeLoadFile(f.path))
      )

      const currentDocs = get().docs
      const freshDocs: Document[] = []
      const now = Date.now()

      results.forEach((r, idx) => {
        if (r.status !== 'fulfilled') {
          console.warn(`[store] Failed to load file ${files[idx].path}:`, r.reason)
          return
        }
        const file = files[idx]
        const { content } = r.value
        // Match by path. If we already have a doc for this path, keep the
        // in-memory content (might be dirty). Otherwise create a fresh one.
        const existing = currentDocs.find((d) => d.path === file.path)
        if (existing) {
          freshDocs.push({
            ...existing,
            title: stripMdExt(file.name) || existing.title,
            size: file.size,
          } as Document)
        } else {
          const id = pathToDocId(file.path)
          freshDocs.push({
            id,
            title: stripMdExt(file.name),
            content,
            path: file.path,
            createdAt: file.modified || now,
            updatedAt: file.modified || now,
          })
        }
      })

      set({ docs: freshDocs })
      persistDocs(get)
      return files
    },

    openByPath: async (path: string) => {
      const existing = get().docs.find((d) => d.path === path)
      if (existing) {
        get().openTab(existing.id)
        return
      }
      try {
        const { content } = await bridgeLoadFile(path)
        const name = stripMdExt(pathBasename(path))
        const now = Date.now()
        const newDoc: Document = {
          id: pathToDocId(path),
          title: name,
          content,
          path,
          createdAt: now,
          updatedAt: now,
        }
        set((s) => ({ docs: [...s.docs, newDoc] }))
        persistDocs(get)
        get().openTab(newDoc.id)
      } catch (e) {
        console.warn(`[store] openByPath(${path}) failed:`, e)
        throw e
      }
    },

    openFileFromBridge: (path: string, content: string, title?: string) => {
      const existing = get().docs.find((d) => d.path === path)
      if (existing) {
        // Update the in-memory content with the fresh disk version.
        set((s) => ({
          docs: s.docs.map((d) => d.id === existing.id ? { ...d, content, updatedAt: Date.now() } : d),
        }))
        get().openTab(existing.id)
        persistDocs(get)
        return
      }
      const now = Date.now()
      const newDoc: Document = {
        id: pathToDocId(path),
        title: title || stripMdExt(pathBasename(path)),
        content,
        path,
        createdAt: now,
        updatedAt: now,
      }
      set((s) => ({ docs: [...s.docs, newDoc] }))
      get().openTab(newDoc.id)
      persistDocs(get)
    },

    replaceDocs: (docs: Document[]) => {
      set({ docs })
      persistDocs(get)
    },

    /* ----------------- Settings ----------------- */

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

// Expose the store to Flutter so its `evaluateJavascript` hooks
// (e.g. the Save button in the toolbar) can read the active doc.
// This is a no-op in the browser standalone build.
if (typeof window !== 'undefined') {
  ;(window as unknown as { __ZUSTAND_STORE__: typeof useStore }).__ZUSTAND_STORE__ = useStore
}
