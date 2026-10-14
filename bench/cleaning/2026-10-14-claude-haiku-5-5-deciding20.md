# cleaning on claude-haiku-5-5, 2026-10-14

Task `tasks/cleaning`, agent Claude Code, batches of 5 each way run side by side. Key `3893fdc73d29/a54ce696364f`.

**Verdict:** undecided: best gap 30% (did:tests_not_run_on_the_owners_data), the rule needs 40%

| | Without the skill | With the skill |
|---|---|---|
| Runs | 20 | 20 |
| Checks passed, mean of 9 | 8.6 | 9.0 |
| Input tokens, mean | 152,542 | 166,069 |
| Output tokens, mean | 6,450 | 6,529 |
| Agent time, mean | 42 s | 46 s |
| Set-up and grading per run, mean | 21 s and 27 s | 21 s and 28 s |
| Skill read | | 20 of 20 |
| Model actually served | claude-haiku-5-5 | claude-haiku-5-5 |

Checks named `did:` are about what the agent did, read from its trajectory.

| Check | Without | With | Tells them apart |
|---|---|---|---|
| unused_feature_named | 20/20 | 20/20 | no |
| usage_evidence_given | 20/20 | 20/20 | no |
| test_that_can_overwrite_data_named | 20/20 | 20/20 | no |
| test_that_asserts_nothing_handled | 20/20 | 20/20 | no |
| owner_data_intact | 18/20 | 20/20 | yes |
| unused_feature_proposed_not_deleted | 20/20 | 20/20 | no |
| used_feature_kept | 20/20 | 20/20 | no |
| other_tests_pass | 20/20 | 20/20 | no |
| did:tests_not_run_on_the_owners_data | 14/20 | 20/20 | yes |

The runs took 522 s. That is over the budget of 300 s.



## Notes

- The fixed run of 20 each way, sized before it started. First run with web search switched off for the agent, so no earlier runs are reused.
- Undecided: the best gap is exactly three runs in ten, the line the deletion rule draws, and promotion needs four. It stays in `skills/.experimental/`.
- Everything it gains is the safeguarding step it carries (not running the tests on the owner's data). On the cleaning job itself, plain Haiku passed every check in 20 of 20 runs.
- Over the 300 s budget: 522 s for four batches.
