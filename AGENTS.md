# Rules for this repository

Skills here are in the open [Agent Skills](https://agentskills.io/specification) format and are installed with `npx skills add`. Any agent may load them, on any operating system, on a machine that is not the author's. Every rule below follows from that.

`scripts/validate.py` checks the rules that a program can check. Run it before every commit; CI runs it too.

## What earns a place

A skill can make an agent worse. In published tests the same skill helped on one model and agent and hurt on another, and about one task in five did worse with a skill than without. So a skill is added only when all six are true:

0. **No good one exists already.** Search [skills.sh](https://skills.sh) first. A skill of someone else's that does the job goes in the list in `README.md`, with its install command, and is not copied here.
1. **It came from real work.** The same steps or the same corrections turned up in at least three sessions. A skill written from general knowledge says what the agent already knows.
2. **The agent does worse without it.** Run the task with no skill first. If the result is already good, there is nothing to add. What "worse" means depends on the kind of skill:
   - A **fix** is loaded by the agent when its description matches, and stops a mistake (`safeguarding`). Worse: the agent makes the mistake.
   - A **command** is asked for by name (`housekeeping`), and stands for a whole process the user would otherwise type out. Worse: the same words without the skill leave out steps the process promises, or do them differently from run to run.
3. **It is one job.** Like a function: narrow enough that its description says exactly when to use it, wide enough that one task does not need three skills.
4. **It is generic.** Nothing in it depends on the author's projects, machine, accounts or one agent's tools. What differs per project is read from that project (its `AGENTS.md`, `README.md`, config), not written into the skill.
5. **It was measured.** Run with the skill and without it, it passes more checks with it, and the cost in tokens and time is known. See Testing.

## Layout

```
skills/<name>/
  SKILL.md        required
  scripts/        code the agent runs
  references/     text the agent reads only when SKILL.md says to
  assets/         templates and other files used in the output
  evals/          evals.json and triggers.json
```

- Flat: one folder per skill directly under `skills/`. The folder name is the skill's `name`.
- A skill that has not been measured yet lives in `skills/.experimental/`. It moves up when a run shows it helps, and is deleted when a run shows it does not.
- **Two levels.** A checklist skill (such as `housekeeping`) names the focused skills to use at each step, with one line saying what to do when that skill is not installed. A focused skill does one job and never needs another; it may mention one ("if the evidence is thin, see `experiment-design`") but must make sense alone. No deeper levels, and a checklist never calls another checklist.
- Every file in `scripts/`, `references/` and `assets/` is named in `SKILL.md` with its path and when to use it. No file is reached only through another reference.
- Paths are relative to the skill folder and use forward slashes.
- Each skill is listed in the table in `README.md`.
- `home/AGENTS.md` is the author's own user-level instructions, not a skill. The rules for skills do not apply to it; `scripts/install_home.py` installs it.

## SKILL.md

**Frontmatter.** Only the fields of the specification: `name`, `description`, `license`, `compatibility`, `metadata`, `allowed-tools`. Each value on one line, because some agents read frontmatter with a simple parser.

- `name`: lowercase letters, digits and single hyphens, 64 characters at most. Says the activity (`tidying`), not `helper` or `utils`.
- `description`: what the skill does, then `Use when ...` with the words a user would really say. Third person. Aim for 250 characters or fewer; 1024 is the limit. This is the only text the agent sees when deciding to load the skill. In one large test agents loaded an installed skill on only 41% of the tasks that needed it, and the usual cause was the description.
- `license`: `MIT`.
- `compatibility`: only what must be on the machine (`Requires git and Python 3.11 or later.`). Leave it out when the skill is instructions only.

**Body.** 500 lines at most, and shorter is better: it is all loaded whenever the skill is used.

- Do not repeat the name as the first heading. Start with what to do.
- Write only what the agent would get wrong without being told. Do not explain what it already knows.
- Each rule names the thing it is about: a command, a file, a flag, a word in the output. Rules that name something are followed; general advice mostly is not. A rule that names nothing is a candidate to delete.
- Give the reason in one clause. An agent that knows the reason handles the case the rule did not foresee; capitals and `MUST` do not do that.
- Say which parts are binding and which are examples. The most common way a skill breaks a task is the agent treating an example, a template or a default as a requirement.
- Do not tell the agent where to write its output or what to install unless that is the skill's job. The user's task decides those.
- Ask for checks in proportion to the change. A skill that orders every check on every run makes small tasks slow, and that is the most common way a skill wastes time.
- No install steps, changelog, licence text or to-do notes in the body.
- Teach the method, not one answer. Steps that work for any project of the kind.
- One default, not a list of choices. Name another way only with the case it is for.
- Be exact where a mistake is costly (the command to run, what must not be deleted) and loose where judgement is better.
- Keep a list of gotchas: the facts that are not what a careful agent would guess. When the skill fails in use, the correction goes there.
- For output with a fixed shape, show a template.
- Name no agent's own tools. Say what to do ("search the code", "ask the user"), not which tool does it.
- No dates or versions that will go stale.
- Move text needed only sometimes to `references/`, and say in `SKILL.md` when to read it.

## Scripts

Write a script only for work that is the same every time: counting, parsing, checking, surveying. Judgement stays in `SKILL.md`. A script costs no context until its output is read, and it gives the same answer on every run.

**Language: Python, standard library only.** One language keeps the repository checkable with one set of tools. Python is already on most machines an agent works on, and its standard library covers files, JSON, subprocesses and HTTP without an install step. Node is not used for scripts: `npx skills` needs it to install a skill, but that says nothing about the machine the skill later runs on.

- **Python 3.11 or later**, the oldest version that still gets security fixes. Raise it when that version changes.
- When a package is truly needed, declare it in the script with [inline metadata](https://packaging.python.org/en/latest/specifications/inline-script-metadata/) and exact versions, run it with `uv run`, and say `uv` in `compatibility`. No `requirements.txt`, no install step.
- When an existing tool does the job, call it with an exact version (`uvx ruff@0.17.0`, `npx eslint@9.0.0`) in place of writing a script.
- Runs the same on Windows, macOS and Linux: `pathlib`, `encoding="utf-8"` on every file and subprocess, no shell commands.

**Made for an agent to run.**

- Never waits for typed input. Everything comes from arguments.
- `--help` works and is short: what it does, each flag, the exit codes. That is how the agent learns the script.
- Results go to stdout, with `--json` for a form a program can read. Progress and warnings go to stderr.
- Errors say what was wrong, what was expected and what to try.
- Output has a limit. A long list is cut with a count of what was left out.
- Safe to run twice.
- Every number in the code that is a choice has a comment saying why that number.

## Safety

Installing a skill lets its scripts run on someone's machine, with their files.

- **Scripts report by default.** Nothing is written, deleted or sent unless a flag says so (`--apply`), and the skill tells the agent to ask the user before passing it.
- No network use unless `compatibility` says so and the skill is about that.
- Never read secrets, sign-in files or keys.
- Never download and run code. No `curl | sh`.
- No paths, names or accounts of the author's.

## Testing

A skill is tested in four steps, the cheapest first. Each step has a time budget, because a check that is slow stops being run. Results are kept per model and per agent and never averaged across them, because a skill that helps one can hurt another.

| Step | Budget | When |
|---|---|---|
| 1. Checks on the text: `scripts/validate.py` | seconds | every change |
| 2. Triggering: `evals/triggers.json`, about twenty queries, half that should load the skill and half that are close but should not | about a minute | when the description changes |
| 3. Tasks: `tasks/<name>/`, a fixture with planted faults, checks a script can decide, five runs with the skill and five without, on a small fast model | under five minutes | when the skill's body changes |
| 4. The same tasks on the larger models | as long as it takes | when the user is away; never a gate on the next edit |

- **A slow check is a fault to fix,** not a cost to accept. Run trials side by side, keep the fixture small, and put what every trial installs into the image.
- **Every run reports how long it took,** so a check that is getting slower is seen.
- **Each measured skill has `bench/<name>/README.md`:** what to expect from it in one line, a table of the checks that differ (without, with, tokens), what the test asks and which real incident it comes from, and a link to the latest run. Update it with every run that changes the picture.
- **A task earns its place by telling two things apart:** with the skill and without it, or one version and the next. One that scores the same either way is shelved.

**The decision rule, fixed before any run.** A skill moves out of `skills/.experimental/` when, on at least one model, with at least ten runs each way:

- it is ahead on some check by at least four runs in ten (6 of 10 without, 10 of 10 with, or better),
- it is behind on no check by more than one run in ten,
- and it costs no more than three times the input tokens. Cost is reported on every run, but it is a cap for runaway skills, not a trade-off: the run without the skill did not do the job, so its lower cost buys nothing. (Set by the owner on 14 October, after a quarter and then a half held back skills that did the job fully.)

It is deleted when twenty runs each way show no check ahead by three runs in ten. Both arms run on the same task, model, harness and agent versions; `bench.py` keys saved runs on all of them, so a no-skill arm is reused only when none has changed. Results from a changed set-up are never compared. Change this rule only between skills, never to rescue one. The run that decides has a number of runs fixed before it starts. Stopping at the first batch that crosses the line favours a positive verdict, so `--until-decided` is for exploring, never for deciding.

For step 3:

- **Lock the task down.** In `task.toml`: the agent runs as an ordinary user (`[agent] user`), reaches Anthropic and nothing else (`network_mode = "allowlist"`), and is graded in a fresh container with no network (`[verifier] environment_mode = "separate"`) that receives only the declared `artifacts`. The grading script never enters the agent's container, and this repository is public, so open internet would let an agent read it. The fixture's git history holds the faults, never a later commit that fixes them, and the build leaves nothing else on the disk. Copy `tasks/cleaning/task.toml`.
- **Plant the faults, and plant traps.** Half the checks are things a careless agent gets wrong (the file it must not delete), taken from mistakes that really happened.
- **The task text gives nothing away.** It does not name a planted fault or a check.
- **Check what the agent did, not only what it left.** An agent that wipes data and rewrites it from memory leaves the same end state as one that never touched it; it was seen in 4 of 10 runs. Put checks on the commands in `tasks/<name>/trajectory_checks.json`, and fix them before the run that decides anything.
- **Make the owner's data too large to retype.** Fixture data that fits in one tool output can be typed back after a wipe, and the end-state check passes it; seen on the cleaning and housekeeping tasks. Give it more than one output shows (about 100 KB).
- **Check that the skill was used.** A run "with the skill" in which the agent never read `SKILL.md` is a run without it.
- **Count tokens, time and turns** as well as passes. A skill that passes one more check at twice the cost may not be worth it.
- **Drop a check that passes without the skill.** It costs a run and says nothing.
- **Grade only what the task asks for.** A check the task text never asks for (one way of writing "none" when the project documents another) grades agreement with the skill, not the job, and a skill that states the preference wins on taste. Drop it, or make the task ask. For a command, the task text is the command's name, and what it asks for is every step the command promises: grade each step, and give the run without the skill the same words.
- **Count a fault as handled when it is fixed or named in the report.** An agent told to leave decisions to the user is right to report and not fix.
- **Deleting a rule needs a run too.** Removing a rule loses most of what adding it gained.
- **Read what the agent did,** not only its last message, and keep only the instructions that changed the result.

What a script cannot decide (is the report clear, was the change tasteful) is read by a person, with the two results side by side and unlabelled.

## Before committing

```bash
python scripts/validate.py
```

When a skill's body or its task changed, and Docker is free:

```bash
python scripts/bench.py <skill>
```

It runs the task both ways side by side, says how long it took, and marks each check that does not tell the two apart. A checklist skill has no task of its own: score it on each focused skill's task with `--task <name>`, and report each task separately. With nothing changed it scores the saved runs and starts no agent.

```bash
uvx ruff@0.17.0 check .
```

```bash
uvx ruff@0.17.0 format --check .
```

Commit messages say what changed and why, in a plain sentence.

## Where these rules come from

[docs/research.md](docs/research.md): the findings, with their sources. When a rule here changes because of new work, change the finding there too.
