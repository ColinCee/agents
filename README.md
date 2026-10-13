# skills

Skills for coding agents, in the open [Agent Skills](https://agentskills.io) format. They work with any agent that reads `SKILL.md`: Claude Code, Codex, Cursor, Copilot, Gemini CLI and others.

## Install

```bash
npx skills add ColinCee/skills
```

It asks which skills and which agents. To see what is here without installing:

```bash
npx skills add ColinCee/skills --list
```

One skill, for every project of yours:

```bash
npx skills add ColinCee/skills --skill housekeeping --global
```

Or copy a folder from `skills/` into your agent's skills folder by hand.

## The skills

| Skill | What it does |
|---|---|
| [housekeeping](skills/housekeeping/SKILL.md) | Tidies a git repository after a stretch of work: lint, unused code, stale documents, old branches and data. Fixes what is safe, asks before anything that deletes |

## What every skill here keeps to

- **Scripts report by default.** Nothing is deleted or written unless you pass a flag that says so, and the skill tells the agent to ask you first.
- **No paths, names or accounts of the author's.** Scripts take arguments.
- **Python 3.11 or later, standard library only**, unless the skill's `compatibility` line says otherwise.
- **No agent's own tools are named.** Instructions say what to do, not which tool does it.
- **Tested before it is added.** Each skill carries the tasks it was tried on, in its `evals/` folder.

Installing a skill lets its scripts run on your machine. Read them first: they are short.

## Adding a skill

The rules are in [AGENTS.md](AGENTS.md): what earns a place, how `SKILL.md` and scripts are written, and how a skill is tested. Check a skill against them with:

```bash
python scripts/validate.py
```

## Licence

MIT. See [LICENSE](LICENSE).
