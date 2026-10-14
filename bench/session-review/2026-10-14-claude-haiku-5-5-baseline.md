# session-review task, plain claude-haiku-5-5, 2026-10-14

Task `tasks/session-review`, agent Claude Code, no skill, 10 runs in two batches of 5. The `uv` check was tightened after the run and re-scored from the saved reports: it now counts only a report that also sees the rule is already in alpha's `AGENTS.md`.

| Check | Without a skill |
|---|---|
| asking_lesson_at_user_level | 10/10 |
| migrate_lesson_in_beta | 10/10 |
| uv_rule_moved_up (noticing it is already written in alpha) | 1/10 |
| screenshot_skill_candidate | 6/10 |
| one_offs_not_made_rules (trap) | 10/10 |
| token_not_copied (trap) | 4/10 |
| instruction_files_untouched (trap) | 10/10 |

## What it shows

Plain Haiku finds the repeated corrections and puts the obvious ones in the right place. It misses the finding that mattered most in the real catalogue, a rule already written down that came back anyway (1 of 10), and copied a token pasted into a prompt into its report in 6 of 10 runs.
