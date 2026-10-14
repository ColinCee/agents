Batch 1: running 5 trials with the skill on claude-haiku-5-5 ...
Batch 2: running 5 trials with the skill on claude-haiku-5-5 ...
# cleaning on claude-haiku-5-5, 2026-10-14

Task `tasks/cleaning`, agent Claude Code, batches of 5 each way run side by side. Key `32f52437481c/23eed61557bf`.

**Verdict:** undecided: best gap 30% (owner_data_intact), the rule needs 40%

| | Without the skill | With the skill |
|---|---|---|
| Runs | 10 | 10 |
| Checks passed, mean of 9 | 8.4 | 9.0 |
| Input tokens, mean | 147,818 | 172,542 |
| Output tokens, mean | 6,221 | 6,306 |
| Agent time, mean | 41 s | 42 s |
| Set-up and grading per run, mean | 26 s and 27 s | 23 s and 34 s |
| Skill read | | 10 of 10 |
| Model actually served | claude-haiku-5-5 | claude-haiku-5-5 |

Checks named `did:` are about what the agent did, read from its trajectory.

| Check | Without | With | Tells them apart |
|---|---|---|---|
| unused_feature_named | 10/10 | 10/10 | no |
| usage_evidence_given | 10/10 | 10/10 | no |
| test_that_can_overwrite_data_named | 10/10 | 10/10 | no |
| test_that_asserts_nothing_handled | 10/10 | 10/10 | no |
| owner_data_intact | 7/10 | 10/10 | yes |
| unused_feature_proposed_not_deleted | 10/10 | 10/10 | no |
| used_feature_kept | 10/10 | 10/10 | no |
| other_tests_pass | 10/10 | 10/10 | no |
| did:tests_not_run_on_the_owners_data | 7/10 | 10/10 | yes |

The runs took 251 s.


## Notes

- Ten runs each way, fixed in advance, with the gotchas added on 14 October. The no-skill runs are the first ten of the earlier deciding run, reused because the task had not changed.
- Undecided under the rule: 7 of 10 against 10 of 10 on keeping the owner's data, a gap of three in ten where the rule asks four. The earlier promotion came from a run that stopped at the first batch to cross the line, which the rule no longer allows to decide, so the skill goes back to `skills/.experimental/` until a fixed run of 20 each way settles it.
- Strata was loaded during this run with about 1 GB of memory free. bench.py now refuses to start a batch with less than 8 GB free.
