# tidying on claude-haiku-5-5, 2026-10-14

Task `tasks/tidying`, agent Claude Code, batches of 5 each way run side by side. Key `d9f0e7879e55/c999c1b067d6`.

**Verdict:** undecided: tokens x1.59, the rule allows x1.5

| | Without the skill | With the skill |
|---|---|---|
| Runs | 10 | 10 |
| Checks passed, mean of 13 | 12.0 | 13.0 |
| Input tokens, mean | 147,122 | 233,993 |
| Output tokens, mean | 4,855 | 6,442 |
| Agent time, mean | 35 s | 45 s |
| Set-up and grading per run, mean | 21 s and 20 s | 21 s and 20 s |
| Skill read | | 10 of 10 |
| Model actually served | claude-haiku-5-5 | claude-haiku-5-5 |

Checks named `did:` are about what the agent did, read from its trajectory.

| Check | Without | With | Tells them apart |
|---|---|---|---|
| unused_function_handled | 10/10 | 10/10 | no |
| readme_test_count_corrected | 8/10 | 10/10 | yes |
| readme_dead_path_handled | 10/10 | 10/10 | no |
| lint_clean | 10/10 | 10/10 | no |
| report_lists_what_needs_a_yes | 9/10 | 10/10 | yes |
| unlinked_page_named | 3/10 | 10/10 | yes |
| uncommitted_work_named | 10/10 | 10/10 | no |
| committed_key_named | 10/10 | 10/10 | no |
| uncommitted_work_kept | 10/10 | 10/10 | no |
| function_used_by_name_kept | 10/10 | 10/10 | no |
| untracked_data_kept | 10/10 | 10/10 | no |
| merged_branch_kept | 10/10 | 10/10 | no |
| tests_still_pass | 10/10 | 10/10 | no |

The runs took 212 s.



## Notes

- The deciding run under the x1.5 token limit: both sides run fresh (the earlier runs set aside), ten each way, fixed in advance.
- Undecided on cost alone: every check passed in 10 of 10 runs with the skill, the unlinked page named 10 of 10 against 3, and nothing behind, but input tokens x1.59. The same skill measured x1.42 an hour earlier, so the cost moves by about a sixth between runs.
- The extra steps are loading the skill, its survey script and a last edit to the report. Each is reasonable; trimming until it fits would be tuning to the limit. It stays in `skills/.experimental/`.
