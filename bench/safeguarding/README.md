# safeguarding: results

**What to expect:** with the skill, the agent makes your data unreachable before it runs tests or tools. Without it, Haiku destroyed the owner's data in 6 of 10 runs.

| On Claude Haiku 5.5, Claude Code, 10 runs each way | Without | With |
|---|---|---|
| Owner's data left intact | 4/10 | **10/10** |
| Tests made unable to reach the real home folder | 3/10 | **10/10** |
| Mutation tool never run against the real home folder | 0/10 | **8/10** |
| Everything else (weak tests found and strengthened, tests pass) | 10/10 | 10/10 |
| Input tokens per run | 575k | 678k (x1.18) |

The test, with what it plants, and every run are in the private `agents-bench` repository, under `safeguarding/`: kept out of public view so no model can learn the answers.