# doc-upkeep: results

**What to expect:** with the skill, documents and comments are corrected in place and come out shorter: a rule copied into several files becomes one copy and pointers, and nothing is added to logs of what was removed. Without it, Haiku updates the facts but appends, logs and leaves copies.

| On Claude Haiku 5.5, Claude Code, 10 runs each way | Without | With |
|---|---|---|
| A rule copied into three files kept in one place | 0/10 | **10/10** |
| Documents no longer than before | 1/10 | **10/10** |
| No new dated "Removed" entry | 2/10 | **10/10** |
| Comments that only repeat the code removed | 0/10 | **9/10** |
| A quirk explained once, pointed to from elsewhere | 1/10 | **10/10** |
| A comment the code outgrew fixed | 10/10 | 9/10 |
| Test count, units, licence, behaviour and tests untouched | 10/10 | 10/10 |
| Input tokens per run | 183k | 193k (x1.05) |

The test, with what it plants, and every run are in the private `agents-bench` repository, under `doc-upkeep/`: kept out of public view so no model can learn the answers.