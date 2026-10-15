# agents

Skills, instructions and tools for coding agents.

## Skills

| Skill | By | Loads | What it does |
|---|---|---|---|
| [doc-upkeep](skills/doc-upkeep/SKILL.md) | me | by itself | Keeps docs and comments true and short: stale lines fixed in place, one home per fact. |
| [housekeeping](skills/housekeeping/SKILL.md) | me | `/housekeeping` | A full clean-up pass in a safe order: what could be lost, code health, unused code, docs. |
| [ui-decluttering](skills/ui-decluttering/SKILL.md) | me | `/ui-decluttering` | Redesigns a busy screen: one primary action, at most four choices in view. |
| [session-review](skills/session-review/SKILL.md) | me | `/session-review` | Finds corrections you keep repeating in past sessions, and where each fix belongs. |
| [deciding](skills/deciding/SKILL.md) | me | `/deciding` | Decides from evidence: one question, the ground truth, a fair repeated comparison. |
| [prune-dead-code](https://skills.sh/lukeberrypi/skills/prune-dead-code) | lukeberrypi | by itself | Finds code nothing uses any more and asks before removing it. |

```bash
npx skills add ColinCee/agents --global --skill '*' --agent claude-code   # mine, for Claude Code
npx skills add lukeberrypi/skills --skill prune-dead-code                 # someone else's
```

Results with and without each skill: [bench/](bench/).

## Instructions for agents

[home/AGENTS.md](home/AGENTS.md): how every agent should work with me. Install: `npm run install-home -- --apply`.

## Tools

| Tool | What it does | Install |
|---|---|---|
| `lease` | Locks the GPU, RAM or a browser so agents and programs on one machine don't collide; a status line in Claude Code shows who holds what. | `npm run install-lease` |

## Why so few skills

- Every installed skill costs context.
- A skill can make an agent worse: about one task in five, in published tests.
- Nobody knows how several skills mix.

So a skill stays only while it clearly helps. Sources: [docs/research.md](docs/research.md). Rules for this repository: [AGENTS.md](AGENTS.md).
