/**
 * Bridge storage layer.
 *
 * Provides a unified async API for file operations that talks to Flutter via
 * `window.flutter_postMessage` when running inside the notes-md Flutter app,
 * and falls back to IndexedDB when running standalone in a browser.
 *
 * Protocol — matches Flutter `BridgeService.handleMessage`:
 *
 *   list-notes      → [{path, name, size, modified}, ...]
 *   read-note       → {content, path}
 *   write-note      → {path}            (writes {path, content})
 *   delete-note     → {path}            (deletes {path})
 *   rename-note     → {newPath}         (renames {oldPath} to {newName})
 *   create-note     → {path}            (creates file with {name})
 *
 * All bridge responses are wrapped in `{success, data?, error?}` and the
 * raw `data` payload is returned to the caller. On the JS side the
 * `flutter_inappwebview.callHandler('flutterBridge', message)` Promise is
 * awaited and its resolution is treated as the result.
 */

import { v4 as uuidv4 } from 'uuid';
import * as idb from './idb-storage';
import type { Document } from '../types';

/* ------------------------------------------------------------------ *
 * Public types
 * ------------------------------------------------------------------ */

export interface NoteFile {
  path: string;
  name: string;
  size: number;
  /** Milliseconds since epoch (matches Flutter `DateTime.millisecondsSinceEpoch`). */
  modified: number;
}

export interface ReadResult {
  path: string;
  content: string;
}

export interface CreateResult {
  path: string;
}

export interface RenameResult {
  newPath: string;
}

interface BridgeResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

declare global {
  interface Window {
    /**
     * Injected by Flutter's `_injectBridge` (see home_screen.dart). Returns
     * a Promise that resolves to `{success, data?, error?}` or `null` if
     * Flutter has no handler registered.
     */
    flutter_postMessage?: (message: string) => Promise<BridgeResponse<unknown> | null | undefined> | void;
  }
}

/* ------------------------------------------------------------------ *
 * Errors
 * ------------------------------------------------------------------ */

export class BridgeError extends Error {
  readonly type: string;
  constructor(type: string, message: string) {
    super(message);
    this.name = 'BridgeError';
    this.type = type;
  }
}

export class BridgeUnavailableError extends Error {
  constructor() {
    super('Flutter bridge not available (running standalone in a browser?)');
    this.name = 'BridgeUnavailableError';
  }
}

/* ------------------------------------------------------------------ *
 * Bridge detection + low-level call
 * ------------------------------------------------------------------ */

export function isBridgeAvailable(): boolean {
  return typeof window !== 'undefined' && typeof window.flutter_postMessage === 'function';
}

async function callBridge<T>(type: string, payload?: Record<string, unknown>): Promise<T> {
  if (!isBridgeAvailable() || !window.flutter_postMessage) {
    throw new BridgeUnavailableError();
  }
  const message = JSON.stringify({ type, payload });
  const result = await window.flutter_postMessage(message);
  if (!result) {
    throw new BridgeError(type, `No response from bridge for "${type}"`);
  }
  if (!result.success) {
    throw new BridgeError(type, result.error ?? `Bridge call "${type}" failed`);
  }
  return result.data as T;
}

/* ------------------------------------------------------------------ *
 * IDB fallbacks (standalone browser mode)
 * ------------------------------------------------------------------ */

/** Derive a synthetic path for an IDB-only document. The store treats
 *  the path as opaque, so the format doesn't need to be pretty. */
function idbPath(doc: Document): string {
  return doc.path ?? `idb:${doc.id}`;
}

function titleFromContent(content: string, fallback: string): string {
  const firstLine = content.split('\n')[0]?.replace(/^#\s*/, '').trim();
  return firstLine || fallback;
}

async function idbListFiles(): Promise<NoteFile[]> {
  const docs = await idb.getAllDocs();
  return docs.map((d) => ({
    path: idbPath(d),
    name: d.title,
    size: d.content.length,
    modified: d.updatedAt,
  }));
}

async function idbReadFile(path: string): Promise<ReadResult> {
  const docs = await idb.getAllDocs();
  const doc = docs.find((d) => idbPath(d) === path);
  if (!doc) throw new Error(`IDB fallback: file not found: ${path}`);
  return { path: idbPath(doc), content: doc.content };
}

async function idbWriteFile(path: string, content: string): Promise<void> {
  const docs = await idb.getAllDocs();
  const existing = docs.find((d) => idbPath(d) === path);
  if (existing) {
    await idb.putDoc({ ...existing, content, updatedAt: Date.now() });
    return;
  }
  // No matching doc — create a new one. The path is preserved so subsequent
  // writes/deletes find the same record.
  const newDoc: Document = {
    id: uuidv4(),
    title: titleFromContent(content, 'Untitled'),
    content,
    path,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  await idb.putDoc(newDoc);
}

async function idbDeleteFile(path: string): Promise<void> {
  const docs = await idb.getAllDocs();
  const doc = docs.find((d) => idbPath(d) === path);
  if (doc) await idb.deleteDoc(doc.id);
}

async function idbRenameFile(oldPath: string, newName: string): Promise<RenameResult> {
  const docs = await idb.getAllDocs();
  const doc = docs.find((d) => idbPath(d) === oldPath);
  if (!doc) throw new Error(`IDB fallback: file not found: ${oldPath}`);
  // In IDB mode there is no real on-disk file, so the synthetic path
  // doesn't need to change — subsequent lookups by path must still find
  // the same record. We update the display title only.
  await idb.putDoc({ ...doc, title: newName, updatedAt: Date.now() });
  return { newPath: idbPath(doc) };
}

async function idbCreateFile(name: string): Promise<CreateResult> {
  const id = uuidv4();
  const safeName = name.replace(/[\\/:*?"<>|]/g, '_').trim() || 'Untitled';
  const path = `idb:${id}:${safeName}.md`;
  const newDoc: Document = {
    id,
    title: safeName,
    content: `# ${safeName}\n\n`,
    path,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  await idb.putDoc(newDoc);
  return { path };
}

/* ------------------------------------------------------------------ *
 * Public API — uses bridge when available, IDB otherwise
 * ------------------------------------------------------------------ */

export async function loadFileList(): Promise<NoteFile[]> {
  if (!isBridgeAvailable()) return idbListFiles();
  // If the bridge is present, we trust it as the source of truth. A
  // bridge error here means the user is running with a broken bridge
  // (e.g. an old build of the app) — surface that to the console and
  // let the caller decide whether to fall back. Returning the IDB list
  // would silently mask the real problem.
  return callBridge<NoteFile[]>('list-notes');
}

export async function loadFile(path: string): Promise<ReadResult> {
  if (!isBridgeAvailable()) return idbReadFile(path);
  return callBridge<ReadResult>('read-note', { path });
}

export async function saveFile(path: string, content: string): Promise<void> {
  if (!isBridgeAvailable()) return idbWriteFile(path, content);
  await callBridge('write-note', { path, content });
}

export async function deleteFile(path: string): Promise<void> {
  if (!isBridgeAvailable()) return idbDeleteFile(path);
  await callBridge('delete-note', { path });
}

export async function renameFile(oldPath: string, newName: string): Promise<RenameResult> {
  if (!isBridgeAvailable()) return idbRenameFile(oldPath, newName);
  return callBridge<RenameResult>('rename-note', { oldPath, newName });
}

export async function createFile(name: string): Promise<CreateResult> {
  if (!isBridgeAvailable()) return idbCreateFile(name);
  return callBridge<CreateResult>('create-note', { name });
}

/* ------------------------------------------------------------------ *
 * Incoming event subscription
 *
 * Flutter pushes events to the WebView via `window.dispatchEvent(new
 * MessageEvent('message', { data: {...}, origin }))` (see
 * BridgeService._send). We expose a small typed helper so call sites
 * don't have to re-parse the payload.
 * ------------------------------------------------------------------ */

export type BridgeEventType =
  | 'notes-list-updated'
  | 'open-file'
  | 'save-file'
  | 'file-changed-externally'
  | 'file-closed'
  | 'set-theme'
  | 'set-font-size'
  | string; // forward-compatible

export interface BridgeEvent<T = unknown> {
  type: BridgeEventType;
  payload?: T;
}

export type BridgeEventHandler<T = unknown> = (event: BridgeEvent<T>) => void;

const TRUSTED_ORIGINS = [
  // Match whatever `window.location.origin` resolves to in the host page.
  // We initialise lazily in `onBridgeEvent` to avoid SSR issues.
  'file://',
  'null',
];

/**
 * Subscribe to events pushed from Flutter to the WebView.
 * Returns an unsubscribe function.
 */
export function onBridgeEvent(handler: BridgeEventHandler): () => void {
  const listener = (event: MessageEvent) => {
    // Trust same-origin (live web), file:// (Flutter WebView on
    // Android/Windows), and `null` origin (sandboxed WebView).
    const origin = event.origin;
    if (origin !== window.location.origin && !TRUSTED_ORIGINS.includes(origin) && !origin.startsWith('app://')) {
      return;
    }
    let data: { type?: string; payload?: unknown } | null = null;
    try {
      data = typeof event.data === 'string' ? JSON.parse(event.data) : (event.data as { type?: string; payload?: unknown });
    } catch {
      return; // ignore non-JSON messages
    }
    if (!data || typeof data.type !== 'string') return;
    handler({ type: data.type, payload: data.payload });
  };
  window.addEventListener('message', listener);
  return () => window.removeEventListener('message', listener);
}
