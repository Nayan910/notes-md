export function downloadAsFile(content: string, filename: string, mimeType: string = 'text/markdown'): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function generateHtmlDocument(markdown: string, htmlContent: string): string {
  const title = markdown.split('\n')[0]?.replace(/^#\s+/, '') || 'notes.md';
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)}</title>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.css">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 800px; margin: 0 auto; padding: 2em; line-height: 1.6; color: #1a1a1a; }
    pre { background: #1e1e2e; color: #e4e4e4; padding: 1em; border-radius: 6px; overflow-x: auto; }
    code { font-family: 'Fira Code', monospace; }
    img { max-width: 100%; }
    table { border-collapse: collapse; width: 100%; }
    th, td { border: 1px solid #ccc; padding: 0.5em; }
    blockquote { border-left: 4px solid #4a9eff; margin: 0; padding: 0.5em 1em; background: #f8f9fa; }
  </style>
</head>
<body>
  ${htmlContent}
</body>
</html>`;
}

export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
