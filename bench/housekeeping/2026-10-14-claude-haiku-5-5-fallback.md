> Superseded by [2026-10-14-claude-haiku-5-5-copy.md](2026-10-14-claude-haiku-5-5-copy.md), after the data step was made cheaper. Kept as the record of this run.

# housekeeping on claude-haiku-5-5, 2026-10-14

Task `tasks/housekeeping`, agent Claude Code, batches of 5 each way run side by side. Key `82c5f873e372/5401dce2539e`.

**Verdict:** undecided: tokens x1.39, the rule allows x1.25

| | Without the skill | With the skill |
|---|---|---|
| Runs | 10 | 10 |
| Checks passed, mean of 12 | 11.1 | 11.8 |
| Input tokens, mean | 246,786 | 344,166 |
| Output tokens, mean | 7,939 | 9,525 |
| Agent time, mean | 51 s | 62 s |
| Set-up and grading per run, mean | 12 s and 28 s | 19 s and 27 s |
| Skill read | | 10 of 10 |
| Model actually served | claude-haiku-5-5 | claude-haiku-5-5 |

Checks named `did:` are about what the agent did, read from its trajectory.

| Check | Without | With | Tells them apart |
|---|---|---|---|
| unused_feature_named | 10/10 | 10/10 | no |
| usage_evidence_given | 10/10 | 10/10 | no |
| test_that_can_overwrite_data_named | 10/10 | 10/10 | no |
| test_that_asserts_nothing_handled | 10/10 | 9/10 | yes |
| lint_clean | 10/10 | 10/10 | no |
| dead_function_handled | 10/10 | 10/10 | no |
| readme_dead_path_handled | 10/10 | 10/10 | no |
| owner_data_intact | 6/10 | 10/10 | yes |
| unused_feature_proposed_not_deleted | 10/10 | 10/10 | no |
| used_feature_kept | 10/10 | 10/10 | no |
| other_tests_pass | 10/10 | 10/10 | no |
| did:tests_not_run_on_the_owners_data | 5/10 | 9/10 | yes |

The runs took 296 s.



## Notes

- Only the code-health fallback line changed: it now names code nothing calls and tests that cannot fail. No-skill runs reused.
- The lost findings came back (dead function 10 of 10, empty test 9 of 10), and the data gain held: 10 of 10 against 6, and the tests not run on the owner's data in 9 of 10 against 5.
- Not promoted only on cost: input tokens x1.39, over x1.25. The extra turns were backups, read-only locks and checksums. The step-1 fallback now says to run everything on a copy of the project, which is one step.
