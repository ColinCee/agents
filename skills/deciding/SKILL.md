---
name: deciding
description: Decides between options from evidence, with one question, one baseline, a fair repeated comparison and how sure it is. Use when asked which option is better, whether a change helps, or to benchmark, measure or compare speed.
license: MIT
---

A decision is only as good as the comparison behind it. Follow the steps in order; write each one's answer in the report.

## Steps

1. **The question, in one line**, and the one thing that differs between the options. If you cannot say what is being compared, nobody can judge the result.
2. **What is already known, and what could change the pick.** Look for existing results, documents and sources first. A primary source (the project's own data, an official spec, a measurement) beats a summary of one. Say where each claim came from. If the evidence settles it, decide here. List the must-haves, daily use included (for example how an alert fires and clears, which rights a login can have, how names come out), and settle each from the docs or a probe of minutes before any long run: one that fails drops that option at no cost. When the choice is costly to undo, the probe is a slice of the real move on each option: the real rules, queries, one dashboard, a login per kind of user and the real input path, unchanged, counting what breaks. Then write, for each planned run, which result would change the pick, and do not start a run that none could.
3. **The ground truth, and who made it.** Name the labels, answers or measurements the options will be scored against. Labels made by one of the options, or by a model, are not ground truth: they score agreement with whoever made them. When there is no ground truth, the answer is "not decidable yet": say what to label by hand and how many.
4. **A fair comparison.** Every option on the same inputs, the same commit and the same tools, interleaved in one run; a change only one side has is left out. Pick one baseline and use it in every figure that follows. Fix the number of cases and runs before looking at any result: stopping at the first win favours whichever is ahead by chance. Before timing anything, check the log shows the option working (exit codes, cache hits) and that every input source arrived, counted per source. Size it to the decision: when the choice is costly to undo, set a time budget for the whole decision first; screen every option side by side in minutes, and run only the finalists longer, only on what the screen left open. Shorten by taking less input, not by speeding it up: a faster rate changes anything that grows with load, such as memory. Read each run's first result as it lands, shorten fixed waits, put a timeout on every step, and end a run as soon as it fails a check it has to pass. When the budget is spent, decide on what is known and name what is unproven.
5. **Repeat.** A model's answers change between runs; run each option at least three times and report the spread between runs.
6. **Score on everything, not on a filtered part.** Do not keep only cases chosen by something an option produced (its confidence, its own output, whether it finished): that filter is measured after the option acts and can favour any of them.
7. **Decide, and say how sure.** The winner, by how much, against the spread between runs, and what would change the answer (more labelled cases, a different kind of input).
8. **When optimising, keep going.** "Close" or "not worth it" from an estimate is a measurement still to make. Agree the stopping point first (the last few ideas each gain under a set amount), and report every idea tried, including what did not help. An estimate is labelled as one and never sets a headline.

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
- A store bake-off took 42 hours to pick. Trials first ran one after another; a sped-up replay ranked one store 500 MB ahead, a tie at the real rate; then 20 hours of overnight and safety runs could not move the pick, since memory was already tied and a pre-set tie-break decided. A 10-minute side-by-side screen, built late, cut seven options to four and every later stage agreed.
- That tie-break, "one program does it all", rested on alerting and logins nobody had tried; a review had asked for the real alert rules and dashboards, and they were left for later. Once moving, short probes found clears held back until the repeat interval, per-series alerts that never clear, lower-cased metric names and an admin-only login: the move needed two extra services to work around them.
- In every scored round the shared collector sent the wrong login to one store, so that store never got the host's own load; the summary still compared it with stores that did.
