-- The daily score of agent stops, from the user's own replies (no model labels), and the day's stops for labelling.
-- Run: duckdb -cmd "SET VARIABLE day = '2026-11-07'" -f tools/stop-score.sql
-- Writes ~/.claude/keep-going/measures/stop-score/<day>.csv (one row per half of the ended reminder trial) and ~/.claude/keep-going/stops/<day>.json;
-- both folders must exist.

SET VARIABLE home = replace(coalesce(getenv('USERPROFILE'), getenv('HOME')), '\', '/');
SET VARIABLE kg = getvariable('home') || '/.claude/keep-going';

-- Main-session transcripts only (sub-agents sit one folder deeper); a continued session repeats lines, so one per uuid.
CREATE TEMP TABLE ev AS
SELECT j ->> 'sessionId' AS sid, j ->> 'type' AS type, TRY_CAST(j ->> 'timestamp' AS TIMESTAMP) AS ts,
       j -> 'origin' ->> 'kind' AS origin, j ->> 'entrypoint' AS ep, j -> 'message' AS msg
FROM (SELECT json AS j FROM read_json_objects(getvariable('home') || '/.claude/projects/*/*.jsonl',
                                              format = 'newline_delimited', ignore_errors = true))
WHERE CAST(TRY_CAST(j ->> 'timestamp' AS TIMESTAMP) AS DATE) = CAST(getvariable('day') AS DATE)
QUALIFY row_number() OVER (PARTITION BY j ->> 'uuid' ORDER BY ts) = 1;

-- The halves of the reminder trial (docs/keep-going.md): an even last hex digit of the session id got the reminder.
-- Kept so every day's file has the same columns.
CREATE TEMP TABLE sess AS
SELECT DISTINCT sid, CASE WHEN (instr('0123456789abcdef', right(sid, 1)) - 1) % 2 = 0 THEN 'on' ELSE 'off' END AS arm
FROM ev WHERE coalesce(ep, '') NOT LIKE 'sdk%';

CREATE TEMP TABLE turns AS
SELECT e.*, s.arm,
       -- The app puts its own notes in <system-reminder> blocks inside the user's message; only his words count.
       regexp_replace(regexp_replace(CASE WHEN json_type(msg -> 'content') = 'VARCHAR' THEN msg ->> 'content'
                                          ELSE array_to_string(json_extract_string(msg -> 'content', '$[*].text'), chr(10)) END,
                                     '(?s)<system-reminder>.*?</system-reminder>', '', 'g'),
                      '^\s+|\s+$', '', 'g') AS txt, -- trim() keeps the newlines those blocks leave
       sum(CASE WHEN type = 'user' AND origin = 'human' THEN 1 ELSE 0 END) OVER (PARTITION BY e.sid ORDER BY ts) AS turn
FROM ev e JOIN sess s USING (sid);

-- The closing question and buttons the agent offered before each of the user's messages.
CREATE TEMP TABLE asks AS
SELECT sid, turn, last(b -> 'input' ORDER BY ts) AS wrap
FROM (SELECT sid, turn, ts, unnest(json_extract(msg -> 'content', '$[*]')) AS b FROM turns WHERE type = 'assistant')
WHERE b ->> 'name' = 'mcp__ccd_turn__wrap_up'
GROUP BY ALL;

-- A go-ahead: the user's whole reply, typed or a clicked reply button, only lets the agent carry on, so its stop asked
-- for permission it already had. A reply that adds an instruction ("ok but change the colour") is not one.
CREATE TEMP TABLE replies AS
SELECT t.sid, t.arm, t.turn, t.ts, t.txt,
       t.txt IN (SELECT unnest(json_extract_string(a.wrap, '$.actions[*].label')) UNION ALL
                 SELECT unnest(json_extract_string(a.wrap, '$.actions[*].message'))) AS clicked, -- a click sends either
       length(t.txt) < 60 AND (
         (NOT contains(t.txt, '?') AND NOT regexp_matches(lower(t.txt), '\b(but|instead|except)\b') AND regexp_matches(lower(t.txt),
           '^(yes|yeah|yep|ok|okay|sure|go ahead|go on|go$|do it|do that|continue|carry on|proceed|ship it|merge|lgtm|sounds good|i suppose so|keep going|you can do (it|that)|just do it)'))
         OR regexp_matches(lower(t.txt), '^(now what|what now|what next|what.?s left|well\?|why did you stop|why stop)')) AS goahead
FROM turns t LEFT JOIN asks a ON a.sid = t.sid AND a.turn = t.turn - 1
WHERE t.type = 'user' AND t.origin = 'human' AND t.turn > 1; -- a session's opening message answers no stop

CREATE TEMP TABLE score AS
SELECT getvariable('day') AS day, s.arm,
       count(DISTINCT s.sid) AS sessions,
       (SELECT count(*) FROM replies r WHERE r.arm = s.arm) AS replies,
       (SELECT count(*) FROM replies r WHERE r.arm = s.arm AND r.goahead) AS goaheads,
       (SELECT count(*) FROM replies r WHERE r.arm = s.arm AND r.goahead AND r.clicked) AS clicked_goaheads,
       (SELECT count(*) FROM turns t WHERE t.arm = s.arm AND t.type = 'user' AND t.txt LIKE 'Stop hook feedback:%Keep-going%') AS reminders,
       (SELECT round(sum(TRY_CAST(msg -> 'usage' ->> 'input_tokens' AS BIGINT) + TRY_CAST(msg -> 'usage' ->> 'cache_read_input_tokens' AS BIGINT)
               + TRY_CAST(msg -> 'usage' ->> 'cache_creation_input_tokens' AS BIGINT)) / 1e6, 1)
        FROM (SELECT DISTINCT ON (msg ->> 'id') msg FROM turns t WHERE t.arm = s.arm AND t.type = 'assistant')) AS input_mtok
FROM sess s GROUP BY s.arm ORDER BY s.arm;

COPY score TO (getvariable('kg') || '/measures/stop-score/' || getvariable('day') || '.csv') (HEADER);

-- Each stop the user answered: what he had asked, the agent's last actions and words, and his reply. Labelling reads this.
COPY (
  SELECT r.sid, r.arm, strftime(r.ts, '%Y-%m-%dT%H:%M:%S.%g') AS reply_ts,
         (SELECT right(p.txt, 1200) FROM replies p WHERE p.sid = r.sid AND p.turn = r.turn - 1) AS colin_asked,
         (SELECT right(string_agg(CASE WHEN b ->> 'type' = 'text' THEN b ->> 'text'
                                       WHEN b ->> 'type' = 'tool_use' THEN '[' || (b ->> 'name') || ': ' ||
                                         left(coalesce(b -> 'input' ->> 'description', b -> 'input' ->> 'command', b -> 'input' ->> 'file_path', ''), 90) || ']' END,
                                  '\n' ORDER BY ts), 3000)
          FROM (SELECT ts, unnest(json_extract(msg -> 'content', '$[*]')) AS b FROM turns t
                WHERE t.sid = r.sid AND t.turn = r.turn - 1 AND t.type = 'assistant')) AS agent_turn,
         json_extract_string(a.wrap, '$.ask') AS agent_ask,
         left(r.txt, 800) AS colin_reply, r.clicked, r.goahead
  FROM replies r LEFT JOIN asks a ON a.sid = r.sid AND a.turn = r.turn - 1
  WHERE r.turn > 1
) TO (getvariable('kg') || '/stops/' || getvariable('day') || '.json') (FORMAT json, ARRAY true);

SELECT * FROM score;
