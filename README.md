# agents

My own skills for coding agents, the instructions I give every agent, and what I have learned making them. The skills are in the open [Agent Skills](https://agentskills.io) format, so any agent that reads `SKILL.md` can use them: Claude Code, Codex, Cursor, Copilot, Gemini CLI and others.

## Fewer skills is better

- **A skill costs context.** Every installed skill's description sits in the agent's context; a loaded one costs its whole body.
- **A skill can make things worse.** In published tests about one task in five went worse with a skill, and a skill that helped one model hurt another.
- **Nobody knows how skills mix.** Several skills loaded together can pull different ways, and no study has measured it.

So this repository keeps only skills that clearly helped in real work, and deletes one that stops earning its place. The findings, with sources, are in [docs/research.md](docs/research.md).

## The skills

Most are commands: they load only when you type their name, so they cost nothing the rest of the time.

| Skill | Loads | What it does |
|---|---|---|
| [doc-upkeep](skills/doc-upkeep/SKILL.md) | by itself | Keeps documents and comments true and few: stale lines fixed in place, one home per fact, comments that say why. |
| [housekeeping](skills/housekeeping/SKILL.md) | `/housekeeping` | A full clean-up pass in a safe order: what could be lost, code health, what is no longer used, documents. |
| [ui-decluttering](skills/ui-decluttering/SKILL.md) | `/ui-decluttering` | Redesigns a busy screen: one primary action, at most four choices in view. |
| [session-review](skills/session-review/SKILL.md) | `/session-review` | Finds corrections you keep repeating in past sessions, and says where each fix belongs. |
| [deciding](skills/deciding/SKILL.md) | `/deciding` | Decides from evidence: the question in one line, the ground truth, a fair repeated comparison. |

Each was measured on Claude Haiku with and without the skill; the results are in [bench/](bench/).

```bash
npx skills add ColinCee/agents                                   # pick skills and agents
npx skills add ColinCee/agents --global --skill '*' --agent claude-code
```

Claude Code reads only `~/.claude/skills`, not the shared `~/.agents/skills`, so tick it when asked. Two skills run scripts (Node 22 or later, built-in modules only); they change nothing unless you pass a flag that says so. Read them first: they are short.

## Other people's skills

A skill that already exists is listed here, not copied.

| Skill | From | Install |
|---|---|---|
| prune-dead-code | [lukeberrypi/skills](https://skills.sh/lukeberrypi/skills/prune-dead-code) | `npx skills add lukeberrypi/skills --skill prune-dead-code` |

## My instructions for agents

[home/AGENTS.md](home/AGENTS.md): how I want every agent to work with me, in every project. `npm run install-home -- --apply` installs it for Claude Code and Codex.

## lease

A lock for the resources programs and agents on one machine fight over (GPU, RAM, a browser), kept in a file with no server. `lease --help` has the details.

```bash
npm run install-lease                                     # installs `lease`, and a status band in Claude Code
lease show                                                # who holds what
lease run --name train --res gpu --res ram:20 -- python train.py
```

## Working on this repository

The rules are in [AGENTS.md](AGENTS.md). Run `npm run check` before committing. MIT licence.
