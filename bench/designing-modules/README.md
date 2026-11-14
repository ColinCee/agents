# designing-modules: results

**What to expect:** before splitting a file or adding a module, the agent designs it two ways, counts the names that would cross module lines, and writes a `Design:` section. On one split it passed every check in all three runs; without it, the agent split as well but left a larger interface.

| On Claude Opus 5.5, Claude Code, 3 runs each | Without | `designing-modules` | mattpocock `codebase-design` |
|---|---|---|---|
| Share of checks passed | 0.93 | **1.00** | 0.67 |
| Names crossing module lines, mean | 87 | 76 | 72 |
| Cost per run | $8.33 | $7.33 | $6.49 |

The skill was written from this same split, so the task flatters it, and the crossing count is the skill's own measure. Both skills shrink the interface by about as much; one `codebase-design` run left a module too large to count as a split. mattpocock's `codebase-design` is not used or pointed to, since `designing-modules` already gives what it gives.

The test and every run are in the private `agents-bench` repository, under `skills/designing-modules/`: kept out of public view so no model can learn the answers.
