---
name: optimizing-performance
description: Runs the loop for making something faster (profile, change one thing, keep or revert) and reports before, now, each change's saving and where the time left goes. Use when asked to speed up, optimise or profile CI, builds, tests, pages or jobs.
license: MIT
---

Every change is a guess until a measurement keeps it. Each measurement follows `comparing-options`; this skill is the loop around it.

## Steps

1. **The measure, the load and the stop.** One number the user waits on, end to end (push to green check, not one step). The load it must be fast under, from history: how many run at once and how often. The stopping point, agreed before starting: the last few ideas each save under a set amount.
2. **Make the profile automatic.** Every run should give its own breakdown (traces or log timestamps, sent to the project's observability stack where it has one), so a profile is a query, not a one-off script. Timings come from the source (logs, spans, the service's API), never estimates.
3. **Baseline.** The median of a set number of runs on today's commit, with their spread. Re-take it whenever the host changes; one from hours earlier is stale.
4. **Profile.** Split the total into parts in the order they run. Mark each part as fixed (someone else's service, the same on any runner) or ours. In parallel work find the long pole: shortening anything else saves nothing.
5. **Ideas, ranked** by what they could save on the long pole. Try the cheapest probe first.
6. **One change at a time,** on its own branch, measured against the baseline as `comparing-options` says. Check from the log that it did what it should (exit codes, cache hits) before reading its time.
7. **Keep or revert.** Keep it when the saving is larger than the spread and nothing else got worse, at the real load too. Otherwise revert, and write it down as tried. Each kept change ships as its own pull request, so its saving stays its own. "Close" or "not worth it" from an estimate is a measurement still to make.
8. **Repeat from step 4** until the stopping point.

## The report

A page, not a list of pull requests, with one accent per meaning across it, each in a legend: grey for totals and others' share, green for saved, blue for time still ours, red only for worse. No number is shown twice:

1. One line: before → now, and the percentage.
2. A waterfall chart from before to now: one bar per kept change, labelled with the time saved and its percentage of the run before it. An axis break keeps small savings visible beside a big one.
3. A table of the changes: a one-line description with its pull request link, the saving, the run after it, and a total row.
4. A row-per-part waterfall of today's run, one labelled row per part, each starting where the last ended; then a table of why each part is unlikely to get faster, and the next ideas, ranked by what each could save.
5. What was tried and dropped, with its measured result.
6. A note: how many runs each time is the median of, and how much a single run varies. An estimate is labelled as one and never sets a headline.

## Gotchas

From real corrections:

- After CI went from 60 s to 26 s, the report listed the merged pull requests; Colin had to ask what was before and now, where the rest of the time went and what could cut it.
- Tuning for one job at a time nearly missed the real load: two days of runner history showed one job running 81% of the busy time and two jobs 18%.
- Ideas that looked sure lost when measured: fewer test workers (9.4 s against 8.9 s), work stealing, and merging two steps (0.45 s against 0.44 s).
- A timing run in WSL used a virtual environment that pointed back at the Windows one, so it measured the wrong setup.
