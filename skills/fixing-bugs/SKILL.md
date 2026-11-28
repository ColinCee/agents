---
name: fixing-bugs
description: Fixes a bug at its cause, reproduced first as a failing test, then the class of bug designed away or fixed everywhere. Use when fixing a bug, error, crash, regression, flaky test, or anything broken or wrong.
license: MIT
---

A bug is fixed when the run that showed it passes and nothing of its kind is left, not when one line changes. Step 1 decides whether there is a bug at all; size steps 3 and 4 to the bug, so a slip in one line needs no search of the codebase.

## Steps

1. **Reproduce it before fixing anything.** Write a test that fails on the exact symptom reported, run it, and see it fail for that reason, not on a typo or a missing import. Where no test can reach it (a page's look, a device, an outage), use the cheapest run that shows the symptom: a script, a request, a browser run, replaying the event that found it. Check it is the reported bug, not one next to it. If nothing makes it fail, it may not be a bug (a wrong expectation, the environment, already fixed): report the run and make no fix.
2. **Find the cause by runs.** Trace the bad value back to where it starts, not where it shows. Test one guess at a time, each with a result that would prove it wrong; a cause is a guess until a run confirms it. For a flaky failure, repeat the run until it fails often enough to study; rule out load or the machine by a run, never by assumption. A check over a limit (a speed budget, a size, a timeout) is the code growing: profile what grew and cut it, and raise the limit only with the user's OK.
3. **Name the class.** Say the rule the code broke (one place owns the layout, input is never trusted, a job runs once), not the line that broke it. Search for other places that break it: first a search that finds the known case, then widen it one step at a time.
4. **Look for a design that removes the class, then fix it.** Beyond a slip in one line, first ask whether doing the job another way makes the bug impossible rather than guarded against; for example, a value derived instead of two copies kept in step, a special case dropped, guessed timing replaced by an event. Otherwise fix the class in the shared code every case goes through, for every instance found. The test from step 1 stays. A lint rule or alert that would have caught it is proposed, not added unasked. When the right fix is too big for this change, ship the patch, call it a patch, and name the right fix as the next task.
5. **Prove it with the cheapest run that could prove it wrong:** the run from step 1 passes, and fails again with the fix undone. Then look where the bug showed (the page, the device, the log) and check every symptom reported is gone. After three fixes that each fail, stop and report what each one showed: the design is in question, not the next guess.

## Gotchas

From real corrections:

- Text overflowing its box was patched on three screens before the shared code that sized all their text was fixed.
- Delays were tuned job by job where the work needed a scheduler.
- Fixes changed the shared code yet kept the design that let the bug happen; the user called that tactical programming, and wanted the way of doing the job rethought.
- A fix was called done while the symptom still showed on the page the user was looking at.
- Flaky test failures were left "cause unknown" and blamed on machine load, with no run ruling that out.
- A speed test failing under load was fixed by raising its budget 35%; profiling then found two jobs redone every frame, and cutting them made the screen a third faster.
- An outage was fixed with nothing proposed to catch the next one, so the user found that one too.
