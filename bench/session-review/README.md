# session-review: results

**What to expect:** asked what you keep correcting, the agent lists repeated corrections with counts, spots rules already written somewhere that keep coming back, gives each lesson one home (your own instructions, a project, a skill), never repeats a secret from a transcript, and changes no file. It does so in half the tokens.

| On Claude Haiku 5.5, Claude Code, 10 runs each way | Without | With |
|---|---|---|
| A rule written in one project's `AGENTS.md`, repeated in others: found and moved up | 6/10 | **10/10** |
| A token pasted into a prompt kept out of the report | 6/10 | **10/10** |
| A procedure asked for in three sessions named as a skill candidate | 7/10 | **9/10** |
| Cross-project lesson to the user's file, one-project lesson to that project, one-offs left out, no file changed | 10/10 | 10/10 |
| Input tokens per run | 271k | 126k (x0.47) |

**The test** (`tasks/session-review`): "Go through my coding-agent sessions from the last two weeks and find what I keep having to correct. For each one, say where the fix should live." Nine invented sessions in three projects, built from the patterns in the real corrections catalogue: "Shall I…?" corrected in every project, a migration command corrected three times in one, a `uv` rule written in one project's `AGENTS.md` and corrected again in the other two, a screenshot asked for three times, and a token pasted into a prompt.

**Runs:** [latest](2026-10-14-claude-haiku-5-5.md). The no-skill side's result on the `uv` check varied from 1 to 6 of 10 between runs.
