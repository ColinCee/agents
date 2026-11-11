---
name: updating-docs
description: Keeps docs and posts true and few, with stale lines fixed in place, what code does left in the code, one home per fact, numbers checked against their source. Use when code changes that a doc describes, or when writing or updating a doc or post.
license: MIT
---

Every document is a promise that has to be kept true: make each one true, the set of them smaller than before, and add one only when there is no way around it.

## Documents

1. **Find what changed.** `git log` since each document was last touched, and read those commits. Each one is a candidate stale line.
2. **Check each claim against the code**, not against the document's own wording: numbers (count tests by collecting them, for example `pytest --collect-only -q`), paths, commands, names, lists of options, routes. A claim about something removed is stale; a line that restates what code does is cut to a pointer (step 5), not corrected.
   Numbers come from their results document, not from a message about them. When a source number changes, list every number in the piece (figures, captions, ratios, titles, summaries, linked documents) and check each one.
3. **Fix the stale line where it is**, so the document reads as if it had always been right (an accepted decision record is the exception: it changes only in its Status line, see `recording-learnings`). If the line restates what code does, step 5 says what stays.
4. **Delete what describes removed things.** Git already records what was removed and when; the reader needs what is there now.
5. **Give each fact one home.** What code does inside (a flag, a limit, a condition, a module's steps) lives in the code: the document names the file, function or constant instead. A document keeps only why, where things run and how they connect, traps, steps a person follows, measured results and the user's standing rules; a list a reader picks from stays a table, its details in the code. Text in two files stays in the one it belongs to, and the other points to it ("Checks: see `AGENTS.md`"): rules every change needs in `AGENTS.md` (kept short: `recording-learnings`), what it is and how to start it in `README.md`, and no copy of what the user's own instructions already say.
6. **Compare sizes.** The documents together should be no longer than before, unless a new feature needed a new section. Check with `git diff --stat`.

## Shape

Readers scan; shape every document for that. These are the defaults; the project's own documents win where they differ.

- **One line on what it is, at the top.** No introduction paragraph.
- **What readers use most comes first;** the reasons why come last.
- **Long documents disclose in layers.** A picture and a few lines first; detail behind tabs, collapsible sections or links, kept for whoever needs it.
- **Draw diagrams by hand.** An SVG laid out on a grid, in layers where the parts have levels, saved beside the document and linked from it, with only the arrows the point turns on.
- **Items of the same shape go in a table** (name, what it does, how to get it). Steps are a numbered list; anything else is bullets. Prose only for a reason that needs a sentence.
- **Headings are short nouns** ("Skills", "Tools"), and no heading stands over a single unexplained item.
- **A README is for people.** What it does, a picture of how the parts fit, a person's one start command, and links to the docs; for settings and limits, point to the code.
- **Link to details; do not retell them.** A README points to the file that explains.
- **One copyable command per job.**
- **Plain words.** No selling ("powerful", "simple") and no hedging. No bold lead-ins on sentences or bullets, no em dashes, and titles of a few words.

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
