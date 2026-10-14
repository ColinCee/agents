# housekeeping: results

**What to expect:** type `/housekeeping` and get the full pass in a safe order, every time: data protected first, then code health, what is unused, and documents, in a report laid out by step. Without it, Haiku finds the same problems but runs the tests on your real data.

| On Claude Haiku 5.5, Claude Code, 10 runs each way | Without | With |
|---|---|---|
| Owner's data left intact | 6/10 | **10/10** |
| Tests never run on the owner's data | 5/10 | **8/10** |
| Unused feature, dead code, empty test, stale README, lint | 10/10 | 10/10 |
| Input tokens per run | 247k | 371k (x1.51) |

**Measured as typed:** the run with the skill starts with `/housekeeping`; `tidying` and `cleaning` are folded into it. Latest run, 15 October: the owner's data kept in 10 of 10 runs against 6.

The test, with what it plants, and every run are in the private `agents-bench` repository, under `housekeeping/`: kept out of public view so no model can learn the answers.