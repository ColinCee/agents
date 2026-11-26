---
name: reviewing-sessions
description: Reviews one day's agent sessions for what the user corrected and rules the agent broke unnoticed, fixes each where it belongs, and measures whether the fix works. Use when asked to review a day's sessions, or what the user keeps correcting.
license: MIT
compatibility: Requires uv, git, and Node (the agents repo's install-home).
---

Every correction the user made, and every rule the agent broke unnoticed, is an instruction misplaced, misworded or missing.

1. **List the day's sessions** with DuckDB (below): every session with a message from the user that day, with project and message count; a session across days is reviewed for that day only. Default: yesterday, in UTC.
2. **Read in parallel.** Give each long session, and the short ones together, to two cheaper-model subagents, each with the section below and one brief, `references/corrections.md` or `references/broken-rules.md`; the second gets each agent's timed `Rule trials:` lines. Pass on no token, key or password.
3. **Check, then merge.** For each broken rule, look up its quoted words in the last copy of the rule's file (`files[].path`) or skill text sent before that turn (or a trial rule the hook gave it, or a rule the agent wrote itself earlier), and the turn itself; drop it if either is missing (3 of 40 were). Merge, counting sessions, projects and days; a lesson from both briefs is kind `both`, else `correction` or `broken rule`.
4. **Look for each lesson where it may already be written:** the user's own instructions (`~/.claude/AGENTS.md` and `CLAUDE.md` beside it), each project's `AGENTS.md` or `CLAUDE.md`, installed skills. **A lesson written down and still corrected, or broken, is the most important finding**: the rule is at the wrong level or worded so it is not followed. Name the file, and check the agent reads it and since when. Run `npm run install-home` in an updated main checkout of the agents repo: any installed copy that differs is a lesson (an edit that the next install would lose). Read earlier reviews (the last message of each earlier session that ran this skill): a lesson back once its fix's verdict is not working needs a different fix; back after a fix was proposed and never made, say so.
5. **Give each lesson one home**, and say which lower copy to delete when a rule moves up:

   | Seen in | Home |
   |---|---|
   | Two or more projects | The user's own instructions |
   | One project | That project's `AGENTS.md` (or the instruction file it already uses) |
   | A skill the agent used, done wrong | That skill's gotchas |
   | A hand edit to text a skill shaped (a post, a doc) | That skill's rules, as the rule the edit shows |
   | A rule the agent had and broke | Its file, reworded to name the thing, or moved to where the agent reads it at that step |
   | The same steps asked for in three or more sessions | A new skill candidate |

6. **Log each lesson the same day; change a rule at most once a week, on trial.** Log every sighting in `~/.claude/keep-going/lessons.csv` (day, lesson, fix, file, status: `Open`, `Proposed`, `Merged`, `Working`, `Not working`, `Dropped`); rows match on lesson text, never leave, and a repeat reopens its row. On Mondays, change the line of the one lesson costing him most, through a trial file (`docs/keep-going.md`; CI fails an edit to `home/` rules that is not on trial); a wording that failed twice becomes a hook or check. The rest stay `Open`. Leave `Proposed` only what touches money, privacy, his private data, a destructive step or something public he did not ask for; a line with no verdict yet blocks only another change to that same line. 
   Each fix gets a row in `~/.claude/keep-going/fixes.csv`, its problem in `problems.csv`, and a measure in `measures/measures.sql`: a `chances` row per chance to break it, and a `changes` row dating the change. The tester, its code pinned: `uvx --from git+https://github.com/ColinCee/agent-experiments@6479796cacb62c7b27a41effd7559f9f6b018623 agent-experiments <command>`. Test it: `replay --measure <id> --old <file> --new <file> --in-force old|new --model <model>` on the trial's Off and On (hours); if it works there or cannot test it, a trial file (`docs/keep-going.md`), and a mistake under 2 chances a day is replayed on day 1. Each day `daily --agents-repo <updated main checkout>` writes `~/.claude/keep-going/overview.html`, linked in the report: each trial's verdict on day 3 of real use, and the rules and skills in force that need attention: a mistake above its usual range (a lesson), or no use in 30 days (trim it); exits 1 on a wrong trial file or one testing past its verdict. Works: settle it; worse: a hook or check; no big effect: cut the rule and date the cut in `changes`. A verdict gets one `docs/findings.md` line, never reported again. The day's sightings also go in `measures/review.csv`. A change to when agents stop is its own pull request and a `versions.csv` row. Before `daily`, run `uv run --with duckdb python ~/.claude/keep-going/rule-use/day.py <day>`, which the page reads; a skill's loads (`tools/skill-use.sql`) leave out subagents, so an unused one is a candidate to delete unless reviewers load it.
   Report in at most six short lines, plainly, with no file paths or pull request numbers: the week's rule change and the review's fixes to itself, new verdicts (the change and its range), the day's go-aheads and needless stops per 100, how many problems are open, and a link to the overview page, which holds the rest. Beyond the six, only what waits on him: each `Proposed` fix (what and why), and a token, key or password seen in a transcript, to rotate. Once fixes merge, run `npm run install-home -- --apply` in an updated main checkout.

7. **Check and fix the review itself.** Before reporting, check each step's output against its source: a reader that read the wrong session or missed one (compare the stops file), a fix with no counted measure or one that cannot see its failure, labeller answers over a week old, a page he cannot open where he reads it. Fix each here or in its tool in the same change, keeping this skill as short as it was or shorter.

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
- The rules the session had: `attachment.type = 'instructions'`, with `files[].path` and `.content`, repeated when a file changes; rules on trial are in `attachment.type = 'hook_additional_context'`, after a first line `Rule trials:` naming the session's groups. A loaded skill's text is the `isMeta` entry after its `Skill` call, starting `Base directory for this skill:`.
- The desktop app's closing box is a `tool_use` whose name ends in `wrap_up`: `input.recap`, `input.ask`, and `input.actions[].message`, which a button click sends as if typed.
- A continued session copies its parent's entries with the same `uuid`: count each `uuid` once, under the session whose file was created first.
- Tool calls are `tool_use` blocks in an assistant entry: `$.message.content[*].name` and `.input` (a Bash `command`, an edit's file). A path with `[*]` returns a list: wrap it in `array_to_string`. Put `j->'a'->>'b'` in brackets before comparing it (else `json_extract(JSON, BOOLEAN)`).
- File writes: `toolUseResult` on a `user` entry has `filePath`, then `content` (a new or rewritten file) or `originalFile` with `oldString` and `newString` (an edit).

## Gotchas

- Rules in `~/.claude/AGENTS.md` went unread: Claude Code reads `~/.claude/CLAUDE.md`, which must import it.
