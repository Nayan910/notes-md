const API_BASE = `${window.location.protocol}//${window.location.hostname}:8000`

export async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`)
  if (!res.ok) throw new Error(`API error: ${res.statusText}`)
  return res.json()
}

export async function apiPost<T>(path: string, body: unknown, headers?: Record<string, string>): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`API error: ${res.statusText}`)
  return res.json()
}

export async function uploadFile(path: string, file: File): Promise<any> {
  const form = new FormData()
  form.append('file', file)
  const res = await fetch(`${API_BASE}${path}`, { method: 'POST', body: form })
  if (!res.ok) throw new Error(`Upload failed: ${res.statusText}`)
  return res.json()
}

export async function exportDocument(markdown: string, targetFormat: string, filename: string): Promise<Blob> {
  const res = await fetch(`${API_BASE}/convert/export`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ markdown, target_format: targetFormat, filename }),
  })
  if (!res.ok) throw new Error(`Export failed: ${res.statusText}`)
  return res.blob()
}
