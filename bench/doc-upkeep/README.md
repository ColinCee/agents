# doc-upkeep: results

**What to expect:** with the skill, documents are corrected in place and come out shorter: a rule copied into several files becomes one copy and pointers, and nothing is added to logs of what was removed. Without it, Haiku updates the facts but appends, logs and leaves copies.

| On Claude Haiku 5.5, Claude Code, 10 runs each way | Without | With |
|---|---|---|
| A rule copied into three files kept in one place | 0/10 | **10/10** |
| Documents no longer than before | 0/10 | **10/10** |
| No new dated "Removed" entry | 3/10 | **10/10** |
| A removed route no longer documented | 8/10 | **10/10** |
| Test count, units, licence, code and tests untouched | 10/10 | 10/10 |
| Input tokens per run | 156k | 177k (x1.13) |

**The test** (`tasks/doc-upkeep`): "I changed a lot last week and the docs are behind. Bring them up to date." Planted from real corrections: a stale count with "Update (Sep 30): now 14 tests" appended below it, one rule copied word for word into `README.md`, `docs/setup.md` and `AGENTS.md`, a dated log of removals, and units and a route the code changed. Traps: a note explaining code kept unused on purpose, the licence, the code itself.

**Runs:** [latest](2026-10-14-claude-haiku-5-5-deciding.md).
