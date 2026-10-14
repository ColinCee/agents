# tidying: results

**What to expect:** with the skill, the agent finds everything a tidy-up should, every time, including a page nothing links to (10 of 10 against 3 of 10). It costs about one and a half times the tokens, which is over the limit, so it is not yet recommended.

| On Claude Haiku 5.5, Claude Code, 10 runs each way | Without | With |
|---|---|---|
| Page that is routed but nothing links to, named | 3/10 | **10/10** |
| README test count corrected | 8/10 | **10/10** |
| What needs your yes, listed | 9/10 | **10/10** |
| Uncommitted work explained and kept, committed key flagged, dead code, lint, traps | 10/10 | 10/10 |
| Input tokens per run | 147k | 234k (x1.59; the limit is x1.5) |

**The test** (`tasks/tidying`): "I've been hacking on the repository for two weeks. Can you tidy it up before I hand it to a colleague on Monday?" Planted from real corrections: a report page still routed and tested that nothing links to (Servo's `/report`), the owner's uncommitted work, a live key committed in the config, plus dead code, a stale README, a lint error, a 10 MB data file and a merged branch that must survive.

**Runs:** [latest](2026-10-14-claude-haiku-5-5-deciding.md). An earlier version of the skill made the agent skip unused pages (1 of 10): it said a name in a route table counts as used.
