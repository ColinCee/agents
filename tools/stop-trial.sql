-- The keep-going trial's verdict: go-aheads per 100 replies in each half, and how sure the gap is.
-- Run: duckdb -cmd "SET VARIABLE start = '<first trial day>'" -f tools/stop-trial.sql   (after stop-score.sql has run each day)
-- Sessions, not replies, were assigned to halves, so the interval resamples whole sessions: one busy session can not
-- decide it alone.

SET VARIABLE home = replace(coalesce(getenv('USERPROFILE'), getenv('HOME')), '\', '/');

CREATE TEMP TABLE sess AS
SELECT arm, sid, count(*) AS replies, sum(goahead::INT) AS goaheads
FROM read_json(getvariable('home') || '/.claude/keep-going/stops/*.json', filename = true)
WHERE regexp_extract(filename, '(\d{4}-\d{2}-\d{2})\.json$', 1) >= getvariable('start')
GROUP BY ALL;

CREATE TEMP TABLE pool AS
SELECT *, row_number() OVER (PARTITION BY arm ORDER BY sid) - 1 AS i, count(*) OVER (PARTITION BY arm) AS n FROM sess;

-- 2,000 resamples: each draws as many sessions as the half has, with replacement.
CREATE TEMP TABLE boot AS
SELECT d.b, d.arm, 100.0 * sum(p.goaheads) / sum(p.replies) AS per100
FROM (SELECT b.range AS b, h.arm, floor(random() * h.n)::INT AS i
      FROM range(2000) b, (SELECT DISTINCT arm, n FROM pool) h, range(h.n)) d
JOIN pool p USING (arm, i)
GROUP BY ALL;

SELECT (SELECT count(*) FROM sess WHERE arm = 'on') AS sessions_on, (SELECT count(*) FROM sess WHERE arm = 'off') AS sessions_off,
       (SELECT round(100.0 * sum(goaheads) / sum(replies), 1) FROM sess WHERE arm = 'on') AS goaheads_per100_on,
       (SELECT round(100.0 * sum(goaheads) / sum(replies), 1) FROM sess WHERE arm = 'off') AS goaheads_per100_off,
       round(quantile_cont(off.per100 - on_.per100, 0.05), 1) AS gap_low_90,
       round(quantile_cont(off.per100 - on_.per100, 0.95), 1) AS gap_high_90
FROM boot off JOIN boot on_ ON off.b = on_.b AND off.arm = 'off' AND on_.arm = 'on';
