# deciding on claude-haiku-5-5, 2026-10-14

Task `tasks/choosing`, agent Claude Code, batches of 3 each way run side by side. Key `bc24c1c91b8d/421d1fff9758`.

**Verdict:** undecided: best gap 20% (confidence_filter_named), the rule needs 40%

| | Without the skill | With the skill |
|---|---|---|
| Runs | 10 | 10 |
| Checks passed, mean of 7 | 6.4 | 6.6 |
| Input tokens, mean | 119,736 | 147,098 |
| Output tokens, mean | 4,175 | 5,364 |
| Agent time, mean | 28 s | 36 s |
| Set-up and grading per run, mean | 19 s and 18 s | 19 s and 18 s |
| Skill read | | 4 of 10 |
| Model actually served | claude-haiku-5-5 | claude-haiku-5-5 |

Checks named `did:` are about what the agent did, read from its trajectory.

| Check | Without | With | Tells them apart |
|---|---|---|---|
| medium_chosen | 10/10 | 10/10 | no |
| silver_labels_not_truth | 10/10 | 10/10 | no |
| confidence_filter_named | 8/10 | 10/10 | yes |
| repeated_runs | 6/10 | 6/10 | no |
| uncertainty_stated | 10/10 | 10/10 | no |
| other_settings_kept | 10/10 | 10/10 | no |
| data_untouched | 10/10 | 10/10 | no |

The runs took 358 s. That is over the budget of 300 s.



## Notes

- First run, on `tasks/choosing`, ten each way. Undecided, and the skill was loaded in only 4 of 10 runs: of those, 3 repeated each model's runs, against 3 of 6 that never loaded it.
- The description led with what the skill does; it now leads with the questions that call for it ("which is better", "which to make the default"). The next run measures that.
