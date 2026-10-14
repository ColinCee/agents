---
name: safeguarding
description: Before running anything that changes code or data (tests, mutation testing, migrations, clean-up scripts), finds what could be lost and makes sure it can't be. Use when about to run a project's tests or tools, or someone else's script.
license: MIT
---

Before running anything, find what it could destroy, and make that impossible. Data that git does not hold, and that has no backup, is gone for good once overwritten, and agents usually find out the next morning.

## Steps

1. **Find the data that matters and is not in git.** Look outside the project as well as in it:
   - files git ignores or does not track (`git status --short --ignored`)
   - paths the code reads or writes by default: search for `Path.home()`, `~`, `HOME`, `APPDATA`, `XDG_`, environment variables that name a folder, and default arguments such as `path or DEFAULT_FILE`
   - what the README and config say is kept where

   For each one, note whether a copy exists anywhere.

2. **Find out what the thing you are about to run touches.** Read the test set-up, the script or the tool before running it. Ask: does anything here write to a default path? Does it change files in place and restore them afterwards? Can a failure leave them changed?

3. **Make the harm impossible before running.** In order of preference:
   - point it somewhere private: for tests, an automatic fixture that gives every test its own home folder and sets the variables that name data folders; for a script, a copy of the input
   - run it on a copy of the project, with `HOME` and those variables pointed at an empty folder
   - back the data up, and say where the backup is

   Copying the project alone does not protect data that lives in the home folder.

4. **For a script that deletes or moves files, run its dry run first and check every line** against what the user said to keep. Do not run it for real when the list holds anything that should stay. Delete outright rather than moving to a folder that gets emptied later.

5. **Report what could have been lost and what now protects it,** above anything else in the report.

## Gotchas

- Mutation testing changes the code in place. One changed `or`, `if` or default can send every write to the real file; a test that still passes then hides it.
- A test that passes a temporary path is safe only while the code honours it. The fixture has to make the real location unreachable, not just unused.
- Restoring a file from memory after overwriting it is not the same as never touching it. Say it happened.
- An empty variable is not an unset one: `NAME=` can turn a data path into a relative one.
- Before rebuilding or overwriting a data set, confirm a copy exists outside the working folder, and say where.
- Delete originals only after the copy has been opened and read.
- In a folder that is not under git, run `git init` and commit before the first change, so a bad run can be undone.
