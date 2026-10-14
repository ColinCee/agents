# ui-flow task, plain claude-haiku-5-5, 2026-10-14

Task `tasks/ui-flow`, agent Claude Code, no skill, 10 runs in two batches of 5, 91 s.

| Check | Without a skill |
|---|---|
| new_choice_works | 10/10 |
| card_shows_in_history | 10/10 |
| undo_from_history | 10/10 |
| one_primary_action (trap) | 10/10 |
| add_to_calendar_still_works (trap) | 10/10 |
| booked_card_still_in_history (trap) | 10/10 |
| tests_pass (trap) | 10/10 |

## What it shows

- At this size the flow is easy to follow: the list of decisions History shows sits in the same file as the card's buttons, a few lines away, so every run updated both.
- In Cortex the card vanished after a redesign of the sidebar, where History was a separate page in other code. The next version puts History in its own module with its own list of decisions it shows. If plain Haiku still passes, the task is shelved.

## The harder version, and shelved

History moved to its own module (`cards/history.py`) with its own list of the decisions it shows, away from the card's buttons. Plain Haiku again passed every check in 10 of 10 runs: it searched for where statuses are used and updated History each time.

Shelved. In a small app an agent follows the flow from one page to the next without help. The Cortex corrections came from redesigning a busy sidebar in a large app, and were mostly about judgement (too many buttons, two that compete, a toggle that looks like a link), which a script cannot grade. A test of that needs a person judging two results side by side, unlabelled.
