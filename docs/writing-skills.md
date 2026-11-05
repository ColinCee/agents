# Writing a skill

How to add, write and change a skill in this repository. `npm run validate` checks, among others, the frontmatter fields and limits, `license: MIT`, the name and folder, `Use when` in the description, the README listing, links, that every file is named in `SKILL.md`, body length, install steps, script imports and `--help`; this page holds the rest. Repository layout and checks: [AGENTS.md](../AGENTS.md).

## What earns a place

Fewer skills is better. Every installed skill's description costs context, a loaded skill costs its whole body, a skill can make an agent worse (in published tests about one task in five did worse with one, and a skill that helped one model hurt another), and how several skills interact is unknown. So a skill is added only when all six are true, and deleted when it stops earning its place:

0. **No good one exists already.** Search [skills.sh](https://skills.sh) first. A skill of someone else's that does the job goes in the list in `README.md`, with its install command, and is not copied here.
1. **It came from real work.** The same steps or the same corrections turned up in at least three sessions. A skill written from general knowledge says what the agent already knows.
2. **The agent does worse without it.** Run the task with no skill first. If the result is already good, there is nothing to add. What "worse" means depends on the kind of skill:
   - A **fix** is loaded by the agent when its description matches, and stops a mistake (`safeguarding`). Worse: the agent makes the mistake.
   - A **command** is asked for by name (`housekeeping`), and stands for a whole process the user would otherwise type out. It carries `disable-model-invocation: true`, so it loads only when named and its description costs nothing otherwise; most skills here are commands. Worse: the same words without the skill leave out steps the process promises, or do them differently from run to run.
3. **It is one job.** Like a function: narrow enough that its description says exactly when to use it, wide enough that one task does not need three skills.
4. **It is generic.** Nothing in it depends on the author's projects, machine, accounts or one agent's tools. What differs per project is read from that project (its `AGENTS.md`, `README.md`, config), not written into the skill.
5. **It was tried.** The same real task, run with the skill and without it, comes out clearly better with it. How: [AGENTS.md](../AGENTS.md), Trying a skill.

## Skill folder

```
skills/<name>/
  SKILL.md        required
  scripts/        code the agent runs
  references/     text the agent reads only when SKILL.md says to
  assets/         templates and other files used in the output
```

## SKILL.md

**Frontmatter.** Only the fields of the specification, plus `disable-model-invocation: true` on a command (read by Claude Code; other agents skip it). Each value on one line, because some agents read frontmatter with a simple parser.

- `name` says the activity (`tidying`), not `helper` or `utils`.
- `description`: what the skill does, then `Use when ...` with the words a user would really say, in the third person. Aim for 250 characters or fewer. This is the only text the agent sees when deciding to load the skill. In one large test agents loaded an installed skill on only 41% of the tasks that needed it, and the usual cause was the description.
- `compatibility`: only what must be on the machine (`Requires git and Node 22 or later.`). Leave it out when the skill is instructions only.

**Body.** Shorter is better: it is all loaded whenever the skill is used.

- Write only what the agent would get wrong without being told. Do not explain what it already knows.
- Each rule names the thing it is about: a command, a file, a flag, a word in the output. Rules that name something are followed; general advice mostly is not. A rule that names nothing is a candidate to delete.
- Give the reason in one clause. An agent that knows the reason handles the case the rule did not foresee; capitals and `MUST` do not do that.
- Say which parts are binding and which are examples. The most common way a skill breaks a task is the agent treating an example, a template or a default as a requirement.
- Do not tell the agent where to write its output or what to install unless that is the skill's job. The user's task decides those.
- Ask for checks in proportion to the change. A skill that orders every check on every run makes small tasks slow, and that is the most common way a skill wastes time.
- Teach the method, not one answer. Steps that work for any project of the kind.
- One default, not a list of choices. Name another way only with the case it is for.
- Be exact where a mistake is costly (the command to run, what must not be deleted) and loose where judgement is better.
- Keep a list of gotchas: the facts that are not what a careful agent would guess. When the skill fails in use, the correction goes there.
- For output with a fixed shape, show a template.
- No dates or versions that will go stale.
- Name no agent's own tools: say what to do ("search the code", "ask the user"). Validate knows only some tool names.
- Paths are relative to the skill folder and use forward slashes.
- Move text needed only sometimes to `references/`, and say in `SKILL.md` when to read it.

## Scripts

Check first for an existing tool that does the job; write a script only when none does, for work that is the same every time: counting, parsing, checking, surveying. Judgement stays in `SKILL.md`. A script costs no context until its output is read, and it gives the same answer on every run.

TypeScript, one stack for the whole repository: `npx skills add` needs Node to install a skill, so Node is on every machine a skill reaches. Where the source goes and how it is built: [AGENTS.md](../AGENTS.md), Layout. The build uses no bundler, so the output stays readable before anyone trusts it.

- When an existing tool does the job, call it with an exact version (`npx eslint@9.0.0`) in place of writing a script.
- Runs the same on Windows, macOS and Linux: `node:path`, UTF-8 everywhere, no shell commands, and `windowsHide: true` on every child process.
- `--help` is short: what it does, each flag, the exit codes. That is how the agent learns the script.
- Results go to stdout, with `--json` for a form a program can read. Progress and warnings go to stderr.
- Errors say what was wrong, what was expected and what to try.
- Output has a limit. A long list is cut with a count of what was left out.
- Safe to run twice.
- Every number in the code that is a choice has a comment saying why that number.

## Safety

Installing a skill lets its scripts run on someone's machine, with their files. Scripts report by default ([AGENTS.md](../AGENTS.md), Safety), and:

- No network use unless `compatibility` says so and the skill is about that.
- Never read secrets, sign-in files or keys.
- Never download and run code. No `curl | sh`.
