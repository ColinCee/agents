---
name: reviewing-sessions
description: Reviews one day's coding-agent sessions for what the user corrected and rules the agent broke unnoticed, fixes each where it belongs, and measures whether the fix works. Use when asked what the user keeps correcting, or to learn from past sessions.
license: MIT
disable-model-invocation: true
compatibility: Requires uv (it fetches DuckDB) and git. Step 6 keeps its records in ~/.claude/keep-going (see docs/keep-going.md).
---

Every correction the user made, and every rule the agent broke unnoticed, is an instruction misplaced, misworded or missing. Find them, fix each where it belongs, and measure whether the fix works.

1. **List the day's sessions** with DuckDB (below): every session with a message from the user that day, with project and message count; a session across days is reviewed for that day only. Default: yesterday, in UTC.
2. **Read in parallel.** Give each long session, and the short ones together, to two subagents on a cheaper model, each with the section below and one brief, `references/corrections.md` or `references/broken-rules.md`, so each has one job. Never pass on a token, key or password.
3. **Check, then merge.** For each broken rule, look up its quoted words in the last copy of the rule's file (`files[].path`) or skill text sent before that turn (or a rule the agent wrote itself earlier), and the turn itself; drop it if either is missing (3 of 40 were). Merge, counting sessions, projects and days; a lesson from both briefs is kind `both`, else `correction` or `broken rule`.
4. **Look for each lesson where it may already be written:** the user's own instructions (`~/.claude/AGENTS.md` and `CLAUDE.md` beside it), each project's `AGENTS.md` or `CLAUDE.md`, installed skills. **A lesson written down and still corrected, or broken, is the most important finding**: the rule is at the wrong level or worded so it is not followed. Name the file, and check the agent reads it and since when. Run `npm run install-home` in an up-to-date main checkout of the agents repo: any installed copy that differs is a lesson (an edit that the next install would lose). Read earlier reviews (the last message of each earlier session that ran this skill): a lesson back once its fix's verdict is not working needs a different fix; back after a fix was proposed and never made, say so.
5. **Give each lesson one home**, and say which lower copy to delete when a rule moves up:

   | Seen in | Home |
   |---|---|
   | Two or more projects | The user's own instructions |
   | One project | That project's `AGENTS.md` (or the instruction file it already uses) |
   | A skill the agent used, done wrong | That skill's gotchas |
   | A hand edit to text a skill shaped (a post, a doc) | That skill's rules, as the rule the edit shows |
   | A rule the agent had and broke | Its file, reworded to name the thing, or moved to where the agent reads it at that step |
   | The same steps asked for in three or more sessions | A new skill candidate |

6. **Fix each lesson the same day, then measure it.** Log every sighting in `~/.claude/keep-going/lessons.csv` (day, lesson, fix, file, status: `Open`, `Proposed`, `Merged`, `Working`, `Not working`, `Dropped`); rows match on lesson text, never leave, and a repeat reopens its row. Act on a first sighting when the fix shrinks the rules (reword, merge or delete a line); otherwise log it `Open`. Add a line only for a lesson seen again or a costly one (money, data loss, or over an hour of his time), and delete a line in the same file or a lesser-used one; moving a line counts only if its source is deleted; a new skill candidate counts as an addition. Leave `Proposed` only what touches money, privacy, his private data, a destructive step or something public he did not ask for; a line with no verdict yet blocks only another change to that same line. 
   Each fix gets a row in `~/.claude/keep-going/fixes.csv` and a measure: a query in `measures/measures.sql` counting, per day over every session, chances to break the rule and misses; else `review`, and each review adds the day's sightings to `measures/review.csv`. A change to when agents stop is its own pull request and a new row of `versions.csv` (`docs/keep-going.md`). Before is up to the day the fix was installed, after is from the day after. Verdict at 30 chances after (7 days for `review`): working if misses fell by half or more. Each day also run `uv run --with duckdb python ~/.claude/keep-going/rule-use/day.py <day>`; a line with no chance in 30 days moves out of the every-turn file, one often broken is a lesson. And `duckdb -f tools/skill-use.sql` in the agents repo: an installed skill with no load in 30 days is a candidate to delete, unless reviewers load it (sub-agents are not counted).
   Report in at most six short lines he can read at a glance, in plain words with no file paths or pull request numbers: what changed today (each fix in a few words), new verdicts (before → after), the day's go-aheads and needless stops per 100 (from step 6's labels), how many lessons are open, and a link to the review page, which holds the rest. Beyond the six, only what waits on him: each `Proposed` fix (what and why), and a token, key or password seen in a transcript, to rotate. Last, once the fixes have merged, run `npm run install-home -- --apply` in an updated main checkout, so the user's PC has what merged.

7. **Improve this skill.** When a step misled you or a better way turned up, fix it here, in the same change, keeping it as short as it was or shorter.

## Reading the sessions

Claude Code keeps each session in `~/.claude/projects/<project>/<session id>.jsonl`, one JSON entry per line. Query them with DuckDB; write the SQL to a file and run it with:

```
uv run --with duckdb --with pytz python -c "import duckdb,sys; [print(*r, sep=' | ') for r in duckdb.sql(sys.stdin.read()).fetchall()]" < query.sql
```

Read lines as raw JSON and pull out the fields you need (all columns at once runs out of memory). Add `filename=true` to `read_ndjson_objects` for the project: the folder above the file. Cut long text with `left()` when listing, then read what matters in full. One session's messages in order:

```sql
with e as (select json j from read_ndjson_objects('<home>/.claude/projects/*/*.jsonl', ignore_errors=true, maximum_object_size=268435456)),
m as (
  select distinct on (j->>'uuid') j->>'sessionId' session, j->>'timestamp' ts, j->>'type' kind, j->>'turnOrigin' origin,
    case when (j->'attachment'->>'type') = 'queued_command' then j->'attachment'->>'prompt'
         when json_type(j->'message'->'content') = 'VARCHAR' then j->'message'->>'content'
         else array_to_string(json_extract_string(j, '$.message.content[*].text'), chr(10)) end body
  from e where j->>'sessionId' like '<id>%' and j->>'type' in ('user', 'assistant', 'attachment') and not coalesce((j->>'isMeta')::bool or (j->>'isCompactSummary')::bool, false))
select ts, kind, origin, body from m where body <> '' order by ts
```

Where things are:
- A `user` entry holding a `tool_result` is tool output; `isMeta` is a harness note, `isSidechain` a subagent's, `isCompactSummary` a compaction summary, even with `turnOrigin = 'human'`.
- The user typing is `turnOrigin = 'human'`, or a message typed while the agent worked: an `attachment` with `attachment.type = 'queued_command'` and `commandMode = 'prompt'` whose text does not start with `<` (the query above includes it); text starting with `<` is another agent.
- The rules the session had: `attachment.type = 'instructions'`, with `files[].path` and `.content`, repeated when a file changes. A loaded skill's text is the `isMeta` entry after its `Skill` call, starting `Base directory for this skill:`.
- The desktop app's closing box is a `tool_use` whose name ends in `wrap_up`: `input.recap`, `input.ask`, and `input.actions[].message`, which a button click sends as if typed.
- A continued session copies its parent's entries with the same `uuid`: count each `uuid` once, under the session whose file was created first.
- Tool calls are `tool_use` blocks in an assistant entry: `$.message.content[*].name` and `.input` (a Bash `command`, an edit's file). A path with `[*]` returns a list: wrap it in `array_to_string`. Put `j->'a'->>'b'` in brackets before comparing it (else `json_extract(JSON, BOOLEAN)`).
- File writes: `toolUseResult` on a `user` entry has `filePath`, then `content` (a new or rewritten file) or `originalFile` with `oldString` and `newString` (an edit).

## Gotchas

- Rules in `~/.claude/AGENTS.md` went unread: Claude Code reads `~/.claude/CLAUDE.md`, which must import it.
