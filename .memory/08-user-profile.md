# User Profile: Nayan

> Important context for Bob clones working on this project. Read before making UX decisions or proposing features.

## Personality

Nayan is a power user who prefers CLI over GUI. He's comfortable with PowerShell, Node.js, Python, Flutter — a developer himself. He values:
- **Efficiency** — get things done, minimize ceremony
- **Privacy** — no cloud, no telemetry, no accounts-on-other-people's-servers
- **Local-first** — everything should work offline
- **Control** — wants to understand and own his data

## Machine Specs

| Attribute | Value |
|-----------|-------|
| OS | Windows 11 Pro 64-bit, 23H2 (build 22631.6199) |
| Shell | PowerShell 7.x |
| Editor | VS Code with Dart/Flutter extensions |
| C: drive | System only — prefers NOT to install dev tools here |
| E: drive | Primary workspace — 32 GB free |
| Flutter | `E:\apps\flutter\flutter\bin` (3.38.9, Dart 3.10.8) |
| Node.js | v22.20.0 |
| Python | 3.13.7 |
| Git | 2.53.0 |
| VS | NOT installed |
| Android SDK | NOT installed |
| JDK | NOT installed |

## Design Preferences

**HATES:**
- Purple/blue gradients (especially as backgrounds)
- Perfect box shadows (the `shadow-lg` Tailwind default look)
- Generic "modern" SaaS aesthetic (think Stripe clone)
- Over-designed UI that prioritizes looks over function

**PREFERS:**
- Warm colors — amber, rust, warm grays, olive
- Subtle imperfections — slightly irregular spacing, hand-crafted feel
- Interesting typography — not just Inter/Roboto everywhere
- Boutique/human-crafted feel — like a small indie app, not a corporation
- Functional minimalism — every element serves a purpose

**Currently violated:** The LoginPage uses blue-600 buttons. The PairPage uses blue-600 too. These were chosen for speed of implementation. A future pass should warm up the palette.

## Communication Style

- Direct, minimal small talk
- Gives short instructions like "continue" or "do X" when satisfied
- If he says "leave questions for later," make decisions and move forward
- Prefers seeing results over hearing about plans
- Trusts the agent to make good technical decisions

## Constraints

1. **E: drive only** — Never install tools or create projects on C: drive
2. **No Visual Studio** — Do not suggest installing VS unless explicitly asked. Visual Studio is 5+ GB and he doesn't have it.
3. **Android build is preferred** over Windows build (no VS needed, just SDK + JDK)
4. **32 GB free on E:** — Be mindful of disk space. Android SDK is ~3 GB, JDK is ~500 MB.

## Pat Answers

When Nayan asks about things he's already decided:
- "Option A" = WebView-based architecture (web editor in Flutter WebView)
- Project root = `E:\oprncode\project\`
- Flutter SDK at `E:\apps\flutter\flutter\bin`
- Priority: getting Android working > Windows > everything else
