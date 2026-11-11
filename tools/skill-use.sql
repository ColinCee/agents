-- How often each installed skill was loaded over the last 30 days of session transcripts: by an agent (the Skill tool),
-- by an agent reading the installed SKILL.md (how a scheduled run uses a skill that loads only when named), or by the
-- user (a slash command). Sub-agent loads are not counted (their transcripts sit past the Windows path limit), so a
-- skill that reviewers load can read lower than it is.
-- Run: duckdb -f tools/skill-use.sql     (or -cmd "SET VARIABLE days = 7" first)
SET VARIABLE home = replace(coalesce(getenv('USERPROFILE'), getenv('HOME')), '\', '/');
SET VARIABLE days = coalesce(getvariable('days'), 30);

WITH e AS (
  SELECT json AS j FROM read_ndjson_objects(getvariable('home') || '/.claude/projects/*/*.jsonl',
                                            ignore_errors = true, maximum_object_size = 268435456)),
-- A continued session repeats lines, so one per uuid.
m AS (
  SELECT DISTINCT ON (j ->> 'uuid') j ->> 'sessionId' AS sid, left(j ->> 'timestamp', 10) AS day, j ->> 'type' AS type,
         j ->> 'turnOrigin' AS origin, j -> 'message' -> 'content' AS content
  FROM e WHERE (j ->> 'type') IN ('assistant', 'user')
    AND TRY_CAST(j ->> 'timestamp' AS TIMESTAMP) >= current_date - CAST(getvariable('days') AS INTEGER)),
agent AS (
  SELECT sid, day, b -> 'input' ->> 'skill' AS skill, 'agent' AS how
  FROM (SELECT sid, day, unnest(json_extract(content, '$[*]')) AS b FROM m WHERE type = 'assistant')
  WHERE (b ->> 'type') = 'tool_use' AND (b ->> 'name') = 'Skill'),
-- Typed by the user or stored in a scheduled task; the app's own commands (/clear, /advisor) have no origin.
typed AS (
  SELECT sid, day, regexp_extract(txt, '<command-name>/([^<]+)</command-name>', 1) AS skill, 'user' AS how
  FROM (SELECT sid, day, CASE WHEN json_type(content) = 'VARCHAR' THEN content ->> '$'
                              ELSE array_to_string(json_extract_string(content, '$[*].text'), ' ') END AS txt
        FROM m WHERE type = 'user' AND origin IN ('human', 'sdk'))
  WHERE txt LIKE '%<command-name>/%'),
readfile AS (
  SELECT sid, day, regexp_extract(replace(b -> 'input' ->> 'file_path', '\', '/'), '/skills/([^/]+)/SKILL\.md$', 1) AS skill, 'read' AS how
  FROM (SELECT sid, day, unnest(json_extract(content, '$[*]')) AS b FROM m WHERE type = 'assistant')
  -- Only the installed copy: a repo's copy is read to edit or review it, which is not use.
  WHERE (b ->> 'type') = 'tool_use' AND (b ->> 'name') = 'Read'
    AND replace(b -> 'input' ->> 'file_path', '\', '/') LIKE '%/.claude/skills/%/SKILL.md'),
-- A renamed skill keeps its loads under the old name: without this it reads as unused for 30 days. A row can go once
-- its rename is older than the longest window anyone runs.
renamed(was, now) AS (VALUES ('doc-upkeep', 'updating-docs'), ('deciding', 'comparing-options'),
  ('session-review', 'reviewing-sessions'), ('housekeeping', 'tidying-repos'), ('restructuring', 'restructuring-code'),
  ('speed-budgets', 'budgeting-page-performance'), ('homelab-network', 'reaching-homelab-devices')),
loads AS (
  -- A plugin's skill is named plugin:skill; the prefix is dropped, so it counts for an installed skill of that name.
  SELECT sid, day, coalesce(r.now, x.name) AS skill, how
  FROM (SELECT sid, day, regexp_replace(skill, '^.*:', '') AS name, how
        FROM (SELECT * FROM agent UNION ALL SELECT * FROM typed UNION ALL SELECT * FROM readfile)) x
  LEFT JOIN renamed r ON r.was = x.name),
installed AS (
  SELECT regexp_extract(replace(file, '\', '/'), '/skills/([^/]+)/SKILL\.md$', 1) AS skill
  FROM glob(getvariable('home') || '/.claude/skills/*/SKILL.md'))
SELECT i.skill,
       count(*) FILTER (WHERE l.how = 'agent') AS by_agent,
       count(*) FILTER (WHERE l.how = 'read') AS read_as_file,
       count(*) FILTER (WHERE l.how = 'user') AS by_user,
       count(DISTINCT l.sid) AS sessions,
       max(l.day) AS last_day
FROM installed i LEFT JOIN loads l ON l.skill = i.skill
GROUP BY i.skill ORDER BY by_agent + read_as_file + by_user, i.skill;
