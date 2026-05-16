---
name: git-token-auth
description: Configure Git to use a personal access token for HTTPS authentication with Forgejo/Codeberg/GitHub
trigger:
  - "git push authentication failed"
  - "setup git token"
  - "codeberg auth"
weight: 5
tier: 2
---

# Git Token Authentication

For Forgejo/Codeberg/GitHub repos using HTTPS, use a personal access token instead of a password.

## Setup

```powershell
# Store token in git credential helper
git config --global credential.helper store

# Write credentials file (~/.git-credentials)
$token = "your-token-here"
"https://username:$token@codeberg.org" | Out-File -FilePath "$env:USERPROFILE\.git-credentials" -Encoding ASCII

# Now push
git push
```

## Security
- Token is stored in plaintext in `%USERPROFILE%\.git-credentials`
- The credential file is local to the machine
- Revoke tokens via Codeberg → Settings → Applications
