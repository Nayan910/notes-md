/**
 * Unified storage layer.
 *
 * Backed by IndexedDB (via idb-storage.ts) for large capacity.
 * localStorage is used as a one-time migration source — once data is
 * copied to IDB, the localStorage keys are cleared.
 *
 * The functions here are sync wrappers around async IDB calls for
 * backwards compatibility with existing call sites. Writes are
 * fire-and-forget; reads prefer cached IDB data when available.
 */

import type { Document, Settings } from '../types';
import {
  getAllDocs,
  saveAllDocs,
  getSettings as idbGetSettings,
  setSettings as idbSetSettings,
  getTabs as idbGetTabs,
  setTabs as idbSetTabs,
  getActive as idbGetActive,
  setActive as idbSetActive,
  migrateFromLocalStorage,
} from './idb-storage';

// Trigger migration on module load (fire-and-forget).
// This is safe to call multiple times — it self-guards via a flag.
migrateFromLocalStorage().catch((e) => {
  console.warn('[storage] Migration failed:', e);
});

/* ------------------------------------------------------------------ *
 * Docs
 * ------------------------------------------------------------------ */

/**
 * Synchronously load docs.
 *
 * On first call after migration, IDB may not be ready yet, so we
 * fall back to localStorage. After that, IDB is the source of truth.
 *
 * Note: This is a sync API for backwards compat. For new code, prefer
 * the async functions in idb-storage.ts.
 */
export function loadDocs(): Document[] {
  // Try localStorage first (fastest, sync). After migration, this will be empty
  // and we'll trigger an async reload from IDB.
  try {
    const raw = localStorage.getItem('notes-md-docs');
    if (raw) {
      return JSON.parse(raw) as Document[];
    }
  } catch {
    // fall through
  }

  // Async load from IDB — fire and forget, store will be rehydrated
  // by the bootstrap sequence in main.tsx
  getAllDocs().then((docs) => {
    if (docs.length > 0) {
      window.dispatchEvent(new CustomEvent('idb-docs-loaded', { detail: docs }));
    }
  });

  return [];
}

export function saveDocs(docs: Document[]): void {
  // Async write to IDB (primary)
  saveAllDocs(docs).catch((e) => {
    console.error('[storage] saveDocs failed:', e);
  });

  // Keep localStorage as a last-resort fallback for SSR or IDB-unavailable cases
  try {
    localStorage.setItem('notes-md-docs', JSON.stringify(docs));
  } catch (e) {
    // QuotaExceededError is expected for large docs — IDB is the real store
    if (e instanceof DOMException && e.name === 'QuotaExceededError') {
      console.warn('[storage] localStorage quota exceeded, using IDB only');
    } else {
      throw e;
    }
  }
}

/* ------------------------------------------------------------------ *
 * Settings
 * ------------------------------------------------------------------ */

export function loadSettings(): Settings | null {
  try {
    const raw = localStorage.getItem('notes-md-settings');
    if (raw) return JSON.parse(raw) as Settings;
  } catch {
    // fall through
  }

  idbGetSettings().then((s) => {
    if (s) {
      window.dispatchEvent(new CustomEvent('idb-settings-loaded', { detail: s }));
    }
  });

  return null;
}

export function saveSettings(settings: Settings): void {
  idbSetSettings(settings).catch((e) => {
    console.error('[storage] saveSettings failed:', e);
  });

  try {
    localStorage.setItem('notes-md-settings', JSON.stringify(settings));
  } catch (e) {
    if (!(e instanceof DOMException && e.name === 'QuotaExceededError')) {
      throw e;
    }
  }
}

/* ------------------------------------------------------------------ *
 * Tabs
 * ------------------------------------------------------------------ */

export function loadTabs(): string[] {
  try {
    const raw = localStorage.getItem('notes-md-tabs');
    if (raw) return JSON.parse(raw) as string[];
  } catch {
    // fall through
  }

  idbGetTabs().then((t) => {
    if (t) {
      window.dispatchEvent(new CustomEvent('idb-tabs-loaded', { detail: t }));
    }
  });

  return [];
}

export function saveTabs(tabs: string[]): void {
  idbSetTabs(tabs).catch((e) => {
    console.error('[storage] saveTabs failed:', e);
  });

  try {
    localStorage.setItem('notes-md-tabs', JSON.stringify(tabs));
  } catch (e) {
    if (!(e instanceof DOMException && e.name === 'QuotaExceededError')) {
      throw e;
    }
  }
}

/* ------------------------------------------------------------------ *
 * Active doc
 * ------------------------------------------------------------------ */

export function loadActiveDoc(): string | null {
  return localStorage.getItem('notes-md-active');
}

export function saveActiveDoc(id: string | null): void {
  if (id) {
    localStorage.setItem('notes-md-active', id);
    idbSetActive(id).catch((e) => console.error('[storage] saveActiveDoc failed:', e));
  } else {
    localStorage.removeItem('notes-md-active');
    idbSetActive(null).catch((e) => console.error('[storage] saveActiveDoc failed:', e));
  }
}
