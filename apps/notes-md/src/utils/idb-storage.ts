/**
 * IndexedDB storage layer for notes.md.
 *
 * Why IDB instead of localStorage?
 * - localStorage is capped at 5-10MB per origin (synchronous, blocking)
 * - IndexedDB is GB-scale, async, and supports binary data
 * - Large markdown notes (>1MB) would throw QuotaExceededError on localStorage
 *
 * Strategy:
 * - Primary store: IndexedDB (via idb wrapper)
 * - Fallback: localStorage (kept for backwards compat)
 * - One-time migration: on first load, copy localStorage → IDB, then clear
 */

import { openDB, type IDBPDatabase, type DBSchema } from 'idb';
import type { Document, Settings } from '../types';

interface NotesDB extends DBSchema {
  docs: {
    key: string; // doc.id
    value: Document;
  };
  meta: {
    key: string; // meta key (e.g. 'settings', 'tabs', 'active')
    value: unknown;
  };
}

const DB_NAME = 'notes-md';
const DB_VERSION = 1;
const META_KEYS = {
  SETTINGS: 'settings',
  TABS: 'tabs',
  ACTIVE: 'active',
} as const;

let dbPromise: Promise<IDBPDatabase<NotesDB>> | null = null;

/**
 * Test-only: reset the cached DB connection. Used by tests to ensure
 * a fresh connection after deleting the database.
 */
export function __resetDBForTesting(): void {
  dbPromise = null;
}

function getDB(): Promise<IDBPDatabase<NotesDB>> {
  if (typeof indexedDB === 'undefined') {
    // SSR or non-browser environment — return rejected promise
    return Promise.reject(new Error('IndexedDB not available'));
  }

  if (!dbPromise) {
    dbPromise = openDB<NotesDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('docs')) {
          db.createObjectStore('docs', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('meta')) {
          db.createObjectStore('meta');
        }
      },
    });
  }
  return dbPromise;
}

/* ------------------------------------------------------------------ *
 * Docs
 * ------------------------------------------------------------------ */

export async function getAllDocs(): Promise<Document[]> {
  try {
    const db = await getDB();
    return await db.getAll('docs');
  } catch (e) {
    console.warn('[idb] getAllDocs failed:', e);
    return [];
  }
}

export async function saveAllDocs(docs: Document[]): Promise<void> {
  try {
    const db = await getDB();
    const tx = db.transaction('docs', 'readwrite');
    await tx.objectStore('docs').clear();
    // Bulk put is more efficient than clear+put loop
    await Promise.all(docs.map((d) => tx.objectStore('docs').put(d)));
    await tx.done;
  } catch (e) {
    console.error('[idb] saveAllDocs failed:', e);
    throw e;
  }
}

export async function putDoc(doc: Document): Promise<void> {
  try {
    const db = await getDB();
    await db.put('docs', doc);
  } catch (e) {
    console.error('[idb] putDoc failed:', e);
    throw e;
  }
}

export async function deleteDoc(id: string): Promise<void> {
  try {
    const db = await getDB();
    await db.delete('docs', id);
  } catch (e) {
    console.error('[idb] deleteDoc failed:', e);
    throw e;
  }
}

/* ------------------------------------------------------------------ *
 * Meta (settings, tabs, active doc)
 * ------------------------------------------------------------------ */

async function getMeta<T>(key: string): Promise<T | null> {
  try {
    const db = await getDB();
    const value = await db.get('meta', key);
    return (value as T) ?? null;
  } catch (e) {
    console.warn(`[idb] getMeta(${key}) failed:`, e);
    return null;
  }
}

async function setMeta(key: string, value: unknown): Promise<void> {
  try {
    const db = await getDB();
    if (value === null || value === undefined) {
      await db.delete('meta', key);
    } else {
      await db.put('meta', value, key);
    }
  } catch (e) {
    console.error(`[idb] setMeta(${key}) failed:`, e);
    throw e;
  }
}

export const getSettings = (): Promise<Settings | null> => getMeta<Settings>(META_KEYS.SETTINGS);
export const setSettings = (s: Settings | null): Promise<void> => setMeta(META_KEYS.SETTINGS, s);

export const getTabs = (): Promise<string[] | null> => getMeta<string[]>(META_KEYS.TABS);
export const setTabs = (tabs: string[] | null): Promise<void> => setMeta(META_KEYS.TABS, tabs);

export const getActive = (): Promise<string | null> => getMeta<string>(META_KEYS.ACTIVE);
export const setActive = (id: string | null): Promise<void> => setMeta(META_KEYS.ACTIVE, id);

/* ------------------------------------------------------------------ *
 * Migration from localStorage (one-time, on first launch)
 * ------------------------------------------------------------------ */

const MIGRATION_FLAG = 'notes-md-idb-migrated';

interface LocalStorageData {
  docs: Document[];
  settings: Settings | null;
  tabs: string[];
  active: string | null;
}

function readLocalStorageData(): LocalStorageData {
  const safeParse = <T>(key: string): T | null => {
    try {
      const raw = localStorage.getItem(key);
      return raw ? (JSON.parse(raw) as T) : null;
    } catch {
      return null;
    }
  };

  return {
    docs: safeParse<Document[]>('notes-md-docs') ?? [],
    settings: safeParse<Settings>('notes-md-settings'),
    tabs: safeParse<string[]>('notes-md-tabs') ?? [],
    active: localStorage.getItem('notes-md-active'),
  };
}

/**
 * Migrate all data from localStorage to IndexedDB.
 * Safe to call multiple times — the migration flag prevents re-runs.
 *
 * @returns true if migration ran, false if already migrated or no data found
 */
export async function migrateFromLocalStorage(): Promise<boolean> {
  // Idempotency: never migrate twice
  if (localStorage.getItem(MIGRATION_FLAG) === 'true') {
    return false;
  }

  // IDB may not be available (SSR, test env) — skip silently
  if (typeof indexedDB === 'undefined') {
    return false;
  }

  const data = readLocalStorageData();
  const hasAnyData =
    data.docs.length > 0 || data.settings !== null || data.tabs.length > 0 || data.active !== null;

  if (!hasAnyData) {
    // Nothing to migrate, but mark as done so we don't re-check
    localStorage.setItem(MIGRATION_FLAG, 'true');
    return false;
  }

  try {
    const db = await getDB();

    // Migrate docs
    if (data.docs.length > 0) {
      const tx = db.transaction('docs', 'readwrite');
      await Promise.all(data.docs.map((d) => tx.objectStore('docs').put(d)));
      await tx.done;
    }

    // Migrate meta
    const writes: Promise<unknown>[] = [];
    if (data.settings) writes.push(setSettings(data.settings));
    if (data.tabs.length > 0) writes.push(setTabs(data.tabs));
    if (data.active) writes.push(setActive(data.active));
    await Promise.all(writes);

    // Clear localStorage to free up the 5-10MB cap for other use
    localStorage.removeItem('notes-md-docs');
    localStorage.removeItem('notes-md-settings');
    localStorage.removeItem('notes-md-tabs');
    localStorage.removeItem('notes-md-active');

    // Mark migration complete
    localStorage.setItem(MIGRATION_FLAG, 'true');

    console.log(`[idb] Migrated ${data.docs.length} docs from localStorage to IndexedDB`);
    return true;
  } catch (e) {
    console.error('[idb] Migration failed:', e);
    return false;
  }
}

/* ------------------------------------------------------------------ *
 * Health check / diagnostics
 * ------------------------------------------------------------------ */

export async function getStorageInfo(): Promise<{ source: 'idb' | 'localStorage' | 'empty'; docCount: number }> {
  try {
    const docs = await getAllDocs();
    if (docs.length > 0) {
      return { source: 'idb', docCount: docs.length };
    }
  } catch {
    // fall through
  }

  try {
    const lsDocs = localStorage.getItem('notes-md-docs');
    if (lsDocs) {
      const parsed = JSON.parse(lsDocs) as Document[];
      return { source: 'localStorage', docCount: parsed.length };
    }
  } catch {
    // fall through
  }

  return { source: 'empty', docCount: 0 };
}
