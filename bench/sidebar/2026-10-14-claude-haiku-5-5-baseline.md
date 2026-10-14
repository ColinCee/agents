# sidebar task, plain claude-haiku-5-5, 2026-10-14

Task `tasks/sidebar`, agent Claude Code, no skill, 10 runs in two batches of 5. Re-scored from the saved files after a grader fix: the "Add to calendar still works" trap found the button by its label, and 8 runs had relabelled it "Yes, add it". It now finds the button by what it does.

| Check | Without a skill |
|---|---|
| few_choices_in_view (at most 4) | 2/10 |
| one_primary_action | 5/10 |
| unrelated_stats_gone | 10/10 |
| no_switch_dressed_as_a_link | 10/10 |
| every_choice_kept_or_named (trap) | 10/10 |
| add_to_calendar_still_works (trap) | 10/10 |

## What it shows

Asked to redesign a messy sidebar, plain Haiku removes what is plainly wrong (the unrelated numbers, the switch that looks like a link) but keeps nearly every choice in view, and half the time keeps two primary buttons: the decision fatigue in the Cortex corrections. Next: the same task with `impeccable` installed, whose "distill" reference states these rules.
