import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { downloadAsFile, generateHtmlDocument, copyToClipboard } from '../utils/export'

// ---------------------------------------------------------------------------
// downloadAsFile
// ---------------------------------------------------------------------------
describe('downloadAsFile', () => {
  let urlSpy: ReturnType<typeof vi.spyOn>
  let revokeSpy: ReturnType<typeof vi.spyOn>
  let createElementSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    urlSpy = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock-url')
    revokeSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
  })

  afterEach(() => {
    urlSpy.mockRestore()
    revokeSpy.mockRestore()
    createElementSpy?.mockRestore()
  })

  it('creates a Blob with the correct content and MIME type', () => {
    downloadAsFile('# Hello', 'test.md', 'text/markdown')

    expect(urlSpy).toHaveBeenCalledWith(expect.any(Blob))
    const blob = urlSpy.mock.calls[0][0] as Blob
    expect(blob.type).toBe('text/markdown')
  })

  it('sets the anchor href and download attributes and triggers click', () => {
    const anchor = document.createElement('a')
    const clickSpy = vi.spyOn(anchor, 'click')
    createElementSpy = vi.spyOn(document, 'createElement').mockImplementation((tag) => {
      if (tag === 'a') return anchor
      return document.createElement(tag)
    })

    downloadAsFile('content', 'output.md')

    expect(anchor.href).toBe('blob:mock-url')
    expect(anchor.download).toBe('output.md')
    expect(clickSpy).toHaveBeenCalledTimes(1)
  })

  it('appends and removes the anchor from the document body', () => {
    const anchor = document.createElement('a')
    const appendSpy = vi.spyOn(document.body, 'appendChild').mockImplementation(() => anchor as any)
    const removeSpy = vi.spyOn(document.body, 'removeChild').mockImplementation(() => anchor as any)
    createElementSpy = vi.spyOn(document, 'createElement').mockImplementation((tag) => {
      if (tag === 'a') return anchor
      return document.createElement(tag)
    })

    downloadAsFile('content', 'output.md')

    expect(appendSpy).toHaveBeenCalledWith(anchor)
    expect(removeSpy).toHaveBeenCalledWith(anchor)
  })

  it('revokes the object URL after the download', () => {
    downloadAsFile('content', 'output.md')
    expect(revokeSpy).toHaveBeenCalledWith('blob:mock-url')
  })

  it('defaults to text/markdown MIME type', () => {
    downloadAsFile('content', 'doc.md')
    const blob = urlSpy.mock.calls[0][0] as Blob
    expect(blob.type).toBe('text/markdown')
  })

  it('accepts an explicit MIME type', () => {
    downloadAsFile('<html></html>', 'doc.html', 'text/html')
    const blob = urlSpy.mock.calls[0][0] as Blob
    expect(blob.type).toBe('text/html')
  })
})

// ---------------------------------------------------------------------------
// generateHtmlDocument
// ---------------------------------------------------------------------------
describe('generateHtmlDocument', () => {
  it('returns a complete HTML document string', () => {
    const html = generateHtmlDocument('# Hello', '<p>World</p>')
    expect(html).toContain('<!DOCTYPE html>')
    expect(html).toContain('<html lang="en">')
    expect(html).toContain('</html>')
  })

  it('extracts the page title from the first markdown heading', () => {
    const html = generateHtmlDocument('# My Page Title\n\nContent', '<p>Body</p>')
    expect(html).toContain('<title>My Page Title</title>')
  })

  it('includes the provided HTML content in the body', () => {
    const html = generateHtmlDocument('# Title', '<div class="content"><p>Hello</p></div>')
    expect(html).toContain('<div class="content"><p>Hello</p></div>')
  })

  it('escapes HTML special characters in the title', () => {
    const html = generateHtmlDocument('# Hello <World> & "Test"', '<p>Content</p>')
    // innerHTML escapes &, <, > but NOT double-quotes in text content context
    expect(html).toContain('<title>Hello &lt;World&gt; &amp; "Test"</title>')
  })

  it('includes the KaTeX CSS stylesheet link', () => {
    const html = generateHtmlDocument('# Title', '<p>Content</p>')
    expect(html).toContain('katex.min.css')
  })

  it('uses "notes.md" as the fallback title for empty markdown', () => {
    const html = generateHtmlDocument('', '<p>Content</p>')
    expect(html).toContain('<title>notes.md</title>')
  })

  it('uses the first line as title when markdown has no heading', () => {
    const html = generateHtmlDocument('Just plain text', '<p>Content</p>')
    expect(html).toContain('<title>Just plain text</title>')
  })

  it('includes styled HTML structure in the output', () => {
    const html = generateHtmlDocument('# Title', '<p>Body</p>')
    expect(html).toContain('<style>')
    expect(html).toContain('body { font-family:')
    expect(html).toContain('pre { background:')
  })
})

// ---------------------------------------------------------------------------
// copyToClipboard
// ---------------------------------------------------------------------------
describe('copyToClipboard', () => {
  beforeEach(() => {
    // Provide a minimal clipboard mock since jsdom does not implement it
    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn(),
      },
    })
  })

  it('returns true when the clipboard write succeeds', async () => {
    ;(navigator.clipboard.writeText as ReturnType<typeof vi.fn>).mockResolvedValue(undefined)

    const result = await copyToClipboard('text to copy')
    expect(result).toBe(true)
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('text to copy')
  })

  it('returns false when the clipboard write fails', async () => {
    ;(navigator.clipboard.writeText as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error('Permission denied'),
    )

    const result = await copyToClipboard('text to copy')
    expect(result).toBe(false)
  })

  it('copies the exact text provided', async () => {
    ;(navigator.clipboard.writeText as ReturnType<typeof vi.fn>).mockResolvedValue(undefined)

    const longText = 'Line 1\nLine 2\nLine 3'
    await copyToClipboard(longText)
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(longText)
  })
})
