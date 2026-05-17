import { describe, it, expect, beforeEach, afterEach, vi, type MockInstance } from 'vitest'
import { render } from '@testing-library/react'
import { useStore } from '../store/useStore'
import ErrorBoundary from '../components/ErrorBoundary'
import ExportMenu from '../components/ExportMenu'
import SettingsModal from '../components/SettingsModal'

const DEFAULT_SETTINGS = {
  fontSize: 14,
  fontFamily: 'Fira Code, Consolas, monospace',
  theme: 'system' as const,
  showLineNumbers: true,
  wordWrap: true,
  autoSave: true,
  autoSaveDelay: 2000,
  sideBySide: true,
  showSidebar: true,
  layoutMode: 'classic' as const,
}

beforeEach(() => {
  useStore.setState({
    docs: [],
    tabs: [],
    activeDocId: null,
    settings: { ...DEFAULT_SETTINGS },
    viewMode: 'both',
    isSettingsOpen: false,
  })
})

// ---------------------------------------------------------------------------
// ErrorBoundary
// ---------------------------------------------------------------------------
describe('ErrorBoundary', () => {
  let consoleErrorSpy: MockInstance

  beforeEach(() => {
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    consoleErrorSpy.mockRestore()
  })

  it('renders children when there is no error', () => {
    const { getByText } = render(
      <ErrorBoundary>
        <div>All good here</div>
      </ErrorBoundary>,
    )
    expect(getByText('All good here')).toBeInTheDocument()
  })

  it('catches errors and displays the default fallback UI', () => {
    const Broken = () => {
      throw new Error('Test crash')
    }

    const { getByText } = render(
      <ErrorBoundary>
        <Broken />
      </ErrorBoundary>,
    )

    expect(getByText('Something went wrong')).toBeInTheDocument()
    expect(getByText('Test crash')).toBeInTheDocument()
  })

  it('renders a custom fallback when provided', () => {
    const Broken = () => {
      throw new Error('Test crash')
    }

    const { getByText } = render(
      <ErrorBoundary fallback={<div>Custom Error</div>}>
        <Broken />
      </ErrorBoundary>,
    )

    expect(getByText('Custom Error')).toBeInTheDocument()
  })

  it('includes a reload button in the default fallback', () => {
    const Broken = () => {
      throw new Error('Oops')
    }

    const { getByText } = render(
      <ErrorBoundary>
        <Broken />
      </ErrorBoundary>,
    )

    const reloadButton = getByText('Reload')
    expect(reloadButton).toBeInTheDocument()
  })
})

// ---------------------------------------------------------------------------
// ExportMenu
// ---------------------------------------------------------------------------
describe('ExportMenu', () => {
  it('renders export options when a document is active', () => {
    useStore.getState().createDoc('Test Doc', '# Hello World')

    const { getByText } = render(<ExportMenu onClose={() => {}} />)
    expect(getByText('Markdown')).toBeInTheDocument()
    expect(getByText('HTML (simple)')).toBeInTheDocument()
  })

  it('returns null when no document is active', () => {
    useStore.setState({ docs: [], tabs: [], activeDocId: null })

    const { container } = render(<ExportMenu onClose={() => {}} />)
    expect(container.innerHTML).toBe('')
  })

  it('shows the Pandoc export section heading', () => {
    useStore.getState().createDoc('Doc', 'Content')

    const { getByText } = render(<ExportMenu onClose={() => {}} />)
    expect(getByText('Pandoc Export')).toBeInTheDocument()
  })

  it('renders all export format buttons', () => {
    useStore.getState().createDoc('Doc', 'Content')

    const { getByText } = render(<ExportMenu onClose={() => {}} />)
    const expectedLabels = [
      'Markdown',
      'HTML (simple)',
      'Word (.docx)',
      'OpenDocument (.odt)',
      'HTML (pandoc)',
      'Plain text',
      'reStructuredText',
      'LaTeX',
      'EPUB ebook',
    ]
    for (const label of expectedLabels) {
      expect(getByText(label)).toBeInTheDocument()
    }
  })
})

// ---------------------------------------------------------------------------
// SettingsModal
// ---------------------------------------------------------------------------
describe('SettingsModal', () => {
  it('renders nothing when isSettingsOpen is false', () => {
    useStore.setState({ isSettingsOpen: false })

    const { container } = render(<SettingsModal />)
    expect(container.innerHTML).toBe('')
  })

  it('renders the settings content when isSettingsOpen is true', () => {
    useStore.setState({ isSettingsOpen: true })

    const { getByText } = render(<SettingsModal />)
    expect(getByText('Settings')).toBeInTheDocument()
  })

  it('renders major settings sections', () => {
    useStore.setState({ isSettingsOpen: true })

    const { getByText } = render(<SettingsModal />)
    expect(getByText('Theme')).toBeInTheDocument()
    expect(getByText('Editor')).toBeInTheDocument()
    expect(getByText('Auto-save')).toBeInTheDocument()
    expect(getByText('Layout Mode')).toBeInTheDocument()
    expect(getByText('Layout')).toBeInTheDocument()
  })

  it('renders theme buttons (light, dark, system)', () => {
    useStore.setState({ isSettingsOpen: true })

    const { getByText } = render(<SettingsModal />)
    expect(getByText('light')).toBeInTheDocument()
    expect(getByText('dark')).toBeInTheDocument()
    expect(getByText('system')).toBeInTheDocument()
  })

  it('renders layout mode buttons', () => {
    useStore.setState({ isSettingsOpen: true })

    const { getByText } = render(<SettingsModal />)
    expect(getByText('classic')).toBeInTheDocument()
    expect(getByText('vscode')).toBeInTheDocument()
    expect(getByText('notes')).toBeInTheDocument()
  })

  it('renders the close button', () => {
    useStore.setState({ isSettingsOpen: true })

    const { getByText } = render(<SettingsModal />)
    expect(getByText('Close')).toBeInTheDocument()
  })

  it('renders the About section with Android APK download link', () => {
    useStore.setState({ isSettingsOpen: true })

    const { getByText } = render(<SettingsModal />)
    expect(getByText('About notes.md')).toBeInTheDocument()
    expect(getByText('Download Android APK (alpha)')).toBeInTheDocument()
  })
})
