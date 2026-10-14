---
name: tidying
description: Tidies a git repository's code and documents: fixes lint, removes code nothing references, corrects stale docs, and lists old branches and data for the user's yes. Use when asked to tidy code, fix lint, or check the docs still match.
license: MIT
compatibility: Requires git and Python 3.11 or later.
---

Leave the repository smaller, current and passing its own checks. Fix what is safe. Ask before anything that deletes.

This is about the health of what is there. Whether a working feature is still needed is a different question, and a removal of that kind is the user's call.

## The one rule

**Never delete data, branches, worktrees or files outside the repository without the user's yes.** List them with their size and a suggestion, and wait. Changes to tracked code and documents are safe to make, because git can undo them.

## Steps

1. **Read the project's own rules first.** `AGENTS.md`, `CLAUDE.md`, `README.md`, `CONTRIBUTING.md`: how to run its tests and lint, what its documents are, what must not be touched. They win over this file.

2. **Survey.** Run the script, from this skill's folder:

   ```
   python scripts/survey.py <repo>
   ```

   Add `--also <folder>` for each data, cache or log folder the project keeps outside the repository (its documents or config will name them). `--json` gives the same as JSON. The script only reports.

3. **Run the project's own checks.** Lint, format check, type check, tests: the ones the project declares (`pyproject.toml`, `package.json`, a `Makefile`, CI config). Do not install a tool the project does not already use. If a check cannot run, say so in the report instead of skipping it quietly.

4. **Look for what nothing uses.** Functions, constants, files, dependencies, config keys and test fixtures with no reference left. Check each one by searching before removing it: a name used only by a string, a route table or a plugin loader is still used.

5. **Read the documents against the code.** Numbers (test counts, sizes), file paths, command names, "next steps" that are done, things described that were since removed. Correct them in place. Do not add new documents. Cut what a level above already says: a project document need not repeat the project's `AGENTS.md`, and that need not repeat the user's own instructions. A rule found in two places belongs in the higher one.

6. **Fix what is safe**, in small commits if the project commits as it goes:
   - lint and format fixes the tool marks as safe
   - unused code confirmed in step 4
   - stale lines in documents
   - then run the tests again

7. **Report.** Lead with what was done, then what needs a decision.

## What needs the user's yes

| Found | Say |
|---|---|
| Old data, cache, log or backup files | Size, age, what they are, whether they can be made again |
| Branches with nothing the default branch lacks, or whose remote is gone | Name and age |
| Worktrees other than the main one | Path, and whether it holds uncommitted work |
| Stashes | How many, and the newest one's date |
| Big files tracked by git | Size, and whether they belong in the repository |
| Lint fixes the tool marks as unsafe | What would change |
| Anything another person or session may still be using | Whose it looks like |

## The report

Short, and in this order:

1. One line: is the repository in good shape now, and do its checks pass.
2. A table of what was cleaned.
3. A table of what needs a yes: what, size, suggestion.
4. Any check that could not be run, and why.

## Do not

- Rewrite working code for style alone.
- Change behaviour. Housekeeping that makes a test fail is undone, not patched.
- Delete something because it looks old. Old and unused are different things.
- Touch secrets, sign-in files or anything the project's rules mark as off limits.

## Gotchas

From real corrections:

- Start by listing the uncommitted changes and saying what each one is; someone's unfinished work looks like mess.
- A test that still passes when the behaviour it names is broken protects nothing. List it to fix.
- A page, command or setting that is linted, typed and tested can still be unused. Whether it is needed is the `cleaning` skill's question; here, only note it.
