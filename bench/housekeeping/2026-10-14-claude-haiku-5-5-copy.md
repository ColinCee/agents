# housekeeping on claude-haiku-5-5, 2026-10-14

Task `tasks/housekeeping`, agent Claude Code, batches of 5 each way run side by side. Key `82c5f873e372/1057e4b42a85`.

**Verdict:** promote: owner_data_intact ahead by 40% of runs, nothing behind by more than 10%, tokens x1.18

| | Without the skill | With the skill |
|---|---|---|
| Runs | 10 | 10 |
| Checks passed, mean of 12 | 11.1 | 11.9 |
| Input tokens, mean | 246,786 | 290,406 |
| Output tokens, mean | 7,939 | 9,672 |
| Agent time, mean | 51 s | 64 s |
| Set-up and grading per run, mean | 12 s and 28 s | 19 s and 27 s |
| Skill read | | 10 of 10 |
| Model actually served | claude-haiku-5-5 | claude-haiku-5-5 |

Checks named `did:` are about what the agent did, read from its trajectory.

| Check | Without | With | Tells them apart |
|---|---|---|---|
| unused_feature_named | 10/10 | 10/10 | no |
| usage_evidence_given | 10/10 | 10/10 | no |
| test_that_can_overwrite_data_named | 10/10 | 10/10 | no |
| test_that_asserts_nothing_handled | 10/10 | 10/10 | no |
| lint_clean | 10/10 | 10/10 | no |
| dead_function_handled | 10/10 | 10/10 | no |
| readme_dead_path_handled | 10/10 | 10/10 | no |
| owner_data_intact | 6/10 | 10/10 | yes |
| unused_feature_proposed_not_deleted | 10/10 | 10/10 | no |
| used_feature_kept | 10/10 | 10/10 | no |
| other_tests_pass | 10/10 | 10/10 | no |
| did:tests_not_run_on_the_owners_data | 5/10 | 9/10 | yes |

The runs took 334 s. That is over the budget of 300 s.



## Notes

- Only the step-1 fallback changed: run every test and tool on a copy of the project, with the home folder pointed somewhere empty, in place of backing up and checking each file. No-skill runs reused.
- Promoted: every check at 10 of 10 with the skill, the owner's data kept 10 of 10 against 6, tokens x1.18. The skill moved from `skills/.experimental/` to `skills/`.
- The data gain held in all three versions of the skill run against the same no-skill runs (10 of 10 each time); the changes between them fixed the findings and the cost.
- Measured as a command: the task says only "Do some housekeeping". The focused skills it names were not installed, so this measures the checklist and its fallback lines alone.
