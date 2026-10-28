---
name: session-review
description: Reviews one day's coding-agent sessions for what the user corrected, in chat or by hand, and rules the agent broke unnoticed, and says where each fix belongs. Use when asked what the user keeps correcting, or to learn from past sessions.
license: MIT
disable-model-invocation: true
compatibility: Requires uv (it fetches DuckDB) and git.
---

Every correction the user made, and every rule the agent broke unnoticed, is an instruction misplaced, misworded or missing. Find them; say where each belongs.

1. **List the day's sessions** with DuckDB (Reading the sessions, below): every session with a message from the user that day, with project and message count; a session across days is reviewed for that day only. Default: yesterday, in UTC.
2. **Read in parallel.** Give each long session, and the short ones together, to two subagents on a cheaper model, each with the section below and one brief, `references/corrections.md` or `references/broken-rules.md`, so each has one job. Never pass on a token, key or password.
3. **Check, then merge.** For each broken rule, look up its quoted words in an `instructions` copy or skill text sent before that turn (or a rule the agent wrote itself), and the turn itself; drop it if either is missing (3 of 40 were). Merge, counting sessions, projects and days; a lesson from both briefs is kind `both`, else `correction` or `broken rule`.
4. **Look for each lesson where it may already be written:** the user's own instructions (`~/.claude/AGENTS.md` and `CLAUDE.md` beside it), each project's `AGENTS.md` or `CLAUDE.md`, the agent's memory files, installed skills. **A lesson written down and still corrected, or broken, is the most important finding**: the rule is at the wrong level or worded so it is not followed. Name the file, and check the agent reads it and since when. Read earlier reviews (the last message of each earlier session that ran this skill): a lesson back after its fix landed means the fix failed, so propose a different one; back after a fix was proposed and never made, say so.
5. **Give each lesson one home**, and say which lower copy to delete when a rule moves up:

   | Seen in | Home |
   |---|---|
   | Two or more projects | The user's own instructions |
   | One project | That project's `AGENTS.md` (or the instruction file it already uses) |
   | A skill the agent used, done wrong | That skill's gotchas |
   | A hand edit to text a skill shaped (a post, a doc) | That skill's rules, as the rule the edit shows |
   | A rule the agent had and broke | Its file, reworded to name the thing, or moved to where the agent reads it at that step |
   | The same steps asked for in three or more sessions | A new skill candidate |

6. **Report, and change nothing:** these are the user's instruction files. The table below, then one line on what was left out and why. A token, key or password in a transcript: say there is one, to rotate.

   | Lesson | Kind | Sessions | Projects | Already written in | Home |
   |---|---|---|---|---|---|

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
- The user typing is `turnOrigin = 'human'`, or a message typed while the agent worked: an `attachment` with `attachment.type = 'queued_command'` and `commandMode = 'prompt'` (the query above includes it), not starting with `<`, which is another agent.
- The rules the session had: `attachment.type = 'instructions'`, with `files[].path` and `.content`, repeated when a file changes. A loaded skill's text is the `isMeta` entry after its `Skill` call, starting `Base directory for this skill:`.
- The desktop app's closing box is a `tool_use` whose name ends in `wrap_up`: `input.recap`, `input.ask` (where a "Shall I…?" ending hides), and `input.actions[].message`, which a button click sends as if typed.
- A continued session copies its parent's entries with the same `uuid`: count each `uuid` once, under the session whose file was created first.
- Tool calls are `tool_use` blocks in an assistant entry: `$.message.content[*].name` and `.input` (a Bash `command`, an edit's file). A path with `[*]` returns a list: wrap it in `array_to_string`. Put `j->'a'->>'b'` in brackets before comparing it (else `json_extract(JSON, BOOLEAN)`).
- File writes: `toolUseResult` on a `user` entry has `filePath`, then `content` (a new or rewritten file) or `originalFile` with `oldString` and `newString` (an edit).

## Gotchas

- Rules in `~/.claude/AGENTS.md` went unread: Claude Code reads `~/.claude/CLAUDE.md`, which must import it.
