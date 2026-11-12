---
name: comparing-options
description: Decides between options from evidence, with one question, one baseline, a fair repeated comparison and how sure it is. Use when asked which option is better, whether a change helps, or to benchmark, measure or compare speed.
license: MIT
---

A decision is only as good as the comparison behind it. Follow the steps in order; write each one's answer in the report.

## Steps

1. **The question, in one line**, and the one thing that differs between the options. If you cannot say what is being compared, nobody can judge the result.
2. **What is already known, and what could change the pick.** Look for existing results, documents and sources first. A primary source (the project's own data, an official spec, a measurement) beats a summary of one. Say where each claim came from. If the evidence settles it, decide here. List the must-haves, daily use included (for example how an alert clears, what a login may do), and settle each from the docs or a probe of minutes before any long run: one that fails drops that option at no cost. Watch a probe through to the end, not only until it first works. When the choice is costly to undo, also run a slice of the real switch-over on each finalist (the real rules, queries, dashboards, logins and input path, unchanged) and count what breaks.
3. **The ground truth, and who made it.** Name the labels, answers or measurements the options will be scored against. Labels made by one of the options, or by a model, are not ground truth: they score agreement with whoever made them. When there is no ground truth, the answer is "not decidable yet": say what to label by hand and how many.
4. **A fair comparison.** Every option on the same inputs, the same commit and the same tools, interleaved in one run; a change only one side has is left out. Pick one baseline and use it in every figure that follows. Fix the number of cases and runs before looking at any result: stopping at the first win favours whichever is ahead by chance. Before timing anything, check the log shows the option working (exit codes, cache hits) and that every input source arrived, counted per source. Size it to the decision: when the choice is costly to undo, set a time budget for the whole decision first, and spend it first on what the pick hinges on. Screen every option side by side in minutes on a fast measure the total follows (a per-minute rate, a count), then run only the finalists longer; check slow totals such as bytes a day after the pick instead of waiting on them. A screen may speed input up to cut on what does not grow with load (wrong answers, crashes, missing features); rank anything that grows with load, such as memory, at the real rate on a smaller slice. Read each run's first result as it lands, shorten fixed waits, put a timeout on every step, and end a run as soon as it fails a check it has to pass. When the budget is spent, decide on what is known and name what is unproven.
5. **Repeat.** A model's answers change between runs; run each option at least three times and report the spread between runs.
6. **Score on everything, not on a filtered part.** Do not keep only cases chosen by something an option produced (its confidence, its own output, whether it finished): that filter is measured after the option acts and can favour any of them.
7. **Decide, and say how sure.** The winner, by how much, against the spread between runs, and what would change the answer (more labelled cases, a different kind of input).
8. **Optimising?** Each measurement here is one turn of the loop in `optimizing-performance`; follow it for the stopping point and the report.

## The report

One line first: the decision and the margin. Then:

| Option | Score (mean of N runs) | Spread | On what |
|---|---|---|---|

Then why any existing comparison disagrees, and how sure the answer is.

## Gotchas

From real corrections:

- An agent picked a default model without measuring the alternatives; asked "why that model?", it had no answer. Measure all candidates side by side before choosing.
- Labels a model drafted to save time looked like a test set; the model that drafted them won every comparison against them.
- Keeping only cases where a measure "looked reliable" decided a result once, and reversed it; the reliability was measured after the treatment.
- A comparison nobody could summarise in one line produced verdicts no one could use.
- One side of a speed comparison ran a newer commit with a faster type check; part of its "win" was the code change.
- Two timings looked normal while the thing under test was off: every run failed in under a second, and a cache disk was silently empty.
- A baseline reused from hours earlier varied by 15 s between runs.
- A store bake-off took 42 hours to pick. Trials first ran one after another, one spent 76 minutes in a step with no timeout, and a sped-up replay ranked one store 500 MB lighter where the real rate tied. A side-by-side screen, built 17 hours in, did the cutting; the last 20 hours tested what the pick hinged on least (memory, disk, crashes) while the must-haves it hinged on waited.
- That pick's tie-break, one program for everything, rested on one log alert firing and one admin login. After the pick, short probes found clears held back until the repeat interval, per-series alerts that never clear, lower-cased metric names and no read-only login: the switch-over needed two extra services. And in every scored round one store's collector had the wrong login, so it never got the host's own load.
