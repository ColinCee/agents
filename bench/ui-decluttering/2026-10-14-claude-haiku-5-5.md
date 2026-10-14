# ui-decluttering on claude-haiku-5-5, 2026-10-14

Task `tasks/sidebar`, agent Claude Code, batches of 3 each way run side by side. Key `68bfe6983f40/dfb558f09c20`.

**Verdict:** promote: few_choices_in_view ahead by 100% of runs, nothing behind by more than 10%, tokens x0.87

| | Without the skill | With the skill |
|---|---|---|
| Runs | 10 | 10 |
| Checks passed, mean of 7 | 5.5 | 7.0 |
| Input tokens, mean | 256,440 | 222,824 |
| Output tokens, mean | 9,091 | 8,218 |
| Agent time, mean | 58 s | 48 s |
| Set-up and grading per run, mean | 24 s and 21 s | 24 s and 20 s |
| Skill read | | 10 of 10 |
| Model actually served | claude-haiku-5-5 | claude-haiku-5-5 |

Checks named `did:` are about what the agent did, read from its trajectory.

| Check | Without | With | Tells them apart |
|---|---|---|---|
| one_primary_action | 6/10 | 10/10 | yes |
| few_choices_in_view | 0/10 | 10/10 | yes |
| unrelated_stats_gone | 10/10 | 10/10 | no |
| no_switch_dressed_as_a_link | 9/10 | 10/10 | yes |
| every_choice_kept_or_named | 10/10 | 10/10 | no |
| add_to_calendar_still_works | 10/10 | 10/10 | no |
| tests_pass | 10/10 | 10/10 | no |

The runs took 510 s. That is over the budget of 300 s.



## Notes

- Ten runs each way, fixed in advance, three per side at a time (the owner was gaming). The grader's fix for relabelled buttons was made before this run.
- Promoted: every check 10 of 10 with the skill; without it, more than four choices stayed in view in every run and two primary buttons in 4. Tokens x0.87 and 10 s faster: knowing what to cut, the agent spent fewer steps deciding.
- `impeccable`, installed alone on the same task, was never loaded in 10 runs and changed nothing; see [the baseline](../sidebar/2026-10-14-claude-haiku-5-5-baseline.md).
- What a script cannot judge (is the result good to look at) still needs a person comparing two results unlabelled.
