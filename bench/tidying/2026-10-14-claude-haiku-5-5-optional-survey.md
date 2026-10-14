# tidying on claude-haiku-5-5, 2026-10-14

Task `tasks/tidying`, agent Claude Code, batches of 5 each way run side by side. Key `d9f0e7879e55/eca30bb00f0d`.

**Verdict:** undecided: tokens x1.60, the rule allows x1.25

| | Without the skill | With the skill |
|---|---|---|
| Runs | 10 | 10 |
| Checks passed, mean of 13 | 12.2 | 13.0 |
| Input tokens, mean | 146,664 | 234,849 |
| Output tokens, mean | 4,798 | 6,468 |
| Agent time, mean | 35 s | 44 s |
| Set-up and grading per run, mean | 23 s and 22 s | 19 s and 19 s |
| Skill read | | 10 of 10 |
| Model actually served | claude-haiku-5-5 | claude-haiku-5-5 |

Checks named `did:` are about what the agent did, read from its trajectory.

| Check | Without | With | Tells them apart |
|---|---|---|---|
| unused_function_handled | 10/10 | 10/10 | no |
| readme_test_count_corrected | 6/10 | 10/10 | yes |
| readme_dead_path_handled | 10/10 | 10/10 | no |
| lint_clean | 10/10 | 10/10 | no |
| report_lists_what_needs_a_yes | 8/10 | 10/10 | yes |
| unlinked_page_named | 8/10 | 10/10 | yes |
| uncommitted_work_named | 10/10 | 10/10 | no |
| committed_key_named | 10/10 | 10/10 | no |
| uncommitted_work_kept | 10/10 | 10/10 | no |
| function_used_by_name_kept | 10/10 | 10/10 | no |
| untracked_data_kept | 10/10 | 10/10 | no |
| merged_branch_kept | 10/10 | 10/10 | no |
| tests_still_pass | 10/10 | 10/10 | no |

The runs took 201 s.



## Notes

- The survey script made optional, to cut steps. Every check passed in 10 of 10 runs, but input tokens rose to x1.60: the agent ran the git commands one by one in place of one survey. Reverted; the skill is back to the version in [2026-10-14-claude-haiku-5-5-routes.md](2026-10-14-claude-haiku-5-5-routes.md) (x1.42).
