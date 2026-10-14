# tidying: results

**What to expect:** with the skill, the agent finds everything a tidy-up should, every time, including a page nothing links to (10 of 10 against 3 of 10). It costs about one and a half times the tokens of a run that misses part of the job.

| On Claude Haiku 5.5, Claude Code, 10 runs each way | Without | With |
|---|---|---|
| Page that is routed but nothing links to, named | 3/10 | **10/10** |
| README test count corrected | 8/10 | **10/10** |
| What needs your yes, listed | 9/10 | **10/10** |
| Uncommitted work explained and kept, committed key flagged, dead code, lint, traps | 10/10 | 10/10 |
| Input tokens per run | 147k | 234k (x1.59) |

**Promoted** under the cost rule set by the owner on 14 October: cost caps runaway skills at x3 and is otherwise reported, not traded against a run that did not finish the job.

The test, with what it plants, and every run are in the private `agents-bench` repository, under `tidying/`: kept out of public view so no model can learn the answers.