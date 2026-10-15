---
name: housekeeping
description: Runs a full housekeeping pass on a repository in a safe order, from what could be lost to code health, unused things and documents. Use when asked for housekeeping, to tidy or clean up a project, or to get it ready to hand over.
license: MIT
compatibility: Requires git and Node 22 or later.
disable-model-invocation: true
---

Leave the repository smaller, current and passing its own checks, without losing anything. Fix what is safe; propose anything that removes something that works, and leave that to the user.

## Steps

1. **Read the project's own rules first.** `AGENTS.md`, `CLAUDE.md`, `README.md`, `CONTRIBUTING.md`: how to run its checks, what must not be touched. They win over this file. Say in one line what the project is for; everything below is judged against it.

2. **What could be lost.** List what git does not hold (`git status --short --ignored`), inside the project and in the home folder, and search the tests, scripts and tools for the paths they write to. Run every test and tool on a copy of the project, with its home folder pointed somewhere empty, never in place. Anything that can write to the owner's data goes at the top of the report.

3. **What is in flight.** Uncommitted changes, stashes, branches and worktrees: say what each is before touching anything; someone's unfinished work looks like mess. For a large repository, `node scripts/survey.mjs <repo>` from this skill's folder lists them, with sizes (`--also <folder>` for data kept outside it, `--json` for JSON). It only reports.

4. **Is the code healthy.** Run the project's own lint, format, type and test commands; do not install a tool it does not use. Fix what they mark as safe. Then search for what no command reports: code nothing calls (a name used only by a string, a route table or a plugin loader is still used), tests that cannot fail, keys or secrets committed to the code.

5. **Is each thing still needed.** List what a user can reach, from the entry points: commands, routes and pages, menus, scheduled jobs, settings. For each, gather evidence of use, strongest first: a record of use (a usage or access log, analytics; say what period it covers), something that links to it, when it last changed and why. Passing tests show it works, not that it is used. Judge each `keep`, `remove` or `unknown`; propose, do not remove.

6. **Do the documents and comments still say what is true.** Use the `doc-upkeep` skill. Without it: fix stale lines where they are, never add a correction below them or a log of what was removed, and give each fact one home.

## What needs the user's yes

Data, caches and logs; branches and worktrees; stashes; big files in git; anything that works but looks unused; anything another person or session may be using. Give the size, the age and a suggestion.

## The report

One line first: is the repository in good shape, and do its checks pass. Then one table per step that found something, in the order above:

| What | Evidence | Proposal |
|---|---|---|

Say which steps ran and which were skipped, and why: a step skipped silently looks like a step that found nothing. End with the single decision most needed from the user.

## Gotchas

From real corrections:

- A test suite that saves to the default path overwrote the owner's only copy of their data; running it in place is how data is lost. Copy the project first.
- A page that is routed, linted and tested can still be unused: one survived a pass that looked only at files. Check that something reaches each one.
- A usage record only proves use inside its own period: a yearly job looks unused in a three-month log. Trying a command yourself adds it to the log; read the log first.
- "Might be useful later" is not evidence. Git keeps what is removed.
- A check, guard or retry that has never caught anything is a candidate too. Ask what it has caught, not what it might.
