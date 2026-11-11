---
name: writing-comments
description: Keeps code comments few and true, saying only why and never what the code does or its history. Use when writing or changing code or its comments.
license: MIT
---

Every comment is a promise that has to be kept true: make each one true, and add one only when there is no way around it.

Comments never say what code does, only why, and only where the why is not plain. Folder structure, surrounding code, entry points, names and abstractions make most comments unnecessary.

- **Make the code say it first.** A clearer name, a smaller function or a named constant beats a comment.
- **A comment says why**: a constraint from outside the code or a trap a reader would fall into, in a line.
- **No history.** No dates, issue or PR numbers, incidents or "used to": git keeps them.
- **Point, do not repeat.** A quirk explained in one place gets a one-line reference from everywhere it matters ("see `parse.py`, `legacy_dates`"), not a second explanation. How a part fits the system is the architecture overview's: point to its section (`docs/architecture.md#alerts`), by heading, not line.
- **Code kept unused on purpose** carries a one-line note at both ends saying why and pointing to the other end; without it, the next tidy-up deletes it.
- **When code changes, its comments change in the same edit.** A comment that no longer matches the code is worse than none.
