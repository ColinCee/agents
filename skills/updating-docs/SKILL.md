---
name: updating-docs
description: Keeps docs and posts true and few, so only what must be kept goes in git, with stale lines fixed in place, one home per fact and numbers checked. Use when code changes that a doc describes, or writing a doc, runbook, example file or post.
license: MIT
---

Every document is a promise that has to be kept true: make each one true and the set of them smaller than before. Knowing what to cut or move counts as much as what to write.

## When to write one

Only what must be kept goes in git: a line earns its place if a future reader would do the wrong thing without it and the code cannot say it. The rest lives where its work happens. Write it in the pull request that changes the behaviour, never ahead of it.

A project's whole set, by default:

| Document | Holds | Size, a starting point |
|---|---|---|
| `README.md` | What it is, a person's one start command, links | About 300 words |
| `AGENTS.md` | The index an agent reads every turn (`recording-learnings`) | About 300 words |
| `docs/architecture.md` | The overview: one hand-drawn SVG of how the parts connect, then a short section per part, each the one home the code's comments point to | About 1,000 words; a part that outgrows it gets its own page, linked from it |
| A recovery page, if any | Only hand steps no script can do, when the automation is gone (restore, rebuild) | One screen per task |
| Decision records | Comparisons that were run (`recording-learnings`) | One page each |

Anything else needs a reason the pull request states. A size cap, where the project keeps one, only goes down: growth cuts the same amount elsewhere first.

- Still being discussed, or a to-do list for work about to start: the issue, the pull request or the conversation holds it.
- One-time steps (a migration, a switch-over): a checklist in the pull request's description.
- Steps an agent or a script can do are a script or the agent's job, not a runbook.
- No example file that repeats a list the code already holds, such as `.example` secret files when the deploy script renders the real ones and names every key.

## Documents

1. **Find what changed.** `git log` since each document was last touched, and read those commits. Each one is a candidate stale line.
2. **Check each claim against the code**, not against the document's own wording: numbers (count tests by collecting them, for example `pytest --collect-only -q`), paths, commands, names, lists of options, routes. A claim about something removed is stale; a line that restates what code does is cut to a pointer (step 5), not corrected.
   Numbers come from their results document, not from a message about them. When a source number changes, list every number in the piece (figures, captions, ratios, titles, summaries, linked documents) and check each one.
3. **Fix the stale line where it is**, so the document reads as if it had always been right: never an "Update:", "Note:" or dated line below the old one. If the line restates what code does, step 5 says what stays. Never change what code does here: if the document is right and the code is wrong, say so.
4. **Delete what describes removed things**, with no "Removed", "Changes" or history entry unless the project keeps a changelog. Git already records what was removed and when; the reader needs what is there now.
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
- **One copyable command per job.**
- **Plain words.** No selling ("powerful", "simple") and no hedging. No bold lead-ins on sentences or bullets, no em dashes, and titles of a few words.

## The report

When asked to update documents, end with:

| Where | Was | Now |
|---|---|---|

Then one line on what was left as it is and why.

## Gotchas

From real corrections:

- Agents' docs in one repository reached about 10,000 words in twelve files, four of them runbooks, and had to be cut back to the set above.

- An appended correction ("Update (Sep 30): now 14 tests") is how documents grow and contradict themselves. The fix is to rewrite the first line and delete the second.
- A rule copied word for word into three files was updated in one and left stale in two. Copies drift; pointers do not.
- A design doc grew to ten sections of tables and read as a wall. The user wanted the picture and five lines first, with the detail one click away.
- A README was rewritten twice because the content was right but the order was not: an introduction first, the main table halfway down, a heading naming a tool nobody had explained. Put the most-used table first and say what each thing is where it appears.
- An architecture diagram in mermaid grew to twenty boxes and crossing arrows; the user called it a mess. Redrawn by hand in three layers with nine arrows, it read at a glance.
- A results document's summary line went stale twice while its table was right, and a post quoting it updated one chart and left the others, the captions and the title on the old numbers.
