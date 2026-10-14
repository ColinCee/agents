---
name: doc-upkeep
description: Keeps documents and code comments true and few: stale lines fixed in place, one home per fact, comments that say why, not what. Use when code changes that a document or comment describes, when writing either, or to update the docs.
license: MIT
---

Every document and comment is a promise that has to be kept true. Make each one true, and the set of them smaller than before. Add one only when there is no way around it.

## Documents

1. **Find what changed.** `git log` since each document was last touched, and read those commits. Each one is a candidate stale line.
2. **Check each claim against the code**, not against the document's own wording: numbers (count tests by collecting them, for example `pytest --collect-only -q`), paths, commands, names, lists of options, routes. A claim about something removed is stale.
3. **Replace the stale line where it is.** The document should read as if it had always been right.
4. **Delete what describes removed things.** Git already records what was removed and when; the reader needs what is there now.
5. **Give each fact one home.** When the same text is in more than one file, keep it in the one it belongs to and turn the others into a pointer ("Checks: see `AGENTS.md`"). Rules for working on the project belong in `AGENTS.md`; how to use it, in `README.md`; anything the user's own instructions already say needs no copy in the project.
6. **Compare sizes.** The documents together should be no longer than before, unless a new feature needed a new section. Check with `git diff --stat`.

## Comments

- **Make the code say it first.** A clearer name, a smaller function or a named constant beats a comment. Delete a comment that repeats what the code says.
- **A comment says why**: the reason for a choice, a constraint from outside the code, the case that broke before. Never what the next line does.
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
