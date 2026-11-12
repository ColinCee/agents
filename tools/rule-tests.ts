// The daily evaluation of every rule measure: writes one row per session, takes each rule trial's looks, compares
// settled rules with the sessions that never get them, and flags a measure whose day left its usual range.
// Method and file formats: docs/keep-going.md. Data stays in ~/.claude/keep-going: it is the user's own sessions.

import { spawnSync } from "node:child_process";
import { appendFileSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { compare, type Effect, seeded, type Unit, type Verdict, verdict } from "./rule-stats.js";

const HELP = `Evaluate every rule measure and trial from the session transcripts.

  npm run rule-tests                  # as of yesterday (UTC)
  npm run rule-tests -- --day 2026-01-31 --json

Writes to ~/.claude/keep-going/track: sessions.csv (one row per session and day), session-measures.csv (chances and
misses per session, day and measure), daily.csv, and looks.csv, where a trial's look is written once and never retaken.
  --trials    folder of trial files (default home/trials here)
  --measures  measures file (default ~/.claude/keep-going/measures/measures.sql)

Needs the duckdb command. Exit codes: 0 done, 2 bad arguments or a missing measures file.`;

const HERE = dirname(fileURLToPath(import.meta.url));
const DATA = join(homedir(), ".claude", "keep-going");
// A trial is looked at when its smaller group reaches each size, and a last time after TRIAL_DAYS whatever its size.
// Three looks at p < 0.02 keep false passes near 5%; checking daily at p < 0.05 gave about 30%.
export const LOOKS = [10, 20, 40];
export const LOOK_P = 0.02;
const TRIAL_DAYS = 7; // a rule with no verdict in a week gets a different test, not a longer one
const USUAL_DAYS = 28; // the days a measure's usual range is drawn from
const FLAG_ROUNDS = 2000;
const MIN_GROUP = 5; // below this a resampled range collapses onto the few sessions there are and proves nothing

export type Trial = { id: string; status: "testing" | "settled"; measures: string[]; started: string };
export type Row = {
  root: string;
  day: string;
  model: string;
  stamp: string; // every stamp the hook gave the session and the session it continues, joined
  measure: string;
  chances: number;
  misses: number;
};
export type Look = Effect & {
  trial: string;
  measure: string;
  look: number;
  day: string;
  sessionsOff: number;
  sessionsOn: number;
  verdict: Verdict | "no verdict yet";
};

export function readTrial(id: string, text: string): Trial {
  const field = (name: string) => new RegExp(`^${name}:\\s*(.+?)\\s*$`, "m").exec(text)?.[1] ?? "";
  return {
    id,
    status: field("status") === "settled" ? "settled" : "testing",
    measures: field("measures")
      .split(",")
      .map((m) => m.trim())
      .filter(Boolean),
    started: field("started"),
  };
}

/** A token of the hook's stamp, when every stamp the session got agrees on it: an install or a new trial mid-session
 * changes the stamp's other tokens, and a continuation outside a worktree may draw another group. */
const group = (stamp: string, key: string): string | undefined => {
  const values = new Set([...stamp.matchAll(new RegExp(`(?:^| )${key}=(\\w+)`, "g"))].map((m) => m[1]));
  return values.size === 1 ? [...values][0] : undefined;
};
/** One unit per task, since tasks are what the hook splits: sessions sharing a worktree, or continuing one another. */
function units(rows: Row[]): Unit[] {
  const byTask = new Map<string, Unit>();
  for (const r of rows) {
    const task = group(r.stamp, "task") ?? r.root;
    const u = byTask.get(task) ?? { chances: 0, misses: 0 };
    u.chances += r.chances;
    u.misses += r.misses;
    byTask.set(task, u);
  }
  return [...byTask.values()];
}
const addDays = (day: string, n: number) => new Date(Date.parse(day) + n * 86_400_000).toISOString().slice(0, 10);

/** The looks a trial is due as of `day`, given those already taken. */
export function dueLooks(trial: Trial, rows: Row[], taken: number[], day: string, rng: () => number): Look[] {
  const out: Look[] = [];
  for (const measure of trial.measures) {
    const mine = rows.filter((r) => r.measure === measure && r.day >= trial.started && r.day <= day);
    const off = units(mine.filter((r) => group(r.stamp, trial.id) === "off"));
    const on = units(mine.filter((r) => group(r.stamp, trial.id) === "on"));
    const reached = LOOKS.filter((size) => Math.min(off.length, on.length) >= size).length;
    const last = day >= addDays(trial.started, TRIAL_DAYS) ? LOOKS.length : reached;
    const look = Math.max(reached, last);
    if (look === 0 || taken.includes(look) || !off.length || !on.length) continue;
    const effect = compare(off, on, rng);
    // Only "works" may end a trial early: an early "no useful effect" would be a fourth and fifth chance to be wrong.
    const found = Math.min(off.length, on.length) < MIN_GROUP ? "can't tell" : verdict(effect, LOOK_P);
    out.push({
      ...effect,
      trial: trial.id,
      measure,
      look,
      day,
      sessionsOff: off.length,
      sessionsOn: on.length,
      verdict: found === "works" || look === LOOKS.length ? found : "no verdict yet",
    });
  }
  return out;
}

/** Whether `day`'s miss rate lies outside the middle 98% of what the same number of sessions from the days before gave. */
export function flag(rows: Row[], measure: string, day: string, rng: () => number) {
  const mine = rows.filter((r) => r.measure === measure);
  const today = units(mine.filter((r) => r.day === day));
  const before = units(mine.filter((r) => r.day < day && r.day >= addDays(day, -USUAL_DAYS)));
  const rate = (us: Unit[]) => us.reduce((n, u) => n + u.misses, 0) / us.reduce((n, u) => n + u.chances, 0);
  if (!today.length || before.length < 10) return undefined; // too little history for a usual range
  const rates = Array.from({ length: FLAG_ROUNDS }, () =>
    rate(today.map(() => before[Math.floor(rng() * before.length)] as Unit)),
  ).sort((a, b) => a - b);
  const [low, high] = [
    rates[Math.floor(0.01 * FLAG_ROUNDS)] as number,
    rates[Math.floor(0.99 * FLAG_ROUNDS)] as number,
  ];
  const now = rate(today);
  return { measure, day, sessions: today.length, rate: now, low, high, flagged: now < low || now > high };
}

const sql = (path: string) => `'${path.replaceAll("\\", "/").replaceAll("'", "''")}'`;

function exportTables(measures: string, track: string): Row[] {
  const rowsFile = join(track, "rows.json");
  const script = `.read ${sql(join(HERE, "sessions.sql"))}
.read ${sql(measures)}
COPY (SELECT * FROM sessions ORDER BY "day", s) TO ${sql(join(track, "sessions.csv"))} (HEADER);
CREATE TEMP TABLE per AS SELECT s, "day", measure, count(*) AS chances, sum(miss::INT) AS misses FROM chances GROUP BY ALL;
COPY (SELECT * FROM per ORDER BY "day", s, measure) TO ${sql(join(track, "session-measures.csv"))} (HEADER);
COPY (SELECT measure, "day", count(DISTINCT s) AS sessions, sum(chances) AS chances, sum(misses) AS misses
      FROM per GROUP BY ALL ORDER BY measure, "day") TO ${sql(join(track, "daily.csv"))} (HEADER);
COPY (SELECT sessions.root, per."day", sessions.model, concat_ws(' | ', sessions.stamps, root_stamps.stamps) AS stamp,
             per.measure, per.chances, per.misses
      FROM per JOIN sessions USING (s, "day")
      LEFT JOIN (SELECT DISTINCT s, stamps FROM sessions) AS root_stamps ON root_stamps.s = sessions.root AND sessions.root <> sessions.s
      -- Sessions nobody typed in (scheduled runs, scripted calls) are not what the rules are for.
      WHERE sessions.root IN (SELECT s FROM typed)) TO ${sql(rowsFile)} (FORMAT json, ARRAY true);`;
  const run = spawnSync("duckdb", [], { input: script, encoding: "utf8", windowsHide: true, maxBuffer: 1 << 26 });
  if (run.status !== 0) throw new Error(`duckdb failed: ${run.stderr || run.error?.message}`);
  return JSON.parse(readFileSync(rowsFile, "utf8")) as Row[];
}

const pct = (x: number) => (Number.isFinite(x) ? `${Math.round(100 * x)}%` : "n/a");

function main(): number {
  let v: { day?: string; trials: string; measures: string; json: boolean; help: boolean };
  try {
    v = parseArgs({
      options: {
        day: { type: "string" },
        trials: { type: "string", default: resolve(HERE, "..", "home", "trials") },
        measures: { type: "string", default: join(DATA, "measures", "measures.sql") },
        json: { type: "boolean", default: false },
        help: { type: "boolean", short: "h", default: false },
      },
    }).values;
  } catch (e) {
    console.error(`${(e as Error).message}\n\n${HELP}`);
    return 2;
  }
  if (v.help) {
    console.log(HELP);
    return 0;
  }
  if (!existsSync(v.measures)) {
    console.error(
      `No measures file at ${v.measures}. It makes the chances table (see tools/sessions.sql); pass --measures.`,
    );
    return 2;
  }
  const day = v.day ?? addDays(new Date().toISOString().slice(0, 10), -1);
  const track = join(DATA, "track");
  mkdirSync(track, { recursive: true });
  const rows = exportTables(v.measures, track);
  const rng = seeded(1);

  const trials = (existsSync(v.trials) ? readdirSync(v.trials) : [])
    .filter((f) => f.endsWith(".md"))
    .map((f) => readTrial(f.slice(0, -3), readFileSync(join(v.trials, f), "utf8")));
  const looksFile = join(track, "looks.csv");
  const header = "trial,measure,look,day,sessions_off,sessions_on,rate_off,rate_on,drop,low,high,p,verdict";
  if (!existsSync(looksFile)) writeFileSync(looksFile, `${header}\n`);
  const taken = readFileSync(looksFile, "utf8")
    .split("\n")
    .slice(1)
    .filter(Boolean)
    .map((l) => l.split(","));
  const looks: Look[] = [];
  const running: string[] = [];
  for (const t of trials.filter((x) => x.status === "testing")) {
    const mine = (m: string) => taken.filter((l) => l[0] === t.id && l[1] === m);
    const done = (m: string) => mine(m).map((l) => Number(l[2]));
    for (const m of t.measures) {
      if (mine(m).some((l) => l[12] === "works")) continue; // verdict in: the trial waits to be marked settled
      const due = dueLooks({ ...t, measures: [m] }, rows, done(m), day, rng);
      for (const l of due) {
        looks.push(l);
        const n = (x: number) => (Number.isFinite(x) ? x.toFixed(4) : "");
        appendFileSync(
          looksFile,
          `${[l.trial, l.measure, l.look, l.day, l.sessionsOff, l.sessionsOn, n(l.off), n(l.on), n(l.drop), n(l.low), n(l.high), n(l.p), l.verdict].join(",")}\n`,
        );
      }
      if (!due.length) {
        const since = rows.filter((r) => r.measure === m && r.day >= t.started && r.day <= day);
        const sizes = ["off", "on"].map((g) => units(since.filter((r) => group(r.stamp, t.id) === g)).length);
        running.push(
          `${t.id} (${m}): ${sizes[0]} sessions without, ${sizes[1]} with; looks at ${LOOKS.join(", ")} per group or on ${addDays(t.started, TRIAL_DAYS)}`,
        );
      }
    }
  }

  // A settled rule against the tasks that never get it, on the model in use now, so a model that no longer needs
  // the rule shows.
  const recent = rows.filter((r) => r.day > addDays(day, -7) && r.day <= day);
  const counts = new Map<string, number>();
  for (const r of recent) counts.set(r.model, (counts.get(r.model) ?? 0) + 1);
  const model = [...counts].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "";
  const settled = trials
    .filter((t) => t.status === "settled")
    .flatMap((t) =>
      t.measures.map((m) => {
        const mine = rows.filter(
          (r) => r.measure === m && r.model === model && r.day > addDays(day, -USUAL_DAYS) && r.day <= day,
        );
        const off = units(mine.filter((r) => group(r.stamp, t.id) === "off"));
        const on = units(mine.filter((r) => group(r.stamp, t.id) === "on"));
        const effect: Partial<Effect> = off.length && on.length ? compare(off, on, rng) : {};
        return { ...effect, trial: t.id, measure: m, model, sessionsOff: off.length, sessionsOn: on.length };
      }),
    );

  const measures = [...new Set(rows.map((r) => r.measure))].sort();
  const flags = measures.flatMap((m) => flag(rows, m, day, rng) ?? []);
  const ungrouped = new Set(rows.filter((r) => r.day === day && !group(r.stamp, "holdout")).map((r) => r.root)).size;
  const sessions = new Set(rows.filter((r) => r.day === day).map((r) => r.root)).size;
  const result = { day, looks, running, settled, flags, sessions, ungrouped };
  writeFileSync(join(track, "report.json"), `${JSON.stringify(result, null, 2)}\n`);
  if (v.json) console.log(JSON.stringify(result, null, 2));
  else {
    for (const l of looks)
      console.log(
        `${l.trial} (${l.measure}), look ${l.look}: ${l.verdict}. Missed ${pct(l.off)} without, ${pct(l.on)} with: a drop of ${pct(l.drop)} (90% range ${pct(l.low)} to ${pct(l.high)}), ${l.sessionsOff} and ${l.sessionsOn} sessions.`,
      );
    for (const r of running) console.log(`Running: ${r}`);
    for (const s of settled)
      console.log(
        `Settled ${s.trial} (${s.measure}) on ${s.model}: ${s.drop === undefined ? "no comparison yet" : `a drop of ${pct(s.drop)} (90% range ${pct(s.low ?? Number.NaN)} to ${pct(s.high ?? Number.NaN)})`}, ${s.sessionsOff} sessions without, ${s.sessionsOn} with.`,
      );
    for (const f of flags.filter((x) => x.flagged))
      console.log(
        `Out of its usual range: ${f.measure} missed ${pct(f.rate)} on ${f.day} (usual ${pct(f.low)} to ${pct(f.high)}, ${f.sessions} sessions).`,
      );
    console.log(
      `${day}: ${sessions} sessions with a chance, ${ungrouped} of them with no trial groups (the hook did not run).`,
    );
  }
  return 0;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) process.exitCode = main();
