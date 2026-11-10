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
| A decision and why | A decision record (see Decision records) |
| A private fact about the user or their machines | Their private notes, never a public repository |
| Status, findings, a dropped idea | The project's document for it, made under `docs/` if there is none |

## Agent rules

`AGENTS.md` (or `CLAUDE.md`) is read on every turn, so each line costs every task. Keep it short, and never let it grow one fix at a time.

- It holds a line on what the project is, one short checks command, a table of when to read which skill or document, and only the rules every change needs.
- A rule for one kind of work goes in a project skill (for Claude Code, `.claude/skills/<name>/SKILL.md`) or a document, with a row in that table.
- A rule says what to do: no people's names, no dates of decisions, no history, and a reason only when it changes what an agent does. Git keeps the rest.
- Adding a rule condenses the file: merge it with any rule it overlaps, and move what no longer applies to every change into a skill or document. Delete only what is wrong.

## Decision records

A decision record (ADR) keeps what was decided and why, as it stood then; every other document is kept current.

- Where: `docs/adr/NNNN-short-title.md` in the repository that owns the system the decision changes, numbered from 0001. A decision across repositories lives with the main system; the others link to it. Personal notes hold general lessons that link to it, never the record.
- Shape: one page under Status, Context, Decision and Consequences. Evidence (method, results, charts) goes in `docs/adr/NNNN-short-title/` beside it; raw data and test harnesses stay out of the repository. The plan to carry it out goes in issues.
- Status: proposed, accepted, rejected, deprecated, or "Superseded by NNNN" (the new record says "Supersedes NNNN").
- Editing: a proposed record changes freely. Once past proposed (accepted, deprecated, superseded), it and its evidence folder change only in the Status line; a changed decision, or new evidence, is a new record that supersedes it. Facts that move (today's figures, how to run it) live in the operational documents the record links to.

## Gotchas

- Agents reworded accepted decision records to match later changes, so a record no longer said what had been decided or why. An accepted record changes only in its Status line.
