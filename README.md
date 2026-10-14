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
npx skills add ColinCee/agents --skill safeguarding --global
```

Or copy a folder from `skills/` into your agent's skills folder by hand.

## The skills

Every result so far is on Claude Haiku 5.5 in Claude Code; a skill that helps one model can hurt another, so read each result as that model's.

| Skill | What it does |
|---|---|
| [safeguarding](skills/safeguarding/SKILL.md) | Before running tests, tools or someone else's script, finds data that could be lost (including outside the project) and makes it unreachable. Measured: [results](bench/safeguarding/README.md) |
| [cleaning](skills/cleaning/SKILL.md) | Finds what a project no longer needs from evidence of use, and proposes what to remove, without running anything that could destroy the owner's data. Measured: [results](bench/cleaning/README.md) |
| [housekeeping](skills/housekeeping/SKILL.md) | A command: "do some housekeeping" runs a full pass in a safe order (safeguarding, tidying, cleaning, documents), naming each skill, with a fallback when it is not installed. Measured alone, on its fallbacks, without the focused skills installed: [results](bench/housekeeping/README.md) |
| [tidying](skills/tidying/SKILL.md) | Tidies a repository after a stretch of work: lint, code and pages nothing reaches, stale documents, uncommitted work, old branches and data. Measured: [results](bench/tidying/README.md) |
| [doc-upkeep](skills/doc-upkeep/SKILL.md) | Brings documents back in line with the code and leaves them shorter: stale lines replaced in place, one home per fact, no log of what was removed. Measured: [results](bench/doc-upkeep/README.md) |
| [ui-decluttering](skills/ui-decluttering/SKILL.md) | Redesigns a cluttered screen so the user decides quickly: one primary action, at most four choices in view, nothing unrelated, controls that look like what they do. Measured: [results](bench/ui-decluttering/README.md) |
| [session-review](skills/session-review/SKILL.md) | A command: reviews past agent sessions for corrections the user keeps repeating, and says where each fix belongs (their own instructions, a project, a skill) so it stops coming back. Measured: [results](bench/session-review/README.md) |

Not yet measured (`skills/.experimental/`):

| Skill | What it does |
|---|---|
| [deciding](skills/.experimental/deciding/SKILL.md) | A command: decides from evidence (the question in one line, what is known, a fair comparison, how sure). Being measured |

How they fit together:

```
housekeeping ──► safeguarding   what could be lost
             ├─► tidying        is the code healthy (unmeasured)
             ├─► cleaning       is each thing still needed
             └─► doc-upkeep     do the documents say what is true
```

The benchmark tasks are in a private repository, `agents-bench`: each holds its grader and answers, and a model that has seen them could pass from memory, which would make every result here worthless. What each task asks and which real incident it comes from is in that skill's results page. Tasks with no skill, because plain Haiku already does the job: strict types for one reported field ([results](bench/strict-types/)), keeping a decided card reachable after a UI change ([results](bench/ui-flow/)), auditing an unfair comparison ([results](bench/experiment-design/)).

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
