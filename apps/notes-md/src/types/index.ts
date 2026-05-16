export interface Document {
  id: string;
  title: string;
  content: string;
  createdAt: number;
  updatedAt: number;
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
}

export type ViewMode = 'edit' | 'preview' | 'both';

export interface Tab {
  docId: string;
  isDirty: boolean;
}
