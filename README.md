# agents

Skills, instructions and tools for coding agents.

## Skills

| Skill | Loads | What it does |
|---|---|---|
| [doc-upkeep](skills/doc-upkeep/SKILL.md) | by itself | Keeps docs and comments true, short and easy to scan: stale lines fixed in place, one home per fact. |
| [housekeeping](skills/housekeeping/SKILL.md) | `/housekeeping` | A full clean-up pass in a safe order: what could be lost, code health, unused code, docs. |
| [ui-decluttering](skills/ui-decluttering/SKILL.md) | `/ui-decluttering` | Redesigns a busy screen: one primary action, at most four choices in view. |
| [session-review](skills/session-review/SKILL.md) | `/session-review` | Finds what you keep correcting, typed or edited by hand in the agent's text, and where each fix belongs. |
| [deciding](skills/deciding/SKILL.md) | by itself | Decides from evidence: one question, the ground truth, a fair repeated comparison. |

```bash
npx skills add ColinCee/agents --global --skill '*' --agent claude-code
```

Results with and without each skill: [bench/](bench/).

Other people's skills I use:

| Skill | Loads | What it does | Install |
|---|---|---|---|
| [asd-ste100](https://github.com/danyuchn/asd-ste100-skill) | by itself | Rewrites dense or ambiguous English into short, one-meaning sentences (Simplified Technical English), for text an agent must parse. | `npx skills add danyuchn/asd-ste100-skill --global --agent claude-code` |

## Instructions for agents

[home/AGENTS.md](home/AGENTS.md): how every agent should work with me. Install: `npm run install-home -- --apply`.

The same command adds a review of each Claude Code session you archive in the Claude desktop app: it runs session-review on that one session with read-only tools and writes the report to `~/.claude/session-reviews/` and opens the review as a new session in the desktop app, where you can reply to act on a lesson. Source: [src/home/review-on-archive.mts](src/home/review-on-archive.mts).

## Tools

| Tool | What it does | Install |
|---|---|---|
| `lease` | Locks the GPU, RAM or a browser so agents and programs on one machine don't collide; a status line in Claude Code shows who holds what. | `npm run install-lease` |

## Why so few skills

- Every installed skill costs context.
- A skill can make an agent worse: about one task in five, in published tests.
- Nobody knows how several skills mix.

So a skill stays only while it clearly helps. Sources: [docs/research.md](docs/research.md). Rules for this repository: [AGENTS.md](AGENTS.md).
