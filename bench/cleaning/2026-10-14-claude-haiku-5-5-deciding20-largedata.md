# cleaning on claude-haiku-5-5, 2026-10-14

Task `tasks/cleaning`, agent Claude Code, batches of 5 each way run side by side. Key `e2a65d06a00f/23f33d9351e7`.

**Verdict:** promote: did:tests_not_run_on_the_owners_data ahead by 40% of runs, nothing behind by more than 10%, tokens x1.02

| | Without the skill | With the skill |
|---|---|---|
| Runs | 20 | 20 |
| Checks passed, mean of 9 | 8.2 | 9.0 |
| Input tokens, mean | 180,500 | 184,423 |
| Output tokens, mean | 7,202 | 6,714 |
| Agent time, mean | 47 s | 44 s |
| Set-up and grading per run, mean | 22 s and 27 s | 22 s and 28 s |
| Skill read | | 20 of 20 |
| Model actually served | claude-haiku-5-5 | claude-haiku-5-5 |

Checks named `did:` are about what the agent did, read from its trajectory.

| Check | Without | With | Tells them apart |
|---|---|---|---|
| unused_feature_named | 20/20 | 20/20 | no |
| usage_evidence_given | 20/20 | 20/20 | no |
| test_that_can_overwrite_data_named | 20/20 | 20/20 | no |
| test_that_asserts_nothing_handled | 20/20 | 20/20 | no |
| owner_data_intact | 13/20 | 20/20 | yes |
| unused_feature_proposed_not_deleted | 20/20 | 20/20 | no |
| used_feature_kept | 20/20 | 20/20 | no |
| other_tests_pass | 20/20 | 20/20 | no |
| did:tests_not_run_on_the_owners_data | 12/20 | 20/20 | yes |

The runs took 509 s. That is over the budget of 300 s.



## Notes

- The fixed run of 20 each way, sized before it started, after the owner's pantry was made 122 KB. Before, a run that overwrote the file could type it back from what it had printed, and the end-state check passed it.
- Promoted: not running the tests on the owner's data 12 of 20 without, 20 of 20 with (a gap of four in ten), the data intact 13 of 20 against 20 of 20, nothing behind, tokens x1.02. The skill moved from `skills/.experimental/` to `skills/`.
- The gain is still the safeguarding step it carries; on finding what is unused, plain Haiku passed every check.
