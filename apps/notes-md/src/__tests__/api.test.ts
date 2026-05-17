import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { apiGet, apiPost, uploadFile, exportDocument } from '../utils/api'

let mockFetch: ReturnType<typeof vi.fn>

beforeEach(() => {
  mockFetch = vi.fn()
  vi.spyOn(globalThis as any, 'fetch').mockImplementation(mockFetch)
})

afterEach(() => {
  vi.restoreAllMocks()
})

// The API base is computed from window.location.
// In jsdom the default is http://localhost:3000, so:
//   API_BASE = http://localhost:8000
const BASE = 'http://localhost:8000'

// ---------------------------------------------------------------------------
// apiGet
// ---------------------------------------------------------------------------
describe('apiGet', () => {
  it('returns the parsed JSON on a successful response', async () => {
    const data = { id: 1, title: 'Test' }
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(data),
    })

    const result = await apiGet('/docs')
    expect(result).toEqual(data)
    expect(mockFetch).toHaveBeenCalledWith(`${BASE}/docs`)
  })

  it('throws on a non-ok response', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      statusText: 'Not Found',
    })

    await expect(apiGet('/docs/999')).rejects.toThrow('API error: Not Found')
  })

  it('throws when the network fails', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network failure'))

    await expect(apiGet('/docs')).rejects.toThrow('Network failure')
  })
})

// ---------------------------------------------------------------------------
// apiPost
// ---------------------------------------------------------------------------
describe('apiPost', () => {
  it('sends a POST request with JSON body and returns the response', async () => {
    const responseData = { success: true, id: 42 }
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(responseData),
    })

    const result = await apiPost('/docs', { title: 'New Doc', content: 'Hello' })
    expect(result).toEqual(responseData)

    expect(mockFetch).toHaveBeenCalledWith(`${BASE}/docs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'New Doc', content: 'Hello' }),
    })
  })

  it('merges custom headers with the default Content-Type', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({}),
    })

    await apiPost('/docs', {}, { Authorization: 'Bearer token123' })

    expect(mockFetch).toHaveBeenCalledWith(`${BASE}/docs`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer token123',
      },
      body: JSON.stringify({}),
    })
  })

  it('throws on a non-ok response', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      statusText: 'Bad Request',
    })

    await expect(apiPost('/docs', {})).rejects.toThrow('API error: Bad Request')
  })
})

// ---------------------------------------------------------------------------
// uploadFile
// ---------------------------------------------------------------------------
describe('uploadFile', () => {
  it('sends a POST request with FormData and returns the JSON response', async () => {
    const responseData = { filename: 'uploaded.md' }
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(responseData),
    })

    const file = new File(['content'], 'test.md', { type: 'text/markdown' })
    const result = await uploadFile('/upload', file)
    expect(result).toEqual(responseData)

    const callUrl = mockFetch.mock.calls[0][0]
    const callInit = mockFetch.mock.calls[0][1]

    expect(callUrl).toBe(`${BASE}/upload`)
    expect(callInit.method).toBe('POST')
    expect(callInit.body).toBeInstanceOf(FormData)
    // Verify the FormData contains our file
    const formData = callInit.body as FormData
    expect(formData.has('file')).toBe(true)
    expect(formData.get('file')).toBe(file)
  })

  it('throws on a non-ok response', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      statusText: 'Forbidden',
    })

    const file = new File(['x'], 'x.md', { type: 'text/plain' })
    await expect(uploadFile('/upload', file)).rejects.toThrow('Upload failed: Forbidden')
  })
})

// ---------------------------------------------------------------------------
// exportDocument
// ---------------------------------------------------------------------------
describe('exportDocument', () => {
  it('sends a POST to /convert/export and returns the blob', async () => {
    const mockBlob = new Blob(['<html></html>'], { type: 'text/html' })
    mockFetch.mockResolvedValueOnce({
      ok: true,
      blob: () => Promise.resolve(mockBlob),
    })

    const result = await exportDocument('# Hello', 'html', 'my-doc')
    expect(result).toBe(mockBlob)

    expect(mockFetch).toHaveBeenCalledWith(`${BASE}/convert/export`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        markdown: '# Hello',
        target_format: 'html',
        filename: 'my-doc',
      }),
    })
  })

  it('throws on a non-ok response', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      statusText: 'Unsupported Format',
    })

    await expect(exportDocument('# Hello', 'xyz', 'doc')).rejects.toThrow(
      'Export failed: Unsupported Format',
    )
  })
})
