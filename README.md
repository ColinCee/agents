# agents

Skills, instructions and tools for coding agents.

## Skills

| Skill | Loads | What it does |
|---|---|---|
| [doc-upkeep](skills/doc-upkeep/SKILL.md) | by itself | Keeps docs and comments true, short and easy to scan: stale lines fixed in place, one home per fact. |
| [housekeeping](skills/housekeeping/SKILL.md) | `/housekeeping` | A full clean-up pass in a safe order: what could be lost, code health, unused code, docs. |
| [ui-decluttering](skills/ui-decluttering/SKILL.md) | `/ui-decluttering` | Redesigns a busy screen: one primary action, at most four choices in view. |
| [session-review](skills/session-review/SKILL.md) | `/session-review` | Finds what you keep correcting, typed or edited by hand in the agent's text, fixes each where it belongs, and measures whether the fix works. |
| [deciding](skills/deciding/SKILL.md) | by itself | Decides from evidence: one question, the ground truth, a fair repeated comparison. |
| [speed-budgets](skills/.experimental/speed-budgets/SKILL.md) | by itself | Fails CI when a web page gets heavier or slower than its budget: bytes by type, requests, LCP. Not yet tried. |
| [shipping-prs](skills/.experimental/shipping-prs/SKILL.md) | by itself | Takes a pull request from opened to merged: tests, fresh reviews for correctness, security, performance, docs and related repos, every automated comment answered and resolved. Not yet tried. |

```bash
npx skills add ColinCee/agents --global --skill '*' --agent claude-code
```

Results with and without each skill: [bench/](bench/).

Other people's skills I use:

| Skill | Loads | What it does | Install |
|---|---|---|---|
| [asd-ste100](https://github.com/danyuchn/asd-ste100-skill) | by itself | Rewrites dense or ambiguous English into short, one-meaning sentences (Simplified Technical English), for text an agent must parse. | `npx skills add danyuchn/asd-ste100-skill --global --agent claude-code` |

## Instructions for agents

[home/core.md](home/core.md) and [home/desktop.md](home/desktop.md): how every agent should work with me, and what applies only when I am there. Install: `npm run install-home -- --apply`.

That also installs [home/hooks/require-skill.mjs](home/hooks/require-skill.mjs), and its entry in `~/.claude/settings.json`. It refuses a step until the skill for it is loaded: `shipping-prs` before a first push or a pull request, `deciding` before a benchmark, `doc-upkeep` before editing a doc or code file.

## Tools

| Tool | What it does | Install |
|---|---|---|
| `lease` | Locks the GPU, RAM or a browser so agents and programs on one machine don't collide; one row above the Claude Code prompt shows RAM, holders and the GPU. | `npm run install-lease` |
| `keep-going` | A trial: when the agent stops, one reminder to check whether it really needs you, in half the sessions. [docs/keep-going.md](docs/keep-going.md) | `npm run install-keep-going` |

## Why so few skills

- Every installed skill costs context.
- A skill can make an agent worse: about one task in five, in published tests.
- Nobody knows how several skills mix.

So a skill stays only while it clearly helps. Sources: [docs/research.md](docs/research.md). Rules for this repository: [AGENTS.md](AGENTS.md).
