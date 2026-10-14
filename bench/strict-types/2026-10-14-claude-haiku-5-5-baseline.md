# strict-types task, plain claude-haiku-5-5, 2026-10-14

Task `tasks/strict-types`, agent Claude Code, no skill, 10 runs in two batches of 5. The first batch was graded by a grader that demanded `null` for "no time"; it is re-scored here with the fixed grader (either `null` or `""`, as the project documents), from each run's saved schema.

| Check | Without a skill |
|---|---|
| start_typed | 8/10 |
| end_and_date_typed | 8/10 |
| cause_named | 10/10 |
| wrong_shape_tested | 10/10 |
| null_start_still_renders (trap) | 9/10 |
| status_unknown_kept (trap) | 10/10 |
| good_cards_unchanged (trap) | 10/10 |
| tests_pass (trap) | 10/10 |

## What it shows

- **Plain Haiku types the schema at the edge without being told.** Every run found that the start time was typed only in prose and added a pattern. The two that failed used `\d{2}:\d{2}`, which lets `25:99` through.
- **The best a skill could do here is 2 runs in 10,** short of the 4 the decision rule asks. The task is shelved and no skill is written for it.
- The correction behind it came from a schema an agent designed in a long session, not from a bug it was asked to find. As with experiment-design, a task where the agent builds the thing would test that.
