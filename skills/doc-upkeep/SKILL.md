---
name: doc-upkeep
description: Brings a project's documents back in line with its code and leaves them shorter: stale lines replaced in place, one home per fact, no log of what was removed. Use when asked to update the docs, check the README is current, or after code changes.
license: MIT
---

Make every document true, and the set of them shorter than before. The result is judged by what a reader finds, not by how much was written.

## Steps

1. **Find what changed.** `git log` since each document was last touched, and read those commits. Each one is a candidate stale line.
2. **Check each claim against the code**, not against the document's own wording: numbers (count tests by collecting them, for example `pytest --collect-only -q`), paths, commands, names, lists of options, routes. A claim about something removed is stale.
3. **Replace the stale line where it is.** The document should read as if it had always been right.
4. **Delete what describes removed things.** Git already records what was removed and when; the reader needs what is there now.
5. **Give each fact one home.** When the same text is in more than one file, keep it in the one it belongs to and turn the others into a pointer ("Checks: see `AGENTS.md`"). Rules for working on the project belong in `AGENTS.md`; how to use it, in `README.md`; anything the user's own instructions already say needs no copy in the project.
6. **Compare sizes.** The documents together should be no longer than before, unless a new feature needed a new section. Check with `git diff --stat`.

## Do not

- Add "Update:", "Note:", "As of …" or a dated line below an old one. Fix the old one.
- Add an entry to a "Removed", "Changes" or history section, unless the project's rules say it keeps a changelog.
- Change code. If a document is right and the code is wrong, say so in the report.
- Remove a note that explains code kept unused on purpose. It is the other end of a cross-reference.

## The report

| Where | Was | Now |
|---|---|---|

Then one line on what was left as it is and why.

## Gotchas

From real corrections:

- An appended correction ("Update (Sep 30): now 14 tests") is how documents grow and contradict themselves. The fix is to rewrite the first line and delete the second.
- A rule copied word for word into three files was updated in one and left stale in two. Copies drift; pointers do not.
- A record of what was deleted, when and how big, is something no later reader acts on. Leave it out.
