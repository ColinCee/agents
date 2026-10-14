# agents

Skills for coding agents, in the open [Agent Skills](https://agentskills.io) format, with the benchmark tasks that test them and my own instructions for agents. The skills work with any agent that reads `SKILL.md`: Claude Code, Codex, Cursor, Copilot, Gemini CLI and others.

## Install

```bash
npx skills add ColinCee/agents
```

It asks which skills and which agents. To see what is here without installing:

```bash
npx skills add ColinCee/agents --list
```

One skill, for every project of yours:

```bash
npx skills add ColinCee/agents --skill tidying --global
```

Or copy a folder from `skills/` into your agent's skills folder by hand.

## The skills

| Skill | What it does |
|---|---|
| [tidying](skills/tidying/SKILL.md) | Tidies a git repository after a stretch of work: lint, code nothing references, stale documents, old branches and data. Fixes what is safe, asks before anything that deletes |
| [safeguarding](skills/safeguarding/SKILL.md) | Before running tests, tools or someone else's script, finds data that could be lost (including outside the project) and makes it unreachable. Measured: [results](bench/safeguarding/) |

Not yet measured (`skills/.experimental/`):

| Skill | What it does |
|---|---|
| [cleaning](skills/.experimental/cleaning/SKILL.md) | Finds what a project no longer needs from evidence of use, and proposes what to remove. A fixed-size run was undecided; see [results](bench/cleaning/) |
| [housekeeping](skills/.experimental/housekeeping/SKILL.md) | A full pass in a safe order: safeguarding, tidying, cleaning, documents. Names each skill, with a fallback when it is not installed |

How they fit together:

```
housekeeping ──► safeguarding   what could be lost
             ├─► tidying        is the code healthy
             ├─► cleaning       is each thing still needed
             └─► doc-upkeep     do the documents say what is true (planned)
```

## Skills of other people's

A skill that exists already is listed here and not rewritten. None of these has been run through the tasks in this repository yet.

| Skill | From | For | Install |
|---|---|---|---|
| prune-dead-code | [lukeberrypi/skills](https://skills.sh/lukeberrypi/skills/prune-dead-code) | Code with no references left, reported for approval | `npx skills add lukeberrypi/skills --skill prune-dead-code` |

## My own instructions for agents

[home/AGENTS.md](home/AGENTS.md) is how I want every coding agent to work with me, in every project: rules I had to give more than once. It is mine, not a skill; copy what suits you. To install it as Claude Code's and Codex's user-level instructions:

```bash
python scripts/install_home.py
```

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
