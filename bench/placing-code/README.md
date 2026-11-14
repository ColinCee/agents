# placing-code: results

**What to expect:** asked to restructure a repository, the agent plans a folder per job and puts every test and single-use file beside what uses it. Without it, and with the other skills tried, agents left tests where they were.

| On Claude Opus 5.5, Claude Code, 2 repositories, 6 runs each | Without | `placing-code` | `restructuring-code` | mattpocock `improve-codebase-architecture` |
|---|---|---|---|---|
| The owner's structure goals (0 to 1) | 0.49 | **0.81** | 0.50 | 0.45 |
| Tests moved beside their code | 13% | **100%** | 13% | 11% |
| Folder fit to what uses what, change from no skill | | **+0.013** | +0.006 | 0.000 |
| Cost per run | $1.15 | $1.41 | $1.11 | $1.07 |

Only `placing-code` beats no skill by more than chance (p < 0.01 on both measures, Holm-corrected), on the repository held out from writing it as well as on the one its rules came from. It costs about $0.26 more a run, within the noise. mattpocock's side wrote one invalid layout (two files to one path).

How sure: the structure-goals measure is the owner's rules, which the skill states, so it shows the skill is followed; the folder-fit measure is written by neither and is the neutral check. The runs planned the layout without moving files, and the prompt named the skill, so whether it loads by itself from its description is untested.

The test and every run are in the private `agents-bench` repository, under `skills/restructuring-code/`: kept out of public view so no model can learn the answers.

## Splitting a file

**What to expect:** before splitting a file or adding a module, the agent designs it two ways, counts the names that would cross module lines, and writes a `Design:` section. On one split it passed every check in all three runs; without it, the agent split as well but left a larger interface.

| On Claude Opus 5.5, Claude Code, 3 runs each | Without | `designing-modules` | mattpocock `codebase-design` |
|---|---|---|---|
| Share of checks passed | 0.93 | **1.00** | 0.67 |
| Names crossing module lines, mean | 87 | 76 | 72 |
| Cost per run | $8.33 | $7.33 | $6.49 |

The skill was written from this same split, so the task flatters it, and the crossing count is the skill's own measure. Both skills shrink the interface by about as much; one `codebase-design` run left a module too large to count as a split. mattpocock's `codebase-design` is not used or pointed to, since `designing-modules` already gives what it gives.

The test and every run are in the private `agents-bench` repository, under `skills/designing-modules/`: kept out of public view so no model can learn the answers.
