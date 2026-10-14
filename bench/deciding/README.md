# deciding: results

**What to expect:** type `/deciding` with a "which is better" question, and the agent states the question, finds the ground truth, runs every option on the same inputs several times, scores without filtering on anything an option produced, and says how sure it is. Without it, Haiku usually reasons well but decides from a single run about half the time.

| On Claude Haiku 5.5, Claude Code, 10 runs each way | Without | `/deciding` |
|---|---|---|
| Ran each option several times before deciding | 6/10 | **10/10** |
| Named the bias in a comparison filtered on the options' own confidence | 8/10 | **10/10** |
| Chose right, rejected labels made by a candidate, stated how sure | 10/10 | 10/10 |
| Input tokens per run | 120k | 183k (x1.53) |

The test, with what it plants, and every run are in the private `agents-bench` repository, under `skills/deciding/`: kept out of public view so no model can learn the answers.
