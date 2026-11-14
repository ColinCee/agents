# structuring-repos: results

**What to expect:** asked to restructure a repository, the agent plans a folder per job and puts every test and single-use file beside what uses it. Without it, and with the other skills tried, agents left tests where they were.

| On Claude Opus 5.5, Claude Code, 2 repositories, 6 runs each | Without | `structuring-repos` | `restructuring-code` | mattpocock `improve-codebase-architecture` |
|---|---|---|---|---|
| The owner's structure goals (0 to 1) | 0.49 | **0.81** | 0.50 | 0.45 |
| Tests moved beside their code | 13% | **100%** | 13% | 11% |
| Folder fit to what uses what, change from no skill | | **+0.013** | +0.006 | 0.000 |
| Cost per run | $1.15 | $1.41 | $1.11 | $1.07 |

Only `structuring-repos` beats no skill by more than chance (p < 0.01 on both measures, Holm-corrected). On one repository its layouts scored as well as the owner's own (0.77 against 0.76). It costs about $0.26 more a run, within the noise. The runs planned the layout without moving files, and one repository is where the skill's rules came from; the other was held out.

The test and every run are in the private `agents-bench` repository, under `skills/restructuring-code/`: kept out of public view so no model can learn the answers.
