---
name: session-review
description: Reviews past coding-agent sessions, or one session, for what the user corrected in chat or by editing the agent's text, and says where each fix belongs. Use when asked what the user keeps correcting, or to learn from past sessions.
license: MIT
disable-model-invocation: true
compatibility: Requires Node 22 or later, and git for edits.mjs.
---

Every correction the user typed twice is an instruction that lives in the wrong place, or nowhere. So is every edit they made by hand to text an agent wrote. Find them, count them, and say where each belongs.

Two modes: a period (the default, the last two weeks) or **one session** (its id or transcript path, for example right after it ends).

## Steps

1. **List the prompts.** From this skill's folder:

   ```
   node scripts/prompts.mjs --since <date>
   node scripts/prompts.mjs --session <id or path to .jsonl>
   ```

   It reads Claude Code's and Codex's session folders by default; pass another agent's folder as an argument. Secrets are already masked; never copy one back from anywhere else.

   **For one session, also list the user's hand edits** (Claude Code sessions only):

   ```
   node scripts/edits.mjs --session <id or path to .jsonl>
   ```

   For each file the session wrote, it word-diffs the agent's version against what came next (the next agent write in any session, or the file now) and names the skills the session loaded. A change with no command run in between is the user's. A change listed with commands may be partly an agent's script or formatter: read it against them. `(a command had written: ...)` under a new line is the line an agent's command wrote there, so the pair is the user's rewording.

2. **Mark the corrections.** Read every prompt with the reply before it. A correction repeats an earlier request, says no, again, wrong or why did you, restates a rule, asks "are you sure" or "did you check", or asks "what next" after the agent stopped. Not corrections: new requests, one-off product choices (a colour, a name), thanks. Each hand edit is a correction too: say what it changed as a rule ("under 1¢" to "< $0.01": numbers in figures are symbols and digits). Leave out edits that only change facts or content (a new number, a new paragraph); they teach nothing about how to write.

3. **Group them into lessons**, one general line each, and count the sessions and the projects each came from. Over a period, a lesson from one session is noise; leave it out. For one session, keep a lesson the user corrected twice or more in it, or once when step 4 finds it already written down (it was missed).

4. **Look for each lesson where it might already be written:** the user's own instructions (`~/.claude/AGENTS.md`, `~/.codex/AGENTS.md`, `CLAUDE.md` beside them), each project's `AGENTS.md` or `CLAUDE.md`, the agent's memory files, installed skills. **A lesson that is written down and still repeated is the most important finding:** it sits at the wrong level (a rule in one project, needed in all) or is worded so it is not followed. Name the file it is in.

5. **Give each lesson one home:**

   | Seen in | Home |
   |---|---|
   | Two or more projects | The user's own instructions |
   | One project | That project's `AGENTS.md` (or the instruction file it already uses) |
   | A skill the agent used, done wrong | That skill's gotchas |
   | A hand edit to text a skill shaped (a post, a doc) | That skill's rules, as the rule the edit shows |
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
- The user's hand edits never appear in what they typed: in one session they reworded a post's figures ("under 1¢" to "< $0.01", "about 200 ms" to "~ 200 ms", "against" to "vs") without a word in chat. Without `scripts/edits.mjs` those rules were found only because an agent diffed by hand.
- An agent that edits through shell scripts leaves no edit record, so its own text can look like the user's. `scripts/edits.mjs` drops changed lines whose text is in a command run in between; check what is left against the listed commands before calling it the user's.
