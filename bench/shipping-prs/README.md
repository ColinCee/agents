# shipping-prs: results

**Review angles (one try, on Claude Opus):** a change across a blog, a home server and a notes repository was reviewed by fresh agents briefed with the author's own list of concerns; they caught code bugs but missed a README the change made false, a container that could reach the server's admin services, and published fields that leaked restart and backup-failure times. Reviewers later given one angle each (security, docs) found those. Not yet run with and without the angles on the same change.

## Review angles

Measured as the skill `reviewing-changes`, now `references/review.md`.

**What to expect:** about the same bugs found as a plain review, at 2.6 times the mean cost per review.

| On Claude Opus 5.5, Claude Code, 12 past pull requests, 3 runs each | Without | `reviewing-changes` | mattpocock `code-review` |
|---|---|---|---|
| Bugs found that a later pull request fixed | 18/27 | 20/27 | 18/27 |
| Bug-severity alarms on pull requests that needed no fix, per review | 0.67 | 1.11 | 0.56 |
| Cost per review | **$0.49** | $1.27 | $0.66 |

The difference in bugs found is within the spread between runs: only four of the nine bugs were found by some runs and missed by others. No side left any control clean, since each raised at least a risk, so the bench does not yet judge false alarms. mattpocock's `code-review` is not used or pointed to.

The test and every run are in the private `agents-bench` repository, under `skills/reviewing-changes/`: kept out of public view so no model can learn the answers.
