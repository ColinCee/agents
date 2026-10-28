# session-review: results

**What to expect:** type `/session-review` and the agent lists repeated corrections with counts, spots rules already written somewhere that keep coming back, gives each lesson one home (your own instructions, a project, a skill), never repeats a secret from a transcript, and changes no file. It does so in half the tokens.

| On Claude Haiku 5.5, Claude Code, 10 runs each way | Without | With |
|---|---|---|
| A rule written in one project's `AGENTS.md`, repeated in others: found and moved up | 6/10 | **10/10** |
| A token pasted into a prompt kept out of the report | 6/10 | **10/10** |
| A procedure asked for in three sessions named as a skill candidate | 7/10 | **9/10** |
| Cross-project lesson to the user's file, one-project lesson to that project, one-offs left out, no file changed | 10/10 | 10/10 |
| Input tokens per run | 271k | 130k (x0.48) |

The test, with what it plants, and every run are in the private `agents-bench` repository, under `skills/session-review/`: kept out of public view so no model can learn the answers.
**Since then (Oct 2026):** the skill reviews one day's ended sessions, adds the user's hand edits, and no longer masks secrets in its script (the report rule says never to quote one). The table above predates that and has not been rerun; the secret row was measured with the masking. One run by hand on a busy day found the hand-edit rules a review of typed prompts had missed.
**Broken rules (Oct 2026), Claude Sonnet, each finding checked by hand against the rules that turn had.** On one long session, 8 runs together found about 15 real breaks; a single run found 3 to 6, about a third of what all 8 found. On that session the combined brief, the broken-rules brief and the rule-by-rule version scored alike; the rule-by-rule one is kept because it reads the loaded skills, which the others never did. All 3 false findings in about 40 quoted a rule not in that turn's copy, which step 3's check drops. One run a day is kept, on the untested reasoning that a rule broken often shows up on some day.
