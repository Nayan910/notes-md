import { describe, it, expect, beforeEach } from 'vitest'
import { getAIConfig, saveAIConfig, clearAIConfig } from '../utils/ai'

const AI_CONFIG_KEY = 'notes-md-ai-config'

beforeEach(() => {
  localStorage.clear()
})

// ---------------------------------------------------------------------------
// getAIConfig
// ---------------------------------------------------------------------------
describe('getAIConfig', () => {
  it('returns null when no config is stored', () => {
    expect(getAIConfig()).toBeNull()
  })

  it('returns the previously saved config object', () => {
    const config = {
      endpoint: 'https://api.openai.com',
      apiKey: 'sk-test-123',
      model: 'gpt-4',
      mode: 'ollama' as const,
    }
    saveAIConfig(config)

    const retrieved = getAIConfig()
    expect(retrieved).toEqual(config)
  })

  it('returns null when localStorage contains invalid JSON', () => {
    localStorage.setItem(AI_CONFIG_KEY, 'not valid json')
    expect(getAIConfig()).toBeNull()
  })

  it('returns null when localStorage is empty for the key', () => {
    expect(localStorage.getItem(AI_CONFIG_KEY)).toBeNull()
    expect(getAIConfig()).toBeNull()
  })

  it('handles a config with an empty apiKey gracefully', () => {
    const config = { endpoint: '', apiKey: '', model: '', mode: 'cloud' as const }
    saveAIConfig(config)
    expect(getAIConfig()).toEqual(config)
  })
})

// ---------------------------------------------------------------------------
// saveAIConfig
// ---------------------------------------------------------------------------
describe('saveAIConfig', () => {
  it('persists the config object as a JSON string in localStorage', () => {
    const config = {
      endpoint: 'https://example.com',
      apiKey: 'sk-key',
      model: 'claude-3',
      mode: 'cloud' as const,
    }
    saveAIConfig(config)

    const raw = localStorage.getItem(AI_CONFIG_KEY)
    expect(raw).toBe(JSON.stringify(config))
  })

  it('overwrites any previously stored config', () => {
    saveAIConfig({ endpoint: 'old', apiKey: 'old', model: 'old', mode: 'cloud' })
    saveAIConfig({ endpoint: 'new', apiKey: 'new', model: 'new', mode: 'ollama' })

    expect(getAIConfig()).toEqual({ endpoint: 'new', apiKey: 'new', model: 'new', mode: 'ollama' })
  })

  it('stores the exact values provided', () => {
    const config = {
      endpoint: 'https://api.test.com/v1',
      apiKey: 'sk-abcdef123456',
      model: 'gpt-4-turbo',
      mode: 'ollama' as const,
    }
    saveAIConfig(config)
    expect(getAIConfig()).toEqual(config)
  })
})

// ---------------------------------------------------------------------------
// clearAIConfig
// ---------------------------------------------------------------------------
describe('clearAIConfig', () => {
  it('removes the config key from localStorage', () => {
    saveAIConfig({ endpoint: 'e', apiKey: 'k', model: 'm', mode: 'cloud' })
    expect(localStorage.getItem(AI_CONFIG_KEY)).not.toBeNull()

    clearAIConfig()
    expect(localStorage.getItem(AI_CONFIG_KEY)).toBeNull()
  })

  it('does not throw when no config exists', () => {
    expect(() => clearAIConfig()).not.toThrow()
  })

  it('allows saving again after clearing', () => {
    saveAIConfig({ endpoint: 'e1', apiKey: 'k1', model: 'm1', mode: 'cloud' })
    clearAIConfig()
    expect(getAIConfig()).toBeNull()

    saveAIConfig({ endpoint: 'e2', apiKey: 'k2', model: 'm2', mode: 'ollama' })
    expect(getAIConfig()).toEqual({ endpoint: 'e2', apiKey: 'k2', model: 'm2', mode: 'ollama' })
  })
})
