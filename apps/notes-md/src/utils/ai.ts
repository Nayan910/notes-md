// H-01/H-02: ⚠️ Plaintext API key stored in localStorage.
// This is NOT encrypted and is vulnerable to XSS attacks.
// For production, migrate to encrypted storage (e.g. via a secure backend proxy that injects the key).
const AI_CONFIG_KEY = 'notes-md-ai-config'

export interface AIConfig {
  endpoint: string
  apiKey: string
  model: string
}

export function getAIConfig(): AIConfig | null {
  try {
    const raw = localStorage.getItem(AI_CONFIG_KEY)
    if (!raw) return null
    return JSON.parse(raw)
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

export async function askAI(prompt: string, systemPrompt?: string): Promise<string> {
  const config = getAIConfig()
  if (!config) throw new Error('AI not configured. Add an API key in Settings.')

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
