/**
 * Store bootstrap.
 *
 * Loads data from IndexedDB asynchronously after the store is initialized
 * with empty/sync-loaded data. This is needed because IDB is async but the
 * Zustand store must be created synchronously.
 *
 * Flow:
 * 1. useStore() initializes with whatever localStorage has (fast, sync)
 * 2. This bootstrap runs in parallel, loading from IDB
 * 3. If IDB has more/different data, the store is updated
 * 4. If a Flutter bridge is available, we re-load from disk to make the
 *    on-disk file list the source of truth
 * 5. UI re-renders with the correct data
 */

import { useStore } from './useStore';
import { getAllDocs, getSettings, getTabs, getActive, migrateFromLocalStorage } from '../utils/idb-storage';
import { isBridgeAvailable, loadFileList, loadFile } from '../utils/bridge-storage';
import { v4 as uuidv4 } from 'uuid';
import type { Document, Settings, Tab } from '../types';

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
};

function validateDoc(doc: Document): boolean {
  return (
    typeof doc.id === 'string' &&
    typeof doc.title === 'string' &&
    typeof doc.content === 'string' &&
    typeof doc.createdAt === 'number' &&
    typeof doc.updatedAt === 'number'
  );
}

function stripMdExt(name: string): string {
  return name.replace(/\.md$/i, '');
}

let bootstrapPromise: Promise<void> | null = null;

export function bootstrapStore(): Promise<void> {
  if (bootstrapPromise) return bootstrapPromise;

  bootstrapPromise = (async () => {
    // 1. Ensure localStorage → IDB migration has run
    await migrateFromLocalStorage();

    // 2. Load all data from IDB
    const [idbDocs, idbSettings, idbTabs, idbActive] = await Promise.all([
      getAllDocs(),
      getSettings(),
      getTabs(),
      getActive(),
    ]);

    const validDocs = idbDocs.filter(validateDoc);
    const currentState = useStore.getState();

    // 3. Only update if IDB has data AND it's different from current state
    if (validDocs.length > 0) {
      const currentDocIds = new Set(currentState.docs.map((d) => d.id));
      const idbDocIds = new Set(validDocs.map((d) => d.id));
      const isDifferent =
        currentDocIds.size !== idbDocIds.size ||
        ![...currentDocIds].every((id) => idbDocIds.has(id));

      if (isDifferent) {
        useStore.setState({ docs: validDocs });

        if (idbTabs && idbTabs.length > 0) {
          const validTabs: Tab[] = idbTabs
            .filter((id) => validDocs.some((d) => d.id === id))
            .map((id) => ({ docId: id, isDirty: false }));
          useStore.setState({ tabs: validTabs });

          if (idbActive && validTabs.some((t) => t.docId === idbActive)) {
            useStore.setState({ activeDocId: idbActive });
          } else {
            useStore.setState({ activeDocId: validTabs[0]?.docId ?? null });
          }
        }
      }
    }

    // 4. Rehydrate settings
    if (idbSettings) {
      useStore.setState({
        settings: { ...DEFAULT_SETTINGS, ...idbSettings },
      });
    }

    // 5. If a Flutter bridge is available, the on-disk file list is the
    //    source of truth. Load every file in parallel and replace the
    //    in-memory doc list with what we find. (In IDB-only mode we keep
    //    whatever we already had and skip this step.)
    if (isBridgeAvailable()) {
      try {
        const files = await loadFileList();
        if (files.length > 0) {
          const settled = await Promise.allSettled(files.map((f) => loadFile(f.path)));
          const now = Date.now();
          const freshDocs: Document[] = [];
          const freshByPath = new Map<string, Document>();

          // Pre-populate with the docs we already have so we don't lose
          // unsaved edits in the active tab.
          for (const d of useStore.getState().docs) {
            if (d.path) freshByPath.set(d.path, d);
          }

          settled.forEach((r, idx) => {
            const file = files[idx];
            if (r.status !== 'fulfilled') {
              console.warn(`[bootstrap] Failed to load file ${file.path}:`, r.reason);
              return;
            }
            const existing = freshByPath.get(file.path);
            const content = r.value.content;
            const now2 = Date.now();
            if (existing) {
              freshDocs.push({
                ...existing,
                title: stripMdExt(file.name) || existing.title,
              });
            } else {
              freshDocs.push({
                id: `path:${file.path}`,
                title: stripMdExt(file.name),
                content,
                path: file.path,
                createdAt: file.modified || now,
                updatedAt: file.modified || now2,
              });
            }
          });

          useStore.setState({ docs: freshDocs });

          // Try to preserve the previously active doc, if it still exists.
          const prevActive = useStore.getState().activeDocId;
          if (prevActive && !freshDocs.some((d) => d.id === prevActive)) {
            useStore.setState({ activeDocId: freshDocs[0]?.id ?? null });
          } else if (!prevActive && freshDocs.length > 0) {
            useStore.setState({ activeDocId: freshDocs[0].id });
          }
        } else {
          // No files on disk. If we have no in-memory docs either, fall
          // through to first-run welcome below.
        }
      } catch (e) {
        console.warn('[bootstrap] Bridge file load failed, keeping IDB state:', e);
      }
    }

    // 6. First-run: no docs anywhere → create welcome doc
    const finalDocs = useStore.getState().docs;
    if (finalDocs.length === 0) {
      const welcomeId = uuidv4();
      const now = Date.now();
      const welcomeDoc: Document = {
        id: welcomeId,
        title: 'Welcome to notes.md',
        content: WELCOME_CONTENT,
        createdAt: now,
        updatedAt: now,
      };
      useStore.setState({
        docs: [welcomeDoc],
        tabs: [{ docId: welcomeId, isDirty: false }],
        activeDocId: welcomeId,
      });
    }
  })();

  return bootstrapPromise;
}

const WELCOME_CONTENT = `# Welcome to notes.md

Your notes live as **.md files** you can open in any editor.

## Quick start

- Click **+** in the sidebar to create a new note
- Notes auto-save after **2 seconds** of inactivity
- Press **Ctrl/Cmd + K** to open the search palette
- Switch themes with the sun/moon icon

## Features

- [x] Markdown with live preview
- [x] KaTeX math: $E = mc^2$
- [x] Code highlighting
- [x] Mermaid diagrams

\`\`\`mermaid
graph LR
  A[Edit] --> B[Auto-save]
  B --> C[Disk]
  C --> D[Stays local]
\`\`\`

## File storage

When you run notes.md inside the Flutter app, your files are stored as
plain **.md files** in the app's documents directory — open them in VS
Code, Obsidian, or any text editor. When you run the web editor in a
standalone browser, notes fall back to **IndexedDB**.
`;
