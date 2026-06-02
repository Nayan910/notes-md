export interface Document {
  id: string;
  title: string;
  content: string;
  createdAt: number;
  updatedAt: number;
  /**
   * Absolute path of the backing file on disk (e.g.
   * `~/Documents/notes-md/Welcome.md` on desktop, or
   * `/data/.../notes-md/Welcome.md` on Android).
   *
   * Populated when the doc was created/loaded via the Flutter bridge.
   * `undefined` for docs that were created in standalone browser mode
   * (no real on-disk file — they live only in IndexedDB).
   */
  path?: string;
}

export interface Settings {
  fontSize: number;
  fontFamily: string;
  theme: 'light' | 'dark' | 'system';
  showLineNumbers: boolean;
  wordWrap: boolean;
  autoSave: boolean;
  autoSaveDelay: number;
  sideBySide: boolean;
  showSidebar: boolean;
  layoutMode: LayoutMode;
}

export type ViewMode = 'edit' | 'preview' | 'both';

export type LayoutMode = 'vscode' | 'classic' | 'notes';

export interface Tab {
  docId: string;
  isDirty: boolean;
}
