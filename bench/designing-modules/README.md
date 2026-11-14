# designing-modules: results

**What to expect:** before splitting a file or adding a module, the agent designs it two ways, counts the names that would cross module lines, and writes a `Design:` section. On one split it gave the smallest interface of every side, but no higher overall score than an agent without it.

| On Claude Opus 5.5, Claude Code, 3 runs each | Without | `designing-modules` | mattpocock `codebase-design` |
|---|---|---|---|
| Share of checks passed | 0.93 | 0.85 | 0.70 |
| Names crossing module lines, mean | 84 | **74** | 79 |
| Cost per run | $8.12 | **$6.81** | $8.29 |

The skill was written from this same split, so the task flatters it, and the crossing count is the skill's own measure. One missed step moves a run from 1.00 to 0.56, so three runs cannot separate 0.85 from 0.93. mattpocock's `codebase-design` is not used or pointed to.

The test and every run are in the private `agents-bench` repository, under `skills/designing-modules/`.
