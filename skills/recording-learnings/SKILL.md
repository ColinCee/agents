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

- It holds a line on what the project is, one short checks command, a table of when to read which skill or document, and only the rules every change needs.
- A rule for one kind of work goes in a project skill (for Claude Code, `.claude/skills/<name>/SKILL.md`) or a document, with a row in that table.
- A rule says what to do: no people's names, no dates of decisions, no history, and a reason only when it changes what an agent does. Git keeps the rest.
- Adding a rule condenses the file: merge it with any rule it overlaps, and move what no longer applies to every change into a skill or document. Delete only what is wrong.

## Decision records

A decision record (ADR) is only for a decision where options were tried or measured: it keeps what lost and why, so no one runs the comparison again. A choice nobody weighed gets a comment in the code, or nothing; a current design is described by the architecture overview (`updating-docs`), not by a record.

- Where: `docs/adr/NNNN-area.md`, named for the system or area, not the choice, in the repository that owns the system the decision changes, numbered from 0001. A decision across repositories lives with the main system; the others link to it. Personal notes hold general lessons that link to it, never the record.
- Shape: one page under Status, Context, Decision and Consequences. Evidence (method, results, charts) goes in `docs/adr/NNNN-area/` beside it; raw data and test harnesses stay out of the repository. The plan to carry it out goes in issues.
- Status: proposed or accepted; deprecated once the system is gone.
- Editing: a changed decision, or new evidence, rewrites that area's record and evidence folder in place, never a new record beside it; git keeps the old versions. Records already split across one area merge into one, and the rest are deleted. The record's Context keeps why earlier options were dropped. Facts that move (today's figures, how to run it) live in the operational documents the record links to.

## Gotchas

- One monitoring decision grew three records, each superseding the last, so no single page said what stood or why. Fold new findings into the one record for that area.
- Agents wrote a record for every choice; two of one repository's five described a design nobody had compared, and were deleted as waste. No comparison run, no record.
