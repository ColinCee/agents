---
name: optimizing-performance
description: Runs the loop for making something faster (profile, change one thing, keep or revert) and reports before, now, each change's saving and where the time left goes. Use when asked to speed up, optimise or profile CI, builds, tests or jobs.
license: MIT
---

Every change is a guess until a measurement keeps it. Each measurement follows `comparing-options`; this skill is the loop around it.

## Steps

1. **The measure and the load.** One number, end to end (push to the result the user waits on, such as a green check or a deploy), and the load it must be fast under, from history: how many run at once and how often.
2. **The stop.** The last three ideas tried each save less than the baseline's spread (its slowest run minus its fastest), unless the user set another.
3. **Make the profile automatic.** Every run gives its own breakdown (traces or log timestamps, in the project's observability stack where it has one), so a profile is a query. Timings come from the source, never estimates.
4. **Baseline,** with nothing else of yours running on the host: the median of at least ten runs on today's commit, and their spread. Re-take it whenever the host changes.
5. **Profile.** Split the total into parts in the order they run. Call a part fixed (someone else's, the same anywhere) only after a run elsewhere shows it. In parallel work find the long pole; when every core is busy, running more at once cannot help. Ask why it got slow: the cause is often the best idea.
6. **Ideas, in this order:** skip the work, then cache it, then run it in parallel, then make it faster. Rank by what each could save on the long pole; probe the cheapest first.
7. **One change at a time,** measured as `comparing-options` says: interleaved, at least ten paired rounds, not three, when the effect is under the spread. A change that cannot be interleaved (a host setting) gets ten runs per state, on, off, on. Check from the log that it worked before reading its time.
8. **Keep or revert.** Keep it when the saving beats the spread and nothing else got worse, at the real load too; otherwise revert and write it down with its numbers. Keep each change in its own commit so its saving stays its own. "Not worth it" from an estimate is a measurement still to make, and nothing is built on one.
9. **Repeat from step 5** until the stop. Then measure the baseline commit against the final one, interleaved: that run gives the report's before and now, and the savings must add up to it.

## The report

A page, not a list of pull requests, that answers, with no number shown twice:

- Before, now and the change, from the final interleaved run, with its run count.
- What each change saved, as time and as a percentage of the run before it, linked to its pull request, and how much the savings fail to add up to the total.
- Where the time left goes, part by part, what is fixed and what is ours, and why.
- The next ideas, ranked, each marked measured or estimated.
- What was tried and dropped, with its numbers.

One accent per meaning, each in a legend: grey for totals and others' share, green for saved, blue for time still ours, red only for worse. A waterfall answers the first two well.

## Gotchas

From real corrections:

- After CI went from 60 s to 26 s, the report listed the merged pull requests; Colin had to ask what was before and now, where the rest of the time went and what could cut it.
- Tuning for one job at a time nearly missed the real load: two days of runner history showed one job running 81% of the busy time and two jobs 18%.
- Seven savings, each against its own drifting baseline, claimed 42 s together; the runs showed 41 s. One, a host setting, was measured only before then after.
- A pull request was built and reviewed on an estimated 0.3 s saving; measured, it saved 0.01 s.
- A timing run in WSL used a virtual environment that pointed back at the Windows one, so it measured the wrong setup.
