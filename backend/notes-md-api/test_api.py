"""Quick verification script for backend API"""
from fastapi.testclient import TestClient
from main import app

client = TestClient(app)

# Health check
r = client.get('/health')
print(f"Health: {r.status_code} {r.json()}")

# Formats list
r = client.get('/formats')
print(f"Formats: {len(r.json()['formats'])} supported")

# Convert text
r = client.post('/convert/text', json={
    'content': '<h1>Test</h1><p>Hello <strong>world</strong></p>',
    'source_format': 'html'
})
print(f"Convert: {r.status_code}")
if r.status_code == 200:
    print(f"Markdown: {r.json()['markdown'][:80]}...")
    print(f"Success: {r.json()['success']}")

print("\nAll checks passed!")
