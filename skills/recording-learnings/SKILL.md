---
name: recording-learnings
description: Puts what an agent learns in its one home in git (user rules, AGENTS.md, a skill, a decision record, notes) and keeps rule files short. Use when writing down a rule, preference, lesson or decision, or editing AGENTS.md, a skill or an ADR.
license: MIT
---

What an agent learns goes in git, where every machine gets it, never in Claude Code's auto memory.

## Homes

| Learned | Home |
|---|---|
| A rule for every project | The user's own instructions, in the repository they are installed from |
| A rule for one project, or a trap in a skill | Its `AGENTS.md` or that skill (see Agent rules) |
| A comparison that was run, and what lost | A decision record (see Decision records) |
| Why one piece of code is the way it is | A comment there, pointing to the overview section it serves (`writing-comments`) |
| A private fact about the user or their machines | Their private notes, never a public repository |
| Findings to keep, a dropped idea | The project's document for it, made under `docs/` if there is none |
| Status, open questions, next steps | The issue or pull request (`updating-docs`) |

## Agent rules

`AGENTS.md` (or `CLAUDE.md`) is read on every turn, so each line costs every task. Keep it short, and never let it grow one fix at a time.

- It holds a line on what the project is, one short checks command, a table of when to read which skill or document, and only the rules every change needs. The user's own always-loaded rules work the same way: a line goes there only when it holds for every task in every session; a procedure for one kind of work is a skill, with a row in their table.
- A rule for one kind of work goes in a project skill (for Claude Code, `.claude/skills/<name>/SKILL.md`) or a document, with a row in that table.
- Each rule in the user's own always-loaded rules is one short sentence, as short as possible; detail goes in a skill.
- A rule says what to do: no people's names, no dates of decisions, no history, and a reason only when it changes what an agent does. Git keeps the rest.
- A practice ships with a CI check over every instance.
- Fix a skill's step that failed in that skill, or say how for someone else's; fix what slowed or misled you now if small, else as its own task.
- Adding a rule condenses the file: merge it with any rule it overlaps, and move what no longer applies to every change into a skill or document. Delete only what is wrong.

## Decision records

A decision record (ADR) keeps only what code cannot: options that lost, so no one runs the comparison again, and the traps. A current design goes in the architecture overview (`updating-docs`).

- Write or keep one only when an agent would likely propose a loser again, rechecking would take hours of runs or rests on the user's taste, and code and tests cannot show why; otherwise delete it, its traps moved into a comment in the code they govern. Agents never search pull requests, so a record never lives in one.
- Where: `docs/adr/<area>.md`, never numbered, so a deletion renumbers nothing, in the repository that owns it. One across repositories lives with the main system; the rest link to it.
- Shape: one line on what was chosen, then "Lost, and why" (each option that lost, with the number that proves it) and "Traps" (what the code cannot show). No status, migration steps or history, and no timings or tables the code or tests hold. Evidence longer than a line goes in `docs/adr/<area>/`; raw data and harnesses stay out of the repository.
- Editing: new evidence or a changed choice rewrites that area's record in place, never a new one beside it; records split across one area merge into one.

## Gotchas

- One monitoring decision grew three records, each superseding the last, so no single page said what stood or why.
- A game's records held status, history and timing tables; two were deleted, a speed test and another record already holding their numbers.
- Agents wrote a record for every choice; two of one repository's five described a design nobody had compared, and were deleted as waste. No comparison run, no record.
