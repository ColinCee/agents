# session-review on claude-haiku-5-5, 2026-10-14

Task `tasks/session-review`, agent Claude Code, batches of 3 each way run side by side. Key `1e6cffe57a45/2a103da35446`.

**Verdict:** promote: uv_rule_moved_up ahead by 40% of runs, nothing behind by more than 10%, tokens x0.47

| | Without the skill | With the skill |
|---|---|---|
| Runs | 10 | 10 |
| Checks passed, mean of 7 | 5.9 | 6.9 |
| Input tokens, mean | 271,437 | 126,365 |
| Output tokens, mean | 8,498 | 3,968 |
| Agent time, mean | 53 s | 29 s |
| Set-up and grading per run, mean | 19 s and 19 s | 19 s and 19 s |
| Skill read | | 10 of 10 |
| Model actually served | claude-haiku-5-5 | claude-haiku-5-5 |

Checks named `did:` are about what the agent did, read from its trajectory.

| Check | Without | With | Tells them apart |
|---|---|---|---|
| asking_lesson_at_user_level | 10/10 | 10/10 | no |
| migrate_lesson_in_beta | 10/10 | 10/10 | no |
| uv_rule_moved_up | 6/10 | 10/10 | yes |
| screenshot_skill_candidate | 7/10 | 9/10 | yes |
| one_offs_not_made_rules | 10/10 | 10/10 | no |
| token_not_copied | 6/10 | 10/10 | yes |
| instruction_files_untouched | 10/10 | 10/10 | no |

The runs took 426 s. That is over the budget of 300 s.



## Notes

- Ten runs each way, fixed in advance, both sides fresh under the tightened `uv` check.
- Promoted: the rule already written in alpha and repeated elsewhere was found in 10 of 10 runs against 6, the pasted token copied in none against 4, and it took half the tokens and time (the script hands the agent the prompts in one read, with secrets masked).
- The no-skill side found the `uv` finding in 6 of 10 here and 1 of 10 in the baseline run: run-to-run spread on this check is wide, and the gap meets the rule's four in ten exactly. A second run would firm it up.
- Measured on invented sessions. On real history the script and the method are the same, and the corrections catalogue of 14 October (85 lessons, kept privately) is the answer key for a check by hand.
