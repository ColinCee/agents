---
name: fixing-bugs
description: Fixes a bug at its cause, reproduced first as a failing test, then the class of bug named and every instance fixed the standard way. Use when fixing a bug, error, crash, regression, flaky test, or anything broken or wrong.
license: MIT
---

A bug is fixed when the run that showed it passes and nothing of its kind is left, not when one line changes. Do the steps in order; step 1 decides whether there is a bug at all.

## Steps

1. **Reproduce it before fixing anything.** Write a test that fails on the exact symptom reported, run it, and see it fail for that reason, not on a typo or a missing import. Where no test can reach it (a page's look, a device, an outage), use the cheapest run that shows the symptom: a script, a request, a browser run, replaying the event that found it. Check it is the reported bug, not one next to it. If nothing makes it fail, it may not be a bug (a wrong expectation, the environment, already fixed): report the run and stop, with no fix.
2. **Find the cause by runs.** Trace the bad value back to where it starts, not where it shows. Test one guess at a time, each with a result that would prove it wrong; a cause is a guess until a run confirms it. For a flaky failure, repeat the run until it fails often enough to study; rule out load or the machine by a run, never by assumption.
3. **Name the class.** Say the rule the code broke (one place owns the layout, input is never trusted, a job runs once), not the line that broke it. Search the code for other places that break the same rule: first a search that finds the known case, then widen it one step at a time. Ask what would have caught it sooner (a type, a lint rule, a test, an alert).
4. **Fix the class the standard way.** Use the usual fix for that class of bug, in the shared code every case goes through, for every instance found: one component instead of the same patch in three places, a scheduler instead of tuned delays, a type that cannot hold the bad state, a parameterised query. Add the check from step 3 so it cannot come back. When the proper fix is too big for this change, ship the patch, call it a patch, and name the cause-level fix as the next task.
5. **Prove it with the cheapest run that could prove it wrong.** The run from step 1 passes; undo the fix and watch the test fail, then put it back. Then check where the bug showed (the page, the device, the log), and that every symptom reported is gone. After three fixes that each fail, stop guessing and question the design with the user.

## Gotchas

From real corrections:

- Text overflowing its box was patched in three places before the shared code that laid them all out was fixed.
- Delays were tuned job by job where the work needed a scheduler.
- A fix was called done while the symptom still showed on the page the user was looking at.
- Flaky test failures were left "cause unknown" and blamed on machine load, with no run ruling that out.
- An outage was fixed with nothing added to catch the next one, so the user found that one too.
- A question about a fix ("do we need X?") was taken as a go-ahead, and a running system was changed before the cause was known.
