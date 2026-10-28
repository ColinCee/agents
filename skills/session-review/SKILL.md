---
name: session-review
description: Reviews the coding-agent sessions that ended on one day for what the user corrected, in chat or by editing the agent's text, and says where each fix belongs. Use when asked what the user keeps correcting, or to learn from past sessions.
license: MIT
disable-model-invocation: true
compatibility: Requires uv (it fetches DuckDB) and git.
---

Every correction the user made is an instruction that lives in the wrong place, or nowhere; every rule the agent broke unnoticed is one that isn't working. Find both and say where each belongs.

1. **List the day's sessions** with DuckDB (Reading the sessions, below): every session with a message from the user that day, with its project and how many messages; a session that runs across days is reviewed for that day's messages. Default: yesterday. Timestamps are UTC.
2. **Read in parallel.** Give each long session, and the short ones together, to two subagents on a smaller, cheaper model, each with the section below and one brief: `references/corrections.md` (what the user corrected) or `references/broken-rules.md` (what the agent did against its rules); one job each keeps both simple. Each returns lessons with session ids. Never pass on a token, key or password.
3. **Merge** the lessons, counting sessions, projects and days.
4. **Look for each lesson where it may already be written:** the user's own instructions (`~/.claude/AGENTS.md` and `CLAUDE.md` beside it), each project's `AGENTS.md` or `CLAUDE.md`, the agent's memory files, installed skills. **A lesson written down and still corrected is the most important finding:** the rule sits at the wrong level or is worded so it is not followed. Name the file, and check the agent reads it and since when.
5. **Give each lesson one home**, and say which lower copy to delete when a rule moves up:

   | Seen in | Home |
   |---|---|
   | Two or more projects | The user's own instructions |
   | One project | That project's `AGENTS.md` (or the instruction file it already uses) |
   | A skill the agent used, done wrong | That skill's gotchas |
   | A hand edit to text a skill shaped (a post, a doc) | That skill's rules, as the rule the edit shows |
   | The same steps asked for in three or more sessions | A new skill candidate |

6. **Report, and change nothing:** these are the user's instruction files. The table below, then one line on what was left out and why. A token, key or password in a transcript: say there is one and that it should be rotated.

   | Lesson | Kind | Sessions | Projects | Already written in | Home |
   |---|---|---|---|---|---|

7. **Improve this skill.** When a step misled you or a better way turned up, fix it here, in the same change, keeping it as short as it was or shorter.

## Reading the sessions

Claude Code keeps each session in `~/.claude/projects/<project>/<session id>.jsonl`, one JSON entry per line. Query them with DuckDB; write the SQL to a file and run it with:

```
uv run --with duckdb --with pytz python -c "import duckdb,sys; [print(*r, sep=' | ') for r in duckdb.sql(sys.stdin.read()).fetchall()]" < query.sql
```

Read lines as raw JSON and pull out the fields you need (reading every column at once runs out of memory). Add `filename=true` to `read_ndjson_objects` for the project: the folder above the file. Cut long text with `left()` when listing, then read in full what matters. One session's messages in order:

```sql
with e as (select json j from read_ndjson_objects('<home>/.claude/projects/*/*.jsonl', ignore_errors=true, maximum_object_size=268435456)),
m as (
  select distinct on (j->>'uuid') j->>'sessionId' session, j->>'timestamp' ts, j->>'type' kind, j->>'turnOrigin' origin,
    case when json_type(j->'message'->'content') = 'VARCHAR' then j->'message'->>'content'
         else array_to_string(json_extract_string(j, '$.message.content[*].text'), chr(10)) end body
  from e where j->>'sessionId' like '<id>%' and j->>'type' in ('user', 'assistant') and not coalesce((j->>'isMeta')::bool, false))
select ts, kind, origin, body from m where body <> '' order by ts
```

Where things are:
- A `user` entry holding a `tool_result` is tool output; `isMeta` is a harness note, `isSidechain` a subagent's, `isCompactSummary` a compaction summary.
- Only `turnOrigin = 'human'` is the user typing; anything else is the harness or another agent.
- A message typed while the agent worked is only an `attachment` with `attachment.type = 'queued_command'`, text in `attachment.prompt`: add these to the user's messages, except ones starting `<agent-message` or `<task-notification`.
- The rules the session had: `attachment.type = 'instructions'`, with `files[].path` and `.content`, repeated when a file changes. Skills it loaded: `Skill` tool calls, `input.skill`.
- The desktop app's closing box is a `tool_use` whose name ends in `wrap_up`: `input.recap`, `input.ask` (where a "Shall I…?" ending hides), and `input.actions[].message`, which a button click sends as if typed.
- A continued session copies its parent's entries with the same `uuid`: count each `uuid` once, under the session whose file was created first.
- Tool calls are `tool_use` blocks in an assistant entry: `$.message.content[*].name` and `.input` (a Bash `command`, an edit's file). A path with `[*]` returns a list: wrap it in `array_to_string`. Put `j->'a'->>'b'` in brackets before comparing it.
- File writes: `toolUseResult` on a `user` entry has `filePath`, then `content` (a new or rewritten file) or `originalFile` with `oldString` and `newString` (an edit).

## Gotchas

- A rule saved in one project did not stop the same correction in another: 20 of 85 lessons in one review were written down already.
- Rules in `~/.claude/AGENTS.md` went unread for weeks: Claude Code reads `~/.claude/CLAUDE.md`, which must import it.
- Hand edits never show in chat: one user reworded a post's figures ("under 1¢" to "< $0.01") without a word.
- An agent that edits through shell scripts leaves no edit record, so its text can look like a hand edit.
