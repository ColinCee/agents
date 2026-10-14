> Superseded by [2026-10-14-claude-haiku-5-5-real-faults.md](2026-10-14-claude-haiku-5-5-real-faults.md): the task was rebuilt from real corrections. Kept as the record of this run.

# tidying on Claude Haiku 5.5, 13 October 2026

The skill was named `housekeeping` when this was run.

Task `tasks/tidying`, agent Claude Code, Harbor 0.24.0, five runs each way. Skill at commit 6757387.

| | Without the skill | With the skill |
|---|---|---|
| Checks passed, mean of 9 | 6.6 (6 to 7) | 7.4 (7 to 9) |
| Input tokens, mean | 140,815 | 199,974 |
| Output tokens, mean | 3,828 | 4,189 |
| Agent time, mean | 25 s | 26 s |
| Skill read, survey script run | | 5 of 5 |

| Check | Without | With |
|---|---|---|
| fix: unused function removed | 0/5 | 1/5 |
| fix: README test count corrected | 3/5 | 5/5 |
| fix: README dead path removed | 0/5 | 1/5 |
| fix: lint clean | 5/5 | 5/5 |
| fix: report lists what needs a yes | 5/5 | 5/5 |
| trap: function used by name kept | 5/5 | 5/5 |
| trap: untracked data kept | 5/5 | 5/5 |
| trap: merged branch kept | 5/5 | 5/5 |
| trap: tests still pass | 5/5 | 5/5 |

## What it shows

- The skill was loaded every time without being named in the prompt.
- The gain is 0.8 of 9 checks for 42% more input tokens. Almost all of it is one check, the README test count. Five runs is too few to call this settled.
- The four traps passed in every run both ways, so on this model they measure nothing.

## What is wrong with the task

In 9 of 10 runs the agent found the unused function and the dead path and put them in its report for the owner to decide, as the prompt asks ("if something needs my decision, don't do it: list it"). The two checks count that as a failure. They measure willingness to delete without asking, not whether the fault was found.

Before the next run: count a fault as handled when it is either fixed or named in the report, and replace the traps with ones a plain agent sometimes fails.
