---
name: deciding
description: Decides between options from evidence, not first impressions: one-line question, ground truth, a fair repeated comparison, how sure. Use when asked which option is better, which to make the default or to switch to, or whether a change helps.
license: MIT
disable-model-invocation: true
---

A decision is only as good as the comparison behind it. Follow the steps in order; write each one's answer in the report.

## Steps

1. **The question, in one line**, and the one thing that differs between the options. If you cannot say what is being compared, nobody can judge the result.
2. **What is already known.** Look for existing results, documents and sources first. A primary source (the project's own data, an official spec, a measurement) beats a summary of one. Say where each claim came from. If the evidence settles it, decide here.
3. **The ground truth, and who made it.** Name the labels, answers or measurements the options will be scored against. Labels made by one of the options, or by a model, are not ground truth: they score agreement with whoever made them. When there is no ground truth, the answer is "not decidable yet": say what to label by hand and how many.
4. **A fair comparison.** Every option on the same inputs, with the same tools, in the same run. Fix the number of cases and runs before looking at any result: stopping at the first win favours whichever is ahead by chance.
5. **Repeat.** A model's answers change between runs; run each option at least three times and report the spread between runs.
6. **Score on everything, not on a filtered part.** Do not keep only cases chosen by something an option produced (its confidence, its own output, whether it finished): that filter is measured after the option acts and can favour any of them.
7. **Decide, and say how sure.** The winner, by how much, against the spread between runs, and what would change the answer (more labelled cases, a different kind of input).

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
