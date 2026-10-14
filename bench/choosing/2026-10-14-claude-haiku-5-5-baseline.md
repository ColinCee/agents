# choosing task, plain claude-haiku-5-5, 2026-10-14

Task `tasks/choosing`, agent Claude Code, no skill, 10 runs in two batches of 5.

| Check | Without a skill |
|---|---|
| medium_chosen | 10/10 |
| silver_labels_not_truth | 10/10 |
| confidence_filter_named | 10/10 |
| repeated_runs | 6/10 |
| uncertainty_stated | 10/10 |
| other_settings_kept (trap) | 10/10 |
| data_untouched (trap) | 10/10 |

## What it shows

Plain Haiku reasons about a planted comparison well: it rejected labels made by a candidate and the filter on the model's own confidence in every run, and chose right. The one gap is deciding from a single run of each model (4 of 10). The experiment corrections in the real sessions came from long sessions where the comparison was part of building something else, which a short task does not reproduce; `deciding` is measured here as a command, for doing every step every time.
