import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import 'fake-indexeddb/auto';
import {
  getAllDocs,
  saveAllDocs,
  putDoc,
  deleteDoc,
  getSettings,
  setSettings,
  getTabs,
  setTabs,
  getActive,
  setActive,
  migrateFromLocalStorage,
  getStorageInfo,
  __resetDBForTesting,
} from '../idb-storage';
import type { Document, Settings } from '../../types';

/**
 * Reset IDB between tests. We use a unique DB name per test by
 * reassigning the module's cached dbPromise. This avoids the
 * deleteDatabase() blocking issue with fake-indexeddb.
 */
async function resetIdb() {
  // Clear localStorage
  localStorage.clear();
  // Reset module DB cache
  __resetDBForTesting();
  // After reset, any subsequent getDB() call will create a new connection
  // to a fresh (or existing) DB. Clear all stores to start with a clean slate.
  await saveAllDocs([]);
  await setSettings(null);
  await setTabs(null);
  await setActive(null);
}

const sampleDoc: Document = {
  id: 'doc-1',
  title: 'Test Doc',
  content: '# Hello\n\nThis is a test.',
  createdAt: 1000,
  updatedAt: 2000,
};

const sampleSettings: Settings = {
  fontSize: 14,
  fontFamily: 'monospace',
  theme: 'dark',
  showLineNumbers: true,
  wordWrap: true,
  autoSave: true,
  autoSaveDelay: 2000,
  sideBySide: true,
  showSidebar: true,
  layoutMode: 'classic',
};

describe('idb-storage', () => {
  beforeEach(async () => {
    // Clear all data before each test
    await resetIdb();
  }, 5000);

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('docs', () => {
    it('returns empty array when no docs exist', async () => {
      const docs = await getAllDocs();
      expect(docs).toEqual([]);
    });

    it('saves and retrieves docs', async () => {
      await saveAllDocs([sampleDoc]);
      const docs = await getAllDocs();
      expect(docs).toHaveLength(1);
      expect(docs[0]).toEqual(sampleDoc);
    });

    it('overwrites docs on subsequent save', async () => {
      await saveAllDocs([sampleDoc]);
      const doc2 = { ...sampleDoc, id: 'doc-2', title: 'Second' };
      await saveAllDocs([doc2]);
      const docs = await getAllDocs();
      expect(docs).toHaveLength(1);
      expect(docs[0].id).toBe('doc-2');
    });

    it('puts a single doc without clearing others', async () => {
      await saveAllDocs([sampleDoc]);
      const doc2 = { ...sampleDoc, id: 'doc-2' };
      await putDoc(doc2);
      const docs = await getAllDocs();
      expect(docs).toHaveLength(2);
    });

    it('deletes a doc by id', async () => {
      await saveAllDocs([sampleDoc, { ...sampleDoc, id: 'doc-2' }]);
      await deleteDoc('doc-1');
      const docs = await getAllDocs();
      expect(docs).toHaveLength(1);
      expect(docs[0].id).toBe('doc-2');
    });

    it('handles large docs (1MB+) without quota error', async () => {
      const bigContent = 'x'.repeat(2 * 1024 * 1024); // 2MB
      const bigDoc: Document = { ...sampleDoc, content: bigContent };
      await saveAllDocs([bigDoc]);
      const docs = await getAllDocs();
      expect(docs[0].content.length).toBe(2 * 1024 * 1024);
    });
  });

  describe('settings', () => {
    it('returns null when no settings exist', async () => {
      const settings = await getSettings();
      expect(settings).toBeNull();
    });

    it('saves and retrieves settings', async () => {
      await setSettings(sampleSettings);
      const settings = await getSettings();
      expect(settings).toEqual(sampleSettings);
    });
  });

  describe('tabs', () => {
    it('returns null when no tabs exist', async () => {
      const tabs = await getTabs();
      expect(tabs).toBeNull();
    });

    it('saves and retrieves tabs', async () => {
      await setTabs(['doc-1', 'doc-2']);
      const tabs = await getTabs();
      expect(tabs).toEqual(['doc-1', 'doc-2']);
    });
  });

  describe('active', () => {
    it('returns null when no active doc is set', async () => {
      const active = await getActive();
      expect(active).toBeNull();
    });

    it('saves and retrieves active doc', async () => {
      await setActive('doc-1');
      const active = await getActive();
      expect(active).toBe('doc-1');
    });
  });

  describe('migration', () => {
    it('migrates docs from localStorage to IDB', async () => {
      localStorage.setItem('notes-md-docs', JSON.stringify([sampleDoc]));
      localStorage.setItem('notes-md-settings', JSON.stringify(sampleSettings));
      localStorage.setItem('notes-md-tabs', JSON.stringify(['doc-1']));
      localStorage.setItem('notes-md-active', 'doc-1');

      const migrated = await migrateFromLocalStorage();
      expect(migrated).toBe(true);

      // Data should be in IDB
      const docs = await getAllDocs();
      expect(docs).toEqual([sampleDoc]);

      const settings = await getSettings();
      expect(settings).toEqual(sampleSettings);

      // localStorage should be cleared (except migration flag)
      expect(localStorage.getItem('notes-md-docs')).toBeNull();
      expect(localStorage.getItem('notes-md-settings')).toBeNull();
      expect(localStorage.getItem('notes-md-tabs')).toBeNull();
      expect(localStorage.getItem('notes-md-active')).toBeNull();
      expect(localStorage.getItem('notes-md-idb-migrated')).toBe('true');
    });

    it('is idempotent (does not re-migrate)', async () => {
      localStorage.setItem('notes-md-docs', JSON.stringify([sampleDoc]));

      const first = await migrateFromLocalStorage();
      expect(first).toBe(true);

      // Add new data to localStorage manually (simulating bug)
      const doc2 = { ...sampleDoc, id: 'doc-2' };
      localStorage.setItem('notes-md-docs', JSON.stringify([doc2]));

      const second = await migrateFromLocalStorage();
      expect(second).toBe(false); // Already migrated

      // IDB should still have only the first doc
      const docs = await getAllDocs();
      expect(docs).toHaveLength(1);
      expect(docs[0].id).toBe('doc-1');
    });

    it('marks migration done even with no data', async () => {
      const migrated = await migrateFromLocalStorage();
      expect(migrated).toBe(false);
      expect(localStorage.getItem('notes-md-idb-migrated')).toBe('true');
    });

    it('handles corrupted localStorage gracefully', async () => {
      localStorage.setItem('notes-md-docs', '{not valid json');
      const migrated = await migrateFromLocalStorage();
      expect(migrated).toBe(false);
      expect(localStorage.getItem('notes-md-idb-migrated')).toBe('true');
    });
  });

  describe('getStorageInfo', () => {
    it('reports idb source when IDB has docs', async () => {
      await saveAllDocs([sampleDoc]);
      const info = await getStorageInfo();
      expect(info.source).toBe('idb');
      expect(info.docCount).toBe(1);
    });

    it('reports empty when nothing exists', async () => {
      // Ensure IDB is empty
      await saveAllDocs([]);
      // Ensure localStorage is empty
      localStorage.clear();
      const info = await getStorageInfo();
      expect(info.source).toBe('empty');
      expect(info.docCount).toBe(0);
    });
  });
});
