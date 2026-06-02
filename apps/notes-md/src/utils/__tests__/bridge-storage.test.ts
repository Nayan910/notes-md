import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import 'fake-indexeddb/auto'
import {
  isBridgeAvailable,
  loadFileList,
  loadFile,
  saveFile,
  deleteFile,
  renameFile,
  createFile,
  onBridgeEvent,
  BridgeError,
  BridgeUnavailableError,
  type NoteFile,
} from '../bridge-storage'
import { __resetDBForTesting, getAllDocs, putDoc, saveAllDocs } from '../idb-storage'
import type { Document } from '../../types'

/* ------------------------------------------------------------------ *
 * Mocked bridge for tests
 * ------------------------------------------------------------------ */

type BridgeHandler = (msg: { type: string; payload?: Record<string, unknown> }) => Promise<unknown>

interface MockBridge {
  handler: BridgeHandler | null
  calls: Array<{ type: string; payload?: Record<string, unknown> }>
  /** Files that the mocked bridge will report on `list-notes`. */
  files: NoteFile[]
  /** File contents keyed by path. */
  contents: Map<string, string>
  /** If set, the next call will reject with this error message. */
  nextError: string | null
}

function makeMockBridge(): MockBridge {
  return {
    handler: null,
    calls: [],
    files: [],
    contents: new Map(),
    nextError: null,
  }
}

function installMockBridge(): MockBridge {
  const m = makeMockBridge()
  // Replace the global bridge with a function that dispatches to `m.handler`.
  ;(window as unknown as { flutter_postMessage?: (msg: string) => Promise<unknown> }).flutter_postMessage =
    (msg: string) => {
      const parsed = JSON.parse(msg) as { type: string; payload?: Record<string, unknown> }
      m.calls.push(parsed)
      if (m.nextError) {
        const err = m.nextError
        m.nextError = null
        return Promise.resolve({ success: false, error: err })
      }
      if (!m.handler) return Promise.resolve(null)
      return Promise.resolve(m.handler(parsed))
    }
  return m
}

function uninstallMockBridge(): void {
  delete (window as unknown as { flutter_postMessage?: unknown }).flutter_postMessage
}

/** Default mock handler that operates on `m.files` and `m.contents`. */
function installDefaultHandler(m: MockBridge): void {
  m.handler = async ({ type, payload }) => {
    switch (type) {
      case 'list-notes':
        return { success: true, data: m.files }
      case 'read-note': {
        const path = payload?.path as string
        if (!m.contents.has(path)) {
          return { success: false, error: `File not found: ${path}` }
        }
        return { success: true, data: { path, content: m.contents.get(path) } }
      }
      case 'write-note': {
        const path = payload?.path as string
        const content = payload?.content as string
        m.contents.set(path, content)
        // Update mock file list
        const name = path.split(/[\\/]/).pop()?.replace(/\.md$/i, '') ?? path
        const existing = m.files.findIndex((f) => f.path === path)
        const file: NoteFile = { path, name, size: content.length, modified: Date.now() }
        if (existing >= 0) m.files[existing] = file
        else m.files.push(file)
        return { success: true, data: { path } }
      }
      case 'delete-note': {
        const path = payload?.path as string
        m.contents.delete(path)
        m.files = m.files.filter((f) => f.path !== path)
        return { success: true, data: { path } }
      }
      case 'rename-note': {
        const oldPath = payload?.oldPath as string
        const newName = payload?.newName as string
        const dir = oldPath.match(/^(.*[\/\\])/)?.[1] ?? ''
        const newPath = `${dir}${newName}.md`
        if (m.contents.has(oldPath)) {
          m.contents.set(newPath, m.contents.get(oldPath)!)
          m.contents.delete(oldPath)
        }
        m.files = m.files.map((f) => f.path === oldPath ? { ...f, path: newPath, name: newName } : f)
        return { success: true, data: { newPath } }
      }
      case 'create-note': {
        const name = payload?.name as string
        const path = `/${name}.md`
        const content = `# ${name}\n\n`
        m.contents.set(path, content)
        m.files.push({ path, name, size: content.length, modified: Date.now() })
        return { success: true, data: { path } }
      }
      default:
        return { success: false, error: `Unknown command: ${type}` }
    }
  }
}

async function resetIdb() {
  localStorage.clear()
  __resetDBForTesting()
  await saveAllDocs([])
}

const sampleDoc = (overrides: Partial<Document> = {}): Document => ({
  id: 'doc-1',
  title: 'Test Doc',
  content: '# Hello\n\nThis is a test.',
  createdAt: 1000,
  updatedAt: 2000,
  ...overrides,
})

/* ------------------------------------------------------------------ *
 * Tests
 * ------------------------------------------------------------------ */

describe('bridge-storage', () => {
  beforeEach(async () => {
    await resetIdb()
  })

  afterEach(() => {
    uninstallMockBridge()
    vi.restoreAllMocks()
  })

  describe('isBridgeAvailable', () => {
    it('returns false when no bridge is installed', () => {
      uninstallMockBridge()
      expect(isBridgeAvailable()).toBe(false)
    })

    it('returns true when flutter_postMessage is a function', () => {
      installMockBridge()
      expect(isBridgeAvailable()).toBe(true)
    })
  })

  describe('loadFileList', () => {
    it('returns the file list from the bridge', async () => {
      const m = installMockBridge()
      installDefaultHandler(m)
      m.files = [
        { path: '/a.md', name: 'a', size: 10, modified: 1000 },
        { path: '/b.md', name: 'b', size: 20, modified: 2000 },
      ]
      const files = await loadFileList()
      expect(files).toHaveLength(2)
      expect(files[0].path).toBe('/a.md')
      expect(m.calls[0].type).toBe('list-notes')
    })

    it('falls back to IDB when bridge is not available', async () => {
      uninstallMockBridge()
      await putDoc(sampleDoc({ id: 'x', path: 'idb:x', title: 'IDB Only' }))
      const files = await loadFileList()
      expect(files).toHaveLength(1)
      expect(files[0].name).toBe('IDB Only')
    })

    it('surfaces bridge errors as BridgeError (no silent IDB fallback)', async () => {
      const m = installMockBridge()
      installDefaultHandler(m)
      m.nextError = 'simulated bridge failure'
      // Bridge is *present* but returns an error — caller should see the
      // error, not silently fall back to a stale IDB snapshot.
      await expect(loadFileList()).rejects.toBeInstanceOf(BridgeError)
    })
  })

  describe('loadFile', () => {
    it('returns content from the bridge', async () => {
      const m = installMockBridge()
      installDefaultHandler(m)
      m.files = [{ path: '/hello.md', name: 'hello', size: 11, modified: 1000 }]
      m.contents.set('/hello.md', 'hello world')
      const result = await loadFile('/hello.md')
      expect(result.path).toBe('/hello.md')
      expect(result.content).toBe('hello world')
      expect(m.calls[0].type).toBe('read-note')
      expect(m.calls[0].payload).toEqual({ path: '/hello.md' })
    })

    it('falls back to IDB when no bridge is available', async () => {
      uninstallMockBridge()
      await putDoc(sampleDoc({ id: 'idb-doc', path: 'idb:idb-doc', content: 'idb content' }))
      const result = await loadFile('idb:idb-doc')
      expect(result.content).toBe('idb content')
    })

    it('throws when file is not found and bridge returns an error', async () => {
      const m = installMockBridge()
      m.handler = async () => ({ success: false, error: 'File not found: /nope.md' })
      await expect(loadFile('/nope.md')).rejects.toBeInstanceOf(BridgeError)
    })
  })

  describe('saveFile', () => {
    it('writes content to the bridge', async () => {
      const m = installMockBridge()
      installDefaultHandler(m)
      await saveFile('/test.md', 'saved content')
      expect(m.contents.get('/test.md')).toBe('saved content')
      expect(m.calls[0].type).toBe('write-note')
      expect(m.calls[0].payload).toEqual({ path: '/test.md', content: 'saved content' })
    })

    it('persists to IDB when no bridge is available', async () => {
      uninstallMockBridge()
      await saveFile('idb:newfile', 'new content')
      const docs = await getAllDocs()
      expect(docs).toHaveLength(1)
      expect(docs[0].content).toBe('new content')
      expect(docs[0].path).toBe('idb:newfile')
    })

    it('updates an existing IDB doc by path', async () => {
      uninstallMockBridge()
      await putDoc(sampleDoc({ id: 'existing', path: 'idb:existing', content: 'old' }))
      await saveFile('idb:existing', 'new')
      const docs = await getAllDocs()
      expect(docs[0].content).toBe('new')
      expect(docs[0].updatedAt).toBeGreaterThan(sampleDoc().updatedAt)
    })
  })

  describe('deleteFile', () => {
    it('deletes the file from the bridge', async () => {
      const m = installMockBridge()
      installDefaultHandler(m)
      m.files = [{ path: '/doomed.md', name: 'doomed', size: 0, modified: 0 }]
      m.contents.set('/doomed.md', 'bye')
      await deleteFile('/doomed.md')
      expect(m.contents.has('/doomed.md')).toBe(false)
      expect(m.files).toHaveLength(0)
      expect(m.calls[0].type).toBe('delete-note')
    })

    it('removes the file from IDB when no bridge is available', async () => {
      uninstallMockBridge()
      await putDoc(sampleDoc({ id: 'del', path: 'idb:del' }))
      await deleteFile('idb:del')
      const docs = await getAllDocs()
      expect(docs).toHaveLength(0)
    })

    it('is a no-op when the IDB file does not exist', async () => {
      uninstallMockBridge()
      await expect(deleteFile('idb:does-not-exist')).resolves.toBeUndefined()
    })
  })

  describe('renameFile', () => {
    it('renames on the bridge and returns the new path', async () => {
      const m = installMockBridge()
      installDefaultHandler(m)
      m.files = [{ path: '/old.md', name: 'old', size: 0, modified: 0 }]
      m.contents.set('/old.md', 'content')
      const result = await renameFile('/old.md', 'renamed')
      expect(result.newPath).toBe('/renamed.md')
      expect(m.contents.has('/renamed.md')).toBe(true)
      expect(m.contents.has('/old.md')).toBe(false)
      expect(m.calls[0].type).toBe('rename-note')
      expect(m.calls[0].payload).toEqual({ oldPath: '/old.md', newName: 'renamed' })
    })

    it('preserves the directory portion of the path', async () => {
      const m = installMockBridge()
      installDefaultHandler(m)
      m.files = [{ path: '/dir/old.md', name: 'old', size: 0, modified: 0 }]
      m.contents.set('/dir/old.md', 'content')
      const result = await renameFile('/dir/old.md', 'new')
      expect(result.newPath).toBe('/dir/new.md')
    })

    it('renames in IDB when no bridge is available', async () => {
      uninstallMockBridge()
      await putDoc(sampleDoc({ id: 'r', path: 'idb:r', title: 'old' }))
      const result = await renameFile('idb:r', 'fresh')
      expect(result.newPath).toBe('idb:r')
      const docs = await getAllDocs()
      expect(docs[0].title).toBe('fresh')
    })
  })

  describe('createFile', () => {
    it('creates a file on the bridge and returns its path', async () => {
      const m = installMockBridge()
      installDefaultHandler(m)
      const result = await createFile('My Note')
      expect(result.path).toBe('/My Note.md')
      expect(m.contents.has('/My Note.md')).toBe(true)
      expect(m.calls[0].type).toBe('create-note')
      expect(m.calls[0].payload).toEqual({ name: 'My Note' })
    })

    it('creates a doc in IDB when no bridge is available', async () => {
      uninstallMockBridge()
      const result = await createFile('Browser Note')
      const docs = await getAllDocs()
      expect(docs).toHaveLength(1)
      expect(docs[0].title).toBe('Browser Note')
      expect(docs[0].path).toBe(result.path)
    })

    it('falls back to a safe filename for an empty name', async () => {
      uninstallMockBridge()
      const result = await createFile('   ')
      expect(result.path).toMatch(/Untitled/)
    })
  })

  describe('onBridgeEvent', () => {
    it('subscribes to postMessage events from Flutter', () => {
      const handler = vi.fn()
      const unsub = onBridgeEvent(handler)

      // Dispatch a message event that mimics what Flutter does.
      window.dispatchEvent(new MessageEvent('message', {
        data: JSON.stringify({ type: 'notes-list-updated', payload: { notes: [] } }),
        origin: window.location.origin,
      }))

      expect(handler).toHaveBeenCalledWith({
        type: 'notes-list-updated',
        payload: { notes: [] },
      })

      unsub()
    })

    it('ignores messages from untrusted origins', () => {
      const handler = vi.fn()
      const unsub = onBridgeEvent(handler)
      window.dispatchEvent(new MessageEvent('message', {
        data: JSON.stringify({ type: 'evil' }),
        origin: 'https://attacker.example',
      }))
      expect(handler).not.toHaveBeenCalled()
      unsub()
    })

    it('ignores non-JSON messages', () => {
      const handler = vi.fn()
      const unsub = onBridgeEvent(handler)
      window.dispatchEvent(new MessageEvent('message', {
        data: 'just a string, not JSON',
        origin: window.location.origin,
      }))
      expect(handler).not.toHaveBeenCalled()
      unsub()
    })

    it('returns an unsubscribe function', () => {
      const handler = vi.fn()
      const unsub = onBridgeEvent(handler)
      unsub()
      window.dispatchEvent(new MessageEvent('message', {
        data: JSON.stringify({ type: 'after-unsubscribe' }),
        origin: window.location.origin,
      }))
      expect(handler).not.toHaveBeenCalled()
    })
  })

  describe('error types', () => {
    it('BridgeUnavailableError has the expected name', () => {
      const e = new BridgeUnavailableError()
      expect(e.name).toBe('BridgeUnavailableError')
    })

    it('BridgeError captures the failed command type', () => {
      const e = new BridgeError('write-note', 'disk full')
      expect(e.name).toBe('BridgeError')
      expect(e.type).toBe('write-note')
      expect(e.message).toContain('disk full')
    })
  })
})
