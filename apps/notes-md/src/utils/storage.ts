import type { Document, Settings } from '../types';

const DOCS_KEY = 'notes-md-docs';
const SETTINGS_KEY = 'notes-md-settings';
const TABS_KEY = 'notes-md-tabs';
const ACTIVE_KEY = 'notes-md-active';

export function loadDocs(): Document[] {
  try {
    const raw = localStorage.getItem(DOCS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveDocs(docs: Document[]): void {
  try {
    localStorage.setItem(DOCS_KEY, JSON.stringify(docs));
  } catch (e) {
    console.error('Failed to save docs:', e);
  }
}

export function loadSettings(): Settings | null {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function saveSettings(settings: Settings): void {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch (e) {
    console.error('Failed to save settings:', e);
  }
}

export function loadTabs(): string[] {
  try {
    const raw = localStorage.getItem(TABS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveTabs(tabs: string[]): void {
  try {
    localStorage.setItem(TABS_KEY, JSON.stringify(tabs));
  } catch (e) {
    console.error('Failed to save tabs:', e);
  }
}

export function loadActiveDoc(): string | null {
  return localStorage.getItem(ACTIVE_KEY);
}

export function saveActiveDoc(id: string | null): void {
  if (id) {
    localStorage.setItem(ACTIVE_KEY, id);
  } else {
    localStorage.removeItem(ACTIVE_KEY);
  }
}
