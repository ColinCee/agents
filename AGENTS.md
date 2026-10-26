# Rules for this repository

Skills here are in the open [Agent Skills](https://agentskills.io/specification) format and are installed with `npx skills add`. Any agent may load them, on any operating system, on a machine that is not the author's. Every rule below follows from that.

`npm run validate` checks the rules that a program can check; `npm run check` runs it with the type-check, lint, tests and build. Run it before every commit; CI runs it too.

## What earns a place

Fewer skills is better. Every installed skill's description costs context, a loaded skill costs its whole body, a skill can make an agent worse (in published tests about one task in five did worse with one, and a skill that helped one model hurt another), and how several skills interact is unknown. So a skill is added only when all six are true, and deleted when it stops earning its place:

0. **No good one exists already.** Search [skills.sh](https://skills.sh) first. A skill of someone else's that does the job goes in the list in `README.md`, with its install command, and is not copied here.
1. **It came from real work.** The same steps or the same corrections turned up in at least three sessions. A skill written from general knowledge says what the agent already knows.
2. **The agent does worse without it.** Run the task with no skill first. If the result is already good, there is nothing to add. What "worse" means depends on the kind of skill:
   - A **fix** is loaded by the agent when its description matches, and stops a mistake (`safeguarding`). Worse: the agent makes the mistake.
   - A **command** is asked for by name (`housekeeping`), and stands for a whole process the user would otherwise type out. It carries `disable-model-invocation: true`, so it loads only when named and its description costs nothing otherwise; most skills here are commands. Worse: the same words without the skill leave out steps the process promises, or do them differently from run to run.
3. **It is one job.** Like a function: narrow enough that its description says exactly when to use it, wide enough that one task does not need three skills.
4. **It is generic.** Nothing in it depends on the author's projects, machine, accounts or one agent's tools. What differs per project is read from that project (its `AGENTS.md`, `README.md`, config), not written into the skill.
5. **It was tried.** The same real task, run with the skill and without it, comes out clearly better with it. See Trying a skill.

## Layout

```
skills/<name>/
  SKILL.md        required
  scripts/        code the agent runs
  references/     text the agent reads only when SKILL.md says to
  assets/         templates and other files used in the output
```

- Flat: one folder per skill directly under `skills/`. The folder name is the skill's `name`.
- A skill not yet tried lives in `skills/.experimental/`. It moves up when a try shows it helps, and is deleted when it does not.
- **Two levels.** A checklist skill (such as `housekeeping`) may name a focused skill for a step (`doc-upkeep`), with one line saying what to do when that skill is not installed. A focused skill does one job and never needs another. No deeper levels, and a checklist never calls another checklist. Prefer folding a step into the checklist over a separate skill the user would rarely call.
- Every file in `scripts/`, `references/` and `assets/` is named in `SKILL.md` with its path and when to use it. No file is reached only through another reference.
- Paths are relative to the skill folder and use forward slashes.
- Each skill is listed in the table in `README.md`.
- `home/AGENTS.md` is the author's own user-level instructions, not a skill. The rules for skills do not apply to it; `npm run install-home -- --apply` installs it.
- `src/` holds the TypeScript source of what ships; `tools/` the repository's own tools; `tests/` their tests.
- `src/home/` is the author's own session review hook, like `home/AGENTS.md` not a skill: `npm run install-home` builds it to `dist/home/` and installs it.

## SKILL.md

**Frontmatter.** Only the fields of the specification: `name`, `description`, `license`, `compatibility`, `metadata`, `allowed-tools`, plus `disable-model-invocation: true` on a command (read by Claude Code; other agents skip it). Each value on one line, because some agents read frontmatter with a simple parser.

- `name`: lowercase letters, digits and single hyphens, 64 characters at most. Says the activity (`tidying`), not `helper` or `utils`.
- `description`: what the skill does, then `Use when ...` with the words a user would really say. Third person. Aim for 250 characters or fewer; 1024 is the limit. This is the only text the agent sees when deciding to load the skill. In one large test agents loaded an installed skill on only 41% of the tasks that needed it, and the usual cause was the description.
- `license`: `MIT`.
- `compatibility`: only what must be on the machine (`Requires git and Node 22 or later.`). Leave it out when the skill is instructions only.

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

**Language: TypeScript, one stack for the whole repository.** `npx skills add` needs Node to install a skill, so Node is on every machine a skill reaches; the same toolchain as the author's other repositories (npm, strict `tsc`, Biome, Vitest) checks all of it.

- **Source in `src/`, never in `skills/`.** `npx skills add` copies the whole skill folder, so a source file there would ship. A script that ships is `src/skills/<skill>/scripts/<name>.mts`; `npm run build` compiles it with plain `tsc` (no bundler, so the output stays readable before anyone trusts it) to `skills/<skill>/scripts/<name>.mjs`. Commit the `.mjs`: installing runs no build. CI fails when it no longer matches its source.
- **Node 22 or later, built-in modules only** (`node:fs`, `node:child_process` ...). A shipped script has no `node_modules`; say `Requires Node 22 or later.` in `compatibility`.
- **Repository tools** (validate, install) are `tools/*.ts`, run with `tsx` through `npm run`. They may use the dev dependencies.
- When an existing tool does the job, call it with an exact version (`npx eslint@9.0.0`) in place of writing a script.
- Runs the same on Windows, macOS and Linux: `node:path`, UTF-8 everywhere, no shell commands, and `windowsHide: true` on every child process.

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

## Trying a skill

`npm run validate` checks the text on every change. Beyond that, a skill is tried by hand, not by a benchmark:

- **With and without.** Run the same real task twice, once with the skill and once without, on the same model. Keep the skill only when the run with it is clearly better; a command passes when the plain request leaves out steps the command promises.
- **More than once when it is close.** Agents vary from run to run; one good run proves little.
- **Read what the agent did,** not only its last message, and keep only the instructions that changed the result.
- **Note the result in one line** in the skill's `bench/<name>/README.md`. The pages there also keep the earlier benchmark's results, measured on Claude Haiku in a private repository that is no longer run.

## Before committing

```bash
npm run check
```

Commit messages say what changed and why, in a plain sentence. On Windows, start long runs hidden (`npm run hidden`), so no console window flashes up.

## Where these rules come from

[docs/research.md](docs/research.md): the findings, with their sources. When a rule here changes because of new work, change the finding there too.
