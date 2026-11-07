-- One stop's thread for the stop-labelling page: the two turns before the stop, the stop, and the reply after it.
-- Run: duckdb -cmd "SET VARIABLE sid = '<sid>'" -cmd "SET VARIABLE reply_ts = '<reply_ts>'" -cmd "SET VARIABLE out = '<file>'" -f tools/stop-thread.sql
-- (sid and reply_ts as stop-score.sql wrote them)
-- Writes a JSON array of {rel, who, hm, txt}: rel 0 is the turn that ended in the stop, 1 what followed.

SET VARIABLE home = replace(coalesce(getenv('USERPROFILE'), getenv('HOME')), '\', '/');

CREATE TEMP TABLE ev AS
SELECT j ->> 'type' AS type, TRY_CAST(j ->> 'timestamp' AS TIMESTAMP) AS ts, j -> 'origin' ->> 'kind' AS origin, j -> 'message' AS msg
FROM (SELECT json AS j FROM read_json_objects(getvariable('home') || '/.claude/projects/*/' || getvariable('sid') || '.jsonl',
                                              format = 'newline_delimited', ignore_errors = true))
WHERE j ->> 'type' IN ('user', 'assistant')
QUALIFY row_number() OVER (PARTITION BY j ->> 'uuid' ORDER BY ts) = 1;

CREATE TEMP TABLE turns AS
SELECT *, sum(CASE WHEN type = 'user' AND origin = 'human' THEN 1 ELSE 0 END) OVER (ORDER BY ts) AS turn FROM ev;

SET VARIABLE reply_turn = (SELECT max(turn) FROM turns WHERE ts <= CAST(getvariable('reply_ts') AS TIMESTAMP));

COPY (
  SELECT turn - getvariable('reply_turn') + 1 AS rel,
         CASE WHEN type = 'user' THEN 'Colin' ELSE 'Agent' END AS who, strftime(ts, '%m-%d %H:%M') AS hm,
         CASE WHEN type = 'user' THEN trim(regexp_replace(
                CASE WHEN json_type(msg -> 'content') = 'VARCHAR' THEN msg ->> 'content'
                     ELSE array_to_string(json_extract_string(msg -> 'content', '$[*].text'), '\n') END,
                '(?s)<system-reminder>.*?</system-reminder>', '', 'g'))
              ELSE (SELECT string_agg(CASE WHEN b ->> 'type' = 'text' THEN b ->> 'text'
                                           WHEN b ->> 'type' = 'tool_use' THEN '[' || (b ->> 'name') || ': ' ||
                                             left(coalesce(b -> 'input' ->> 'description', b -> 'input' ->> 'command', b -> 'input' ->> 'file_path', ''), 90) || ']' END, ' ')
                    FROM (SELECT unnest(json_extract(msg -> 'content', '$[*]')) AS b)) END AS txt
  FROM turns
  WHERE turn BETWEEN getvariable('reply_turn') - 3 AND getvariable('reply_turn')
    AND (type = 'assistant' OR origin = 'human' OR (msg ->> 'content') LIKE 'Stop hook feedback:%')
  ORDER BY ts
) TO (getvariable('out')) (FORMAT json, ARRAY true);
