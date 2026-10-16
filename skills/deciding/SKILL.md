---
name: deciding
description: Decides between options from evidence, with one question, one baseline, a fair repeated comparison and how sure it is. Use when asked which option is better, whether a change helps, or to benchmark, measure or compare speed.
license: MIT
---

A decision is only as good as the comparison behind it. Follow the steps in order; write each one's answer in the report.

## Steps

1. **The question, in one line**, and the one thing that differs between the options. If you cannot say what is being compared, nobody can judge the result.
2. **What is already known.** Look for existing results, documents and sources first. A primary source (the project's own data, an official spec, a measurement) beats a summary of one. Say where each claim came from. If the evidence settles it, decide here.
3. **The ground truth, and who made it.** Name the labels, answers or measurements the options will be scored against. Labels made by one of the options, or by a model, are not ground truth: they score agreement with whoever made them. When there is no ground truth, the answer is "not decidable yet": say what to label by hand and how many.
4. **A fair comparison.** Every option on the same inputs, the same commit and the same tools, interleaved in one run; a change only one side has is left out. Pick one baseline and use it in every figure that follows. Fix the number of cases and runs before looking at any result: stopping at the first win favours whichever is ahead by chance. Before timing anything, check the log shows the option working (exit codes, cache hits).
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
