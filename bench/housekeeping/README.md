# housekeeping: results

**What to expect:** a command. "Do some housekeeping" gives the full pass in a safe order, every time: data protected first, then code health, what is unused, and documents, in a report laid out by step. Without it, Haiku finds the same problems but runs the tests on your real data.

| On Claude Haiku 5.5, Claude Code, 10 runs each way | Without | With |
|---|---|---|
| Owner's data left intact | 6/10 | **10/10** |
| Tests never run on the owner's data | 5/10 | **9/10** |
| Unused feature, dead code, empty test, stale README, lint | 10/10 | 10/10 |
| Input tokens per run | 247k | 290k (x1.18) |

**Measured alone:** the skills it names (`safeguarding`, `tidying`, `cleaning`) were not installed, so this is the checklist and its fallback lines. With them installed is not measured yet.

The test, with what it plants, and every run are in the private `agents-bench` repository, under `housekeeping/`: kept out of public view so no model can learn the answers.