# doc-upkeep on claude-haiku-5-5, 2026-10-14

Task `tasks/doc-upkeep`, agent Claude Code, batches of 5 each way run side by side. Key `541ec9896fa7/1ce06549b816`.

**Verdict:** undecided: test_count_right is behind by 20%

| | Without the skill | With the skill |
|---|---|---|
| Runs | 10 | 10 |
| Checks passed, mean of 10 | 6.8 | 9.3 |
| Input tokens, mean | 140,560 | 164,718 |
| Output tokens, mean | 4,113 | 4,589 |
| Agent time, mean | 30 s | 33 s |
| Set-up and grading per run, mean | 21 s and 21 s | 20 s and 20 s |
| Skill read | | 10 of 10 |
| Model actually served | claude-haiku-5-5 | claude-haiku-5-5 |

Checks named `did:` are about what the agent did, read from its trajectory.

| Check | Without | With | Tells them apart |
|---|---|---|---|
| test_count_right | 7/10 | 5/10 | yes |
| units_current | 10/10 | 10/10 | no |
| export_route_gone | 10/10 | 10/10 | no |
| rule_in_one_place | 0/10 | 9/10 | yes |
| no_removal_logged | 1/10 | 10/10 | yes |
| docs_not_longer | 0/10 | 10/10 | yes |
| unused_function_kept | 10/10 | 10/10 | no |
| licence_kept | 10/10 | 9/10 | yes |
| code_unchanged | 10/10 | 10/10 | no |
| tests_pass | 10/10 | 10/10 | no |

The runs took 182 s.



## Notes

- First run of the draft, ten each way. The skill fixed what plain Haiku got wrong: the rule kept in one place 9 of 10 against 0, no removal logged 10 against 1, the documents no longer than before 10 against 0, at x1.17 the tokens.
- The two checks it was behind on were the grader's fault, not the agent's. Runs with the skill deleted the test count where plain Haiku rewrote it, and one dropped "See LICENSE." from a project with no LICENSE file; both make the document true. The checks now pass a count left out and a licence section without the broken pointer. Re-scored from the saved files, the count check is 10 of 10 both ways.
- The decision rests on a fresh run under the fixed grader.
