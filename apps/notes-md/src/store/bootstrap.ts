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
 * 4. UI re-renders with the correct data
 */

import { useStore } from './useStore';
import { getAllDocs, getSettings, getTabs, getActive, migrateFromLocalStorage } from '../utils/idb-storage';
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

let bootstrapPromise: Promise<void> | null = null;

export function bootstrapStore(): Promise<void> {
  if (bootstrapPromise) return bootstrapPromise;

  bootstrapPromise = (async () => {
    // First, ensure localStorage → IDB migration has run
    await migrateFromLocalStorage();

    // Load all data from IDB
    const [idbDocs, idbSettings, idbTabs, idbActive] = await Promise.all([
      getAllDocs(),
      getSettings(),
      getTabs(),
      getActive(),
    ]);

    const validDocs = idbDocs.filter(validateDoc);
    const currentState = useStore.getState();

    // Only update if IDB has data AND it's different from current state
    // (avoids overwriting recent local edits that haven't been persisted)
    if (validDocs.length > 0) {
      const currentDocIds = new Set(currentState.docs.map((d) => d.id));
      const idbDocIds = new Set(validDocs.map((d) => d.id));
      const isDifferent =
        currentDocIds.size !== idbDocIds.size ||
        ![...currentDocIds].every((id) => idbDocIds.has(id));

      if (isDifferent) {
        useStore.setState({ docs: validDocs });

        // Rehydrate tabs from IDB if available
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

    // Rehydrate settings
    if (idbSettings) {
      useStore.setState({
        settings: { ...DEFAULT_SETTINGS, ...idbSettings },
      });
    }

    // First-run: no docs in IDB, no docs in localStorage → create welcome doc
    if (validDocs.length === 0 && currentState.docs.length === 0) {
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

Your notes are stored **locally** in this browser. They never leave your device.

## Quick start

- Click **+** in the sidebar to create a new note
- Notes auto-save after **2 seconds** of inactivity
- Press **Ctrl/Cmd + K** to open search (coming soon)
- Switch themes with the sun/moon icon

## Features

- [x] Markdown with live preview
- [x] KaTeX math: $E = mc^2$
- [x] Code highlighting
- [x] Mermaid diagrams

\`\`\`mermaid
graph LR
  A[Edit] --> B[Auto-save]
  B --> C[IndexedDB]
  C --> D[Stays local]
\`\`\`

## File storage

Your notes live in **IndexedDB** (browser storage, GB-scale).
The previous version used localStorage (5-10MB cap) which broke on large notes.
This version has no such limit.

> You can open these notes in any text editor by exporting them.
> Future versions will save directly to \`.md\` files on your filesystem.
`;
