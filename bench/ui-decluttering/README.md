# ui-decluttering: results

**What to expect:** asked to fix a messy screen, the agent leaves one primary action and at most four choices in view, puts the rare ones behind one "More", and removes what is not about the decision. Without it, Haiku tidies the look but keeps nearly every button in view.

| On Claude Haiku 5.5, Claude Code, 10 runs each way | Without | With |
|---|---|---|
| At most four choices in view | 0/10 | **10/10** |
| One primary action | 6/10 | **10/10** |
| No switch dressed as a link | 9/10 | **10/10** |
| Unrelated numbers removed, every choice kept or named, add still works, tests pass | 10/10 | 10/10 |
| Input tokens per run | 256k | 223k (x0.87) |

**Compared with `impeccable`** (installed alone, 10 runs): the agent never loaded it, and the result matched plain Haiku.

The test, with what it plants, and every run are in the private `agents-bench` repository, under `ui-decluttering/`: kept out of public view so no model can learn the answers.