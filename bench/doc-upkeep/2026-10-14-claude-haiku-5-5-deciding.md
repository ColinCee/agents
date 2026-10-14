# doc-upkeep on claude-haiku-5-5, 2026-10-14

Task `tasks/doc-upkeep`, agent Claude Code, batches of 5 each way run side by side. Key `01927e812b37/ba9c301aacee`.

**Verdict:** promote: rule_in_one_place ahead by 100% of runs, nothing behind by more than 10%, tokens x1.13

| | Without the skill | With the skill |
|---|---|---|
| Runs | 10 | 10 |
| Checks passed, mean of 10 | 7.1 | 10.0 |
| Input tokens, mean | 156,337 | 177,096 |
| Output tokens, mean | 4,761 | 4,590 |
| Agent time, mean | 33 s | 34 s |
| Set-up and grading per run, mean | 21 s and 21 s | 21 s and 21 s |
| Skill read | | 10 of 10 |
| Model actually served | claude-haiku-5-5 | claude-haiku-5-5 |

Checks named `did:` are about what the agent did, read from its trajectory.

| Check | Without | With | Tells them apart |
|---|---|---|---|
| test_count_right | 10/10 | 10/10 | no |
| units_current | 10/10 | 10/10 | no |
| export_route_gone | 8/10 | 10/10 | yes |
| rule_in_one_place | 0/10 | 10/10 | yes |
| no_removal_logged | 3/10 | 10/10 | yes |
| docs_not_longer | 0/10 | 10/10 | yes |
| unused_function_kept | 10/10 | 10/10 | no |
| licence_kept | 10/10 | 10/10 | no |
| code_unchanged | 10/10 | 10/10 | no |
| tests_pass | 10/10 | 10/10 | no |

The runs took 183 s.



## Notes

- The deciding run: both sides fresh under the fixed grader, ten each way, fixed in advance.
- Promoted: every check 10 of 10 with the skill; without it, the copied rule was left in all three files and the documents grew in every run, and a removal was logged in 7. Tokens x1.13. The skill moved from `skills/.experimental/` to `skills/`.
