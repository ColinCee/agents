---
name: doc-upkeep
description: Keeps docs, posts and comments true, few and easy to scan, with stale lines fixed in place, one home per fact, numbers checked against their source. Use when code changes that a doc describes, or when writing or updating a doc, post or comment.
license: MIT
---

Every document and comment is a promise that has to be kept true. Make each one true, and the set of them smaller than before. Add one only when there is no way around it.

## Documents

1. **Find what changed.** `git log` since each document was last touched, and read those commits. Each one is a candidate stale line.
2. **Check each claim against the code**, not against the document's own wording: numbers (count tests by collecting them, for example `pytest --collect-only -q`), paths, commands, names, lists of options, routes. A claim about something removed is stale.
   Numbers come from their results document, not from a message about them. When a source number changes, list every number in the piece (figures, captions, ratios, titles, summaries, linked documents) and check each one.
3. **Replace the stale line where it is.** The document should read as if it had always been right.
4. **Delete what describes removed things.** Git already records what was removed and when; the reader needs what is there now.
5. **Give each fact one home.** When the same text is in more than one file, keep it in the one it belongs to and turn the others into a pointer ("Checks: see `AGENTS.md`"). Rules every change needs belong in `AGENTS.md` (see Agent rules); what it is and how to start it, in `README.md`, with commands and settings agents act on in a doc `AGENTS.md` points to; anything the user's own instructions already say needs no copy in the project.
6. **Compare sizes.** The documents together should be no longer than before, unless a new feature needed a new section. Check with `git diff --stat`.

## Shape

Readers scan; shape every document for that. These are the defaults; the project's own documents win where they differ.

- **One line on what it is, at the top.** No introduction paragraph.
- **What readers use most comes first;** the reasons why come last.
- **Long documents disclose in layers.** A picture and a few lines first; detail behind tabs, collapsible sections or links, kept for whoever needs it.
- **Draw diagrams by hand.** An SVG laid out on a grid, in layers where the parts have levels, saved beside the document and linked from it, with only the arrows the point turns on.
- **Items of the same shape go in a table** (name, what it does, how to get it). Steps are a numbered list; anything else is bullets. Prose only for a reason that needs a sentence.
- **Headings are short nouns** ("Skills", "Tools"), and no heading stands over a single unexplained item.
- **A README is for people.** What it does, a picture of how the parts fit, a person's one start command, and links to the docs; settings, paths and limits only agents act on go in a doc `AGENTS.md` points to.
- **Link to details; do not retell them.** A README points to the file that explains.
- **One copyable command per job.**
- **Plain words.** No selling ("powerful", "simple") and no hedging. No bold lead-ins on sentences or bullets, no em dashes, and titles of a few words.

## Agent rules

`AGENTS.md` (or `CLAUDE.md`) is read on every turn, so each line costs every task. Keep it short, and never let it grow one fix at a time.

- It holds a line on what the project is, one short checks command, a table of when to read which skill or document, and only the rules every change needs.
- A rule for one kind of work goes in a project skill (for Claude Code, `.claude/skills/<name>/SKILL.md`) or a document, with a row in that table.
- A rule says what to do: no people's names, no dates of decisions, no history, and a reason only when it changes what an agent does. Git keeps the rest.
- Adding a rule condenses the file: merge it with any rule it overlaps, and move what no longer applies to every change into a skill or document. Delete only what is wrong.

## Comments

Comments never say what code does, only why, and only where the why is not plain. Folder structure, surrounding code, entry points, names and abstractions make most comments unnecessary.

- **Make the code say it first.** A clearer name, a smaller function or a named constant beats a comment.
- **A comment says why**: a constraint from outside the code or a trap a reader would fall into, in a line.
- **No history.** No dates, issue or PR numbers, incidents or "used to": git keeps them.
- **Point, do not repeat.** A quirk explained in one place gets a one-line reference from everywhere it matters ("see `parse.py`, `legacy_dates`"), not a second explanation.
- **Code kept unused on purpose** carries a one-line note at both ends saying why and pointing to the other end; without it, the next tidy-up deletes it.
- **When code changes, its comments change in the same edit.** A comment that no longer matches the code is worse than none.

## Do not

- Add "Update:", "Note:", "As of …" or a dated line below an old one. Fix the old one.
- Add an entry to a "Removed", "Changes" or history section, unless the project's rules say it keeps a changelog.
- Change what code does while updating its documents or comments. If a document is right and the code is wrong, say so.

## The report

When asked to update documents, end with:

| Where | Was | Now |
|---|---|---|

Then one line on what was left as it is and why.

## Gotchas

From real corrections:

- An appended correction ("Update (Sep 30): now 14 tests") is how documents grow and contradict themselves. The fix is to rewrite the first line and delete the second.
- A rule copied word for word into three files was updated in one and left stale in two. Copies drift; pointers do not.
- A record of what was deleted, when and how big, is something no later reader acts on. Leave it out.
- A design doc grew to ten sections of tables and read as a wall. The user wanted the picture and five lines first, with the detail one click away.
- A README was rewritten twice because the content was right but the order was not: an introduction first, the main table halfway down, a heading naming a tool nobody had explained. Put the most-used table first and say what each thing is where it appears.
- An architecture diagram in mermaid grew to twenty boxes and crossing arrows; the user called it a mess. Redrawn by hand in three layers with nine arrows, it read at a glance.
- A results document's summary line went stale twice while its table was right, and a post quoting it updated one chart and left the others, the captions and the title on the old numbers.
