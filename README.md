# agents

Skills for coding agents, in the open [Agent Skills](https://agentskills.io) format, with the results of the benchmarks that test them and my own instructions for agents. The skills work with any agent that reads `SKILL.md`: Claude Code, Codex, Cursor, Copilot, Gemini CLI and others.

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
npx skills add ColinCee/agents --skill doc-upkeep --global
```

Or copy a folder from `skills/` into your agent's skills folder by hand.

## The skills

Every result so far is on Claude Haiku 5.5 in Claude Code; a skill that helps one model can hurt another, so read each result as that model's.

Most are **commands**: they load only when you type their name (`/housekeeping`), so their descriptions cost the agent nothing the rest of the time. One loads by itself, because the moment it matters is inside other work.

| Skill | Loads | What it does |
|---|---|---|
| [doc-upkeep](skills/doc-upkeep/SKILL.md) | by itself | Keeps documents and comments true and few: stale lines fixed in place, one home per fact, comments that say why. [Results](bench/doc-upkeep/README.md) |
| [housekeeping](skills/housekeeping/SKILL.md) | `/housekeeping` | A full pass in a safe order: what could be lost, code health, what is no longer used, documents. [Results](bench/housekeeping/README.md) |
| [ui-decluttering](skills/ui-decluttering/SKILL.md) | `/ui-decluttering` | Redesigns a busy screen: one primary action, at most four choices in view, nothing unrelated. [Results](bench/ui-decluttering/README.md) |
| [session-review](skills/session-review/SKILL.md) | `/session-review` | Reviews past agent sessions for corrections you keep repeating, and says where each fix belongs. [Results](bench/session-review/README.md) |
| [deciding](skills/.experimental/deciding/SKILL.md) | `/deciding` | Decides from evidence: the question in one line, the ground truth, a fair repeated comparison, how sure. Experimental |

Commands are measured as you use them: the run with the skill starts with `/<name>`, the run without it gets the same request in plain words. `disable-model-invocation` is read by Claude Code; other agents load these like any skill.

The benchmark tests and every run are in a private repository, `agents-bench`, laid out like this one (`skills/<skill>/task`, `skills/<skill>/runs`): each test holds its grader and answers, and a model that has seen them could pass from memory, which would make every result here worthless. Archived there: tests for skills folded into `housekeeping` (tidying, cleaning), removed (safeguarding), or never needed because plain Haiku already did the job (strict types, keeping a card reachable after a UI change, auditing an unfair comparison).

## Skills of other people's

A skill that exists already is listed here and not rewritten. None of these has been run through the benchmark yet.

| Skill | From | For | Install |
|---|---|---|---|
| prune-dead-code | [lukeberrypi/skills](https://skills.sh/lukeberrypi/skills/prune-dead-code) | Code with no references left, reported for approval | `npx skills add lukeberrypi/skills --skill prune-dead-code` |

## My own instructions for agents

[home/AGENTS.md](home/AGENTS.md) is how I want every coding agent to work with me, in every project: rules I had to give more than once. It is mine, not a skill; copy what suits you. To install it as Claude Code's and Codex's user-level instructions:

```bash
python scripts/install_home.py           # what would change
python scripts/install_home.py --apply   # install, keeping a backup of anything replaced
```

## What every skill here keeps to

- **Scripts report by default.** Nothing is deleted or written unless you pass a flag that says so, and the skill tells the agent to ask you first.
- **No paths, names or accounts of the author's.** Scripts take arguments.
- **Python 3.11 or later, standard library only**, unless the skill's `compatibility` line says otherwise.
- **No agent's own tools are named.** Instructions say what to do, not which tool does it.
- **Tested before it is added.** Each skill's results page says what the test asks, the real incident behind it, and how it scored with and without the skill.

Installing a skill lets its scripts run on your machine. Read them first: they are short.

## Adding a skill

The rules are in [AGENTS.md](AGENTS.md): what earns a place, how `SKILL.md` and scripts are written, and how a skill is tested. Check a skill against them with:

```bash
python scripts/validate.py
```

## Licence

MIT. See [LICENSE](LICENSE).
