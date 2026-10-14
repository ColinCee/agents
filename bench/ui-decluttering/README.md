# ui-decluttering: results

**What to expect:** asked to fix a messy screen, the agent leaves one primary action and at most four choices in view, puts the rare ones behind one "More", and removes what is not about the decision. Without it, Haiku tidies the look but keeps nearly every button in view.

| On Claude Haiku 5.5, Claude Code, 10 runs each way | Without | With |
|---|---|---|
| At most four choices in view | 0/10 | **10/10** |
| One primary action | 6/10 | **10/10** |
| No switch dressed as a link | 9/10 | **10/10** |
| Unrelated numbers removed, every choice kept or named, add still works, tests pass | 10/10 | 10/10 |
| Input tokens per run | 256k | 223k (x0.87) |

**The test** (`tasks/sidebar`): "The sidebar on a card's page has grown messy, and deciding what to do with a card takes me too long. Redesign it." Planted from the Cortex corrections of 13 and 14 October: "Add to calendar" and "Already booked" both styled primary, seven choices in view, a "Notify me →" switch that looks like a link, and feed numbers unrelated to the card.

**Compared with `impeccable`** (installed alone, 10 runs): the agent never loaded it, and the result matched plain Haiku.

**Runs:** [latest](2026-10-14-claude-haiku-5-5.md).
