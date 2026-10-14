> Superseded by [2026-10-14-claude-haiku-5-5-deciding.md](2026-10-14-claude-haiku-5-5-deciding.md), the fresh deciding run. Kept as the record of this run.

# tidying on claude-haiku-5-5, 2026-10-14

Task `tasks/tidying`, agent Claude Code, batches of 5 each way run side by side. Key `d9f0e7879e55/c999c1b067d6`.

**Verdict:** undecided: tokens x1.42, the rule allows x1.25

| | Without the skill | With the skill |
|---|---|---|
| Runs | 10 | 10 |
| Checks passed, mean of 13 | 12.2 | 12.9 |
| Input tokens, mean | 146,664 | 208,050 |
| Output tokens, mean | 4,798 | 5,453 |
| Agent time, mean | 35 s | 39 s |
| Set-up and grading per run, mean | 23 s and 22 s | 20 s and 25 s |
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
| unlinked_page_named | 8/10 | 9/10 | yes |
| uncommitted_work_named | 10/10 | 10/10 | no |
| committed_key_named | 10/10 | 10/10 | no |
| uncommitted_work_kept | 10/10 | 10/10 | no |
| function_used_by_name_kept | 10/10 | 10/10 | no |
| untracked_data_kept | 10/10 | 10/10 | no |
| merged_branch_kept | 10/10 | 10/10 | no |
| tests_still_pass | 10/10 | 10/10 | no |

The runs took 201 s.



## Notes

- Only the two lines about routes changed; no-skill runs reused. The unlinked page is named in 9 of 10 runs, and the skill is ahead on the README's test count (10 of 10 against 6) and on listing what needs a yes (10 against 8), behind on nothing.
- Held back by cost: input tokens x1.42. With the skill a run took about 11 steps against 8, one of them always the survey script, which a small repository does not need. The survey is now optional.
