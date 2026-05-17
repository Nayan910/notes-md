// H-01/H-02: ⚠️ Plaintext API key stored in localStorage.
// This is NOT encrypted and is vulnerable to XSS attacks.
// For production, migrate to encrypted storage (e.g. via a secure backend proxy that injects the key).
const AI_CONFIG_KEY = 'notes-md-ai-config'
const AI_HISTORY_KEY = 'notes-md-ai-history'
const AI_SKILLS_KEY = 'notes-md-ai-skills'
const MAX_HISTORY_MESSAGES = 50
const DEFAULT_SKILLS = 'You are a helpful markdown writing assistant.'

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  timestamp: number
}

export interface AIConfig {
  endpoint: string
  apiKey: string
  model: string
  mode?: 'cloud' | 'ollama' | 'disabled'
}

export function getAIConfig(): AIConfig | null {
  try {
    const raw = localStorage.getItem(AI_CONFIG_KEY)
    if (!raw) return null
    const config = JSON.parse(raw)
    if (!config.mode) config.mode = 'cloud'
    return config
  } catch {
    return null
  }
}

export function saveAIConfig(config: AIConfig) {
  localStorage.setItem(AI_CONFIG_KEY, JSON.stringify(config))
}

export function clearAIConfig() {
  localStorage.removeItem(AI_CONFIG_KEY)
}

// Conversation History Functions
export function getConversationHistory(): ChatMessage[] {
  try {
    const raw = localStorage.getItem(AI_HISTORY_KEY)
    if (!raw) return []
    return JSON.parse(raw)
  } catch {
    return []
  }
}

export function saveConversationHistory(messages: ChatMessage[]) {
  // Keep only the last MAX_HISTORY_MESSAGES
  const trimmed = messages.slice(-MAX_HISTORY_MESSAGES)
  localStorage.setItem(AI_HISTORY_KEY, JSON.stringify(trimmed))
}

export function clearConversationHistory() {
  localStorage.removeItem(AI_HISTORY_KEY)
}

// AI Skills/Instructions Functions
export function getAISkills(): string {
  try {
    const raw = localStorage.getItem(AI_SKILLS_KEY)
    if (!raw) return DEFAULT_SKILLS
    return raw
  } catch {
    return DEFAULT_SKILLS
  }
}

export function saveAISkills(skills: string) {
  localStorage.setItem(AI_SKILLS_KEY, skills)
}

export function resetAISkills() {
  localStorage.removeItem(AI_SKILLS_KEY)
}

export async function askAI(prompt: string, systemPrompt?: string): Promise<string> {
  const config = getAIConfig()
  if (!config) throw new Error('AI not configured. Add an API key in Settings.')
  if (config.mode === 'disabled') throw new Error('AI is disabled in Settings.')

  if (config.mode === 'ollama') {
    const res = await fetch(`${config.endpoint || 'http://localhost:11434'}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: config.model || 'llama3',
        messages: [
          { role: 'system', content: systemPrompt || 'You are a helpful assistant.' },
          { role: 'user', content: prompt },
        ],
        stream: false,
      }),
    })
    if (!res.ok) {
      const err = await res.text()
      throw new Error(`Ollama error (${res.status}): ${err}. Make sure Ollama is running locally.`)
    }
    const data = await res.json()
    return data.message?.content || ''
  }

  const res = await fetch(`${config.endpoint}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model: config.model,
      messages: [
        { role: 'system', content: systemPrompt || 'You are a helpful assistant.' },
        { role: 'user', content: prompt },
      ],
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`AI API error (${res.status}): ${err}`)
  }

  const data = await res.json()
  return data.choices?.[0]?.message?.content || ''
}

export async function formatAsMarkdown(text: string): Promise<string> {
  return askAI(
    `Convert this plain text into well-formatted markdown. Preserve all information and structure:\n\n${text}`,
    'You are a markdown formatter. Output only the formatted markdown, no explanations.'
  )
}
