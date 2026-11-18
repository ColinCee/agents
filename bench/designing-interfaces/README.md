# designing-interfaces: results

**What to expect:** with the skill, a page follows the look and behaviour rules; without it, Haiku labels no axes, uses an accent colour for decoration, repeats the row in the detail panel and selects by click only.

| On Claude Haiku 5.5, Claude Code, 6 runs each way | Without | With |
|---|---|---|
| Every chart's axes labelled, with units | 0/6 | **6/6** |
| Colour only for better and worse | 0/6 | **6/6** |
| The detail panel repeats nothing its row shows | 0/6 | **6/6** |
| Hover or focus previews, a click keeps | 0/6 | **6/6** |
| Motion that stops under reduced motion | 0/6 | **6/6** |
| One format for the change; no separator marks | 6/6 | 6/6 |
| Tokens per run | 81k | 89k (x1.09) |

The task, one page for 5 CI pipelines' weekly flaky rates with a detail panel, asked nothing about these rules. A fresh Sonnet agent scored the 12 pages blind, comments stripped and names shuffled; two items were checked by text search. Every page with the skill scored 7 of 7 and every page without it 2 of 7: one-sided permutation p = 0.001. The task, pages and scores are in the private `agents-bench` repository, under `skills/designing-interfaces/`.

Untested: writing who it is for first and showing working variants, which a one-page task cannot show. `ui-decluttering`, an earlier skill on the same ground, was removed because, loaded only by name, it was never loaded; this one loads by itself.
