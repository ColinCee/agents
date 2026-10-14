---
name: cleaning
description: Finds what a project no longer needs (features, commands, pages, docs, tests, stored data) by gathering evidence of use, and proposes what to remove. Use when asked what can go, whether something is still needed, or to cut a project down.
license: MIT
---

Answer one question about each thing in the project: is it still needed? Propose removals with the evidence. Remove nothing yourself: taking out something that works is the user's call.

A linter cannot do this. It finds code that nothing calls. It does not find a feature that is linted, typed, tested and working, and that nobody has used in months.

## Steps

1. **Say what the project is for**, in one sentence, from its `README.md` and its instruction files. Everything is judged against that sentence.

2. **Before running anything, find what could be lost.** List the files git does not hold (`git status --short --ignored`) and search the tests and scripts for the paths they write to. If a test or script can write to one of those files, do not run it; put it at the top of the report. A test that overwrites real data has caused this exact loss.

3. **List the things, from the entry points.** The command parser, the route table, the menu, the package scripts, the scheduled jobs. Then docs, tests, stored data, dependencies and config options. Listing from the file tree misses what a user can reach.

4. **Gather evidence of use for each thing.** Strongest first:
   - a record of use: an access log, a usage log, analytics, a last-run file. Say what period the record covers.
   - reach: is it linked from the menu, the docs or another thing that is used
   - history: when it last changed and why it was added (`git log --format='%ad %s' --date=short -- <path>`)
   - purpose: does it serve the sentence from step 1

   Passing tests and clean lint are evidence that it works, not that it is used. A thing referenced only by its own tests is unused.

5. **Judge each thing: keep, remove or unknown.** `keep` needs evidence as much as `remove` does. With no evidence either way, write `unknown` and say what would settle it.

6. **Check the tests the same way.** A test with no assertion, or one that cannot fail when the behaviour breaks, protects nothing. List it to fix or delete.

7. **Report.**

## The report

Conclusion first, in one line: how much can go. Then one table, the biggest saving first:

```markdown
| What | Evidence | Proposal |
|---|---|---|
| CSV export page | 0 of 2,140 requests in the access log (March to May); no link in the menu; last changed in January | Remove: `views/export.py`, its tests, the `csv` dependency |
| Search page | 610 requests in the same log; serves the stated purpose | Keep |
| `test_export_runs` | has no assertion | Fix or delete |
```

The rows above show the shape; the names are examples. Put anything from step 2 above the table. End with the single decision you most need from the user.

## Gotchas

- Do not run a tool that changes code or data to learn something (mutation testing, a migration, a clean-up script) before step 2 is done.
- A usage record only proves use inside its own period. A yearly job looks unused in a three-month log.
- Trying a command yourself adds it to the usage log. Read the log first.
- "Might be useful later" is not evidence. Git keeps what is removed.
