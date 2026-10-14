> Superseded by [2026-10-14-claude-haiku-5-5-routes.md](2026-10-14-claude-haiku-5-5-routes.md), after the lines about routes were fixed. Kept as the record of this run.

# tidying on claude-haiku-5-5, 2026-10-14

Task `tasks/tidying`, agent Claude Code, batches of 5 each way run side by side. Key `d9f0e7879e55/059c71cbe171`.

**Verdict:** undecided: unlinked_page_named is behind by 70%; tokens x1.47, the rule allows x1.25

| | Without the skill | With the skill |
|---|---|---|
| Runs | 10 | 10 |
| Checks passed, mean of 13 | 12.2 | 12.1 |
| Input tokens, mean | 146,664 | 215,550 |
| Output tokens, mean | 4,798 | 5,578 |
| Agent time, mean | 35 s | 41 s |
| Set-up and grading per run, mean | 23 s and 22 s | 23 s and 21 s |
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
| unlinked_page_named | 8/10 | 1/10 | yes |
| uncommitted_work_named | 10/10 | 10/10 | no |
| committed_key_named | 10/10 | 10/10 | no |
| uncommitted_work_kept | 10/10 | 10/10 | no |
| function_used_by_name_kept | 10/10 | 10/10 | no |
| untracked_data_kept | 10/10 | 10/10 | no |
| merged_branch_kept | 10/10 | 10/10 | no |
| tests_still_pass | 10/10 | 10/10 | no |

The runs took 230 s.



## Notes

- The first run of the rebuilt task, whose faults come from real corrections: a routed page nothing links to, the owner's uncommitted work, a live key committed in the config. Ten runs each way.
- The skill made one thing worse: plain Haiku named the unlinked page in 8 of 10 runs, the skill in 1. Its step 4 said a name in a route table is still used, and a gotcha sent pages to the `cleaning` skill, so the agent saw `report` in the router and moved on. Both lines now say to list every page and check that something reaches it.
