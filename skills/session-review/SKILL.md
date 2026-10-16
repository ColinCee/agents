---
name: session-review
description: Reviews past coding-agent sessions for corrections the user keeps repeating, and says where each fix belongs so it stops coming back. Use when asked what the user keeps correcting, or to learn from past sessions or find new skills.
license: MIT
disable-model-invocation: true
compatibility: Requires Node 22 or later.
---

Every correction the user typed twice is an instruction that lives in the wrong place, or nowhere. Find them, count them, and say where each belongs.

## Steps

1. **List the prompts.** From this skill's folder:

   ```
   node scripts/prompts.mjs --since <date>
   ```

   It reads Claude Code's and Codex's session folders by default; pass another agent's folder as an argument. Default period: the last two weeks. Secrets are already masked; never copy one back from anywhere else.

2. **Mark the corrections.** Read every prompt with the reply before it. A correction repeats an earlier request, says no, again, wrong or why did you, restates a rule, asks "are you sure" or "did you check", or asks "what next" after the agent stopped. Not corrections: new requests, one-off product choices (a colour, a name), thanks.

3. **Group them into lessons**, one general line each, and count the sessions and the projects each came from. A lesson from one session is noise; leave it out.

4. **Look for each lesson where it might already be written:** the user's own instructions (`~/.claude/AGENTS.md`, `~/.codex/AGENTS.md`, `CLAUDE.md` beside them), each project's `AGENTS.md` or `CLAUDE.md`, the agent's memory files, installed skills. **A lesson that is written down and still repeated is the most important finding:** it sits at the wrong level (a rule in one project, needed in all) or is worded so it is not followed. Name the file it is in.

5. **Give each lesson one home:**

   | Seen in | Home |
   |---|---|
   | Two or more projects | The user's own instructions |
   | One project | That project's `AGENTS.md` (or the instruction file it already uses) |
   | A skill the agent used, done wrong | That skill's gotchas |
   | The same steps asked for in three or more sessions | A new skill candidate |

   When moving a rule up, say which lower copy to delete.

6. **Report, and change nothing** until the user says yes: these are their instruction files.

## The report

| Lesson | Sessions | Projects | Already written in | Home |
|---|---|---|---|---|

Then one line on what was left out and why. Quote the user only in a few words, and only in a private place: transcripts are theirs.

## Gotchas

From real use:

- A rule saved in one project's memory or instructions did not stop the same correction in another project: 20 of 85 lessons in one review had been written down already.
- "Shall I…?" at the end of a turn, followed by the user's "just do it" or "what next", is a correction even though the user never says "wrong".
- Rules in the user's own file were ignored for weeks because the agent never loaded that file (Claude Code reads `~/.claude/CLAUDE.md`, not `~/.claude/AGENTS.md`). Before blaming a rule's wording, check that the file it is in is one the agent reads.
- A token pasted into a prompt is still a secret in the transcript. Tell the user to rotate it; never repeat it.
