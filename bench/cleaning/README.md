# cleaning: results

**What to expect:** both ways the agent finds what is unused; with the skill it never runs the tests on your real data while doing so.

| On Claude Haiku 5.5, Claude Code, 20 runs each way | Without | With |
|---|---|---|
| Owner's data left intact | 13/20 | **20/20** |
| Tests never run on the owner's data | 12/20 | **20/20** |
| Unused feature found, with evidence of use, proposed not deleted | 20/20 | 20/20 |
| Test that checks nothing, named | 20/20 | 20/20 |
| Input tokens per run | 181k | 184k (x1.02) |

The test, with what it plants, and every run are in the private `agents-bench` repository, under `cleaning/`: kept out of public view so no model can learn the answers.