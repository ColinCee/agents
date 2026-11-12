// Tests a rule's wording in hours: takes past moments where the rule could be broken, has a model write the agent's
// next message from the same conversation under the old rules and under the new, and counts misses with a pattern.
// Transcripts, picks and replies stay in ~/.claude/keep-going: they are the user's own sessions.

import { spawn, spawnSync } from "node:child_process";
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { comparePaired, type Effect, type Pair, seeded, type Verdict, verdict } from "./rule-stats.js";

const HELP = `Replay past moments under an old and a new rules file and compare how often a rule is broken.

  npm run replay -- --measure <id> --old <rules file> --new <rules file> --miss <regex> --in-force old|new [options]

  --measure    a measure in the measures file: its chances are the moments replayed
  --miss       a reply matching this breaks the rule (JavaScript regex, case-insensitive, multiline)
  --chance     only replies matching this could break it (default: every reply)
  --min-length only replies at least this long could break it
  --in-force   which rules file the sessions in --from..--to really had: its replayed miss rate must come within
               1.5 times the real one, or the replay cannot test this rule
  --from, --to days (UTC, YYYY-MM-DD) the moments come from (default: all)
  --n          moments to replay (default 200, at most 3 per session, sessions drawn at random)
  --model      model that writes the replies (default claude-opus-5-5); --effort its effort level
  --out        folder for picks, replies and the report (default ~/.claude/keep-going/replays/<measure>); a rerun
               continues from the replies already there
  --measures   measures file (default ~/.claude/keep-going/measures/measures.sql)
  --json       print the report as JSON

Needs the duckdb and claude commands. Exit codes: 0 report written, 1 a reply failed (rerun to continue), 2 bad arguments.`;

const HERE = dirname(fileURLToPath(import.meta.url));
const DATA = join(homedir(), ".claude", "keep-going");
const CONTEXT_CHARS = 24_000; // the tail of the conversation a reply is written from: enough for the last few turns
const PER_SESSION = 3; // so one long session cannot fill the sample
const GATE = 1.5; // replayed and real miss rates must agree within this factor for the replay to stand for the real agent
const PARALLEL = 6; // claude processes at once, below where the subscription starts to refuse requests

const FRAME = (
  rules: string,
) => `You are a coding agent in the middle of a session with the user. These are the user's rules for you, loaded every turn:

<rules>
${rules}
</rules>

Below is the recent conversation. Tool calls show as [ToolName: what], and the start of each result as (result). Write your next message as the agent. To use a tool, write it on its own line as [ToolName: what you run]; you will not see its result. Write nothing about this setup.`;

type Moment = { s: string; day: string; uuid: string; miss: boolean; file: string; first: boolean };
type Reply = { uuid: string; arm: "old" | "new"; reply: string };
type Block = { type?: string; text?: string; name?: string; input?: Record<string, unknown>; content?: unknown };
type Entry = {
  uuid?: string;
  type?: string;
  isSidechain?: boolean;
  isMeta?: boolean;
  isCompactSummary?: boolean;
  message?: { content?: string | Block[] };
};

const sql = (path: string) => `'${path.replaceAll("\\", "/").replaceAll("'", "''")}'`;

/** The measure's chances in sessions the user typed in, read with the same queries the daily counts use. */
function moments(measure: string, measures: string, from: string, to: string, out: string): Moment[] {
  const file = join(out, "moments.json");
  const script = `.read ${sql(join(HERE, "sessions.sql"))}
.read ${sql(measures)}
COPY (SELECT c.s, c."day", c.uuid, c.miss, started.file, row_number() OVER (PARTITION BY c.s ORDER BY c.ts) = 1 AS first
      FROM chances c JOIN started USING (s)
      WHERE c.measure = ${sql(measure)} AND c.uuid IS NOT NULL AND c."day" BETWEEN ${sql(from)} AND ${sql(to)}
        AND c.s IN (SELECT s FROM typed)) TO ${sql(file)} (FORMAT json, ARRAY true);`;
  const run = spawnSync("duckdb", [], { input: script, encoding: "utf8", windowsHide: true, maxBuffer: 1 << 26 });
  if (run.status !== 0) throw new Error(`duckdb failed: ${run.stderr || run.error?.message}`);
  return JSON.parse(readFileSync(file, "utf8")) as Moment[];
}

/** Sessions in random order, one moment from each in turn (its first chance, then others), until n are picked. */
export function pick(all: Moment[], n: number, rng: () => number): Moment[] {
  const shuffled = <T>(list: T[]) =>
    list
      .map((x) => [rng(), x] as const)
      .sort((a, b) => a[0] - b[0])
      .map(([, x]) => x);
  const bySession = new Map<string, Moment[]>();
  for (const m of all) bySession.set(m.s, [...(bySession.get(m.s) ?? []), m]);
  const queues = shuffled([...bySession.values()]).map((ms) => [
    ...ms.filter((m) => m.first),
    ...shuffled(ms.filter((m) => !m.first)),
  ]);
  const picked: Moment[] = [];
  for (let round = 0; round < PER_SESSION && picked.length < n; round++)
    for (const q of queues) if (q[round] && picked.length < n) picked.push(q[round] as Moment);
  return picked;
}

const clean = (text: string) => text.replace(/<system-reminder>[\s\S]*?<\/system-reminder>/g, "").trim();
const cut = (text: string, max: number) => (text.length > max ? `${text.slice(0, max)}…` : text);

/** The conversation before the moment, as text: what the user typed, what the agent wrote and ran, and how results began. */
export function context(lines: string[], uuid: string): string {
  const out: string[] = [];
  for (const line of lines) {
    let e: Entry;
    try {
      e = JSON.parse(line) as Entry;
    } catch {
      continue; // a line cut off while it was written
    }
    if (e.uuid === uuid) break;
    if (e.isSidechain || e.isMeta || e.isCompactSummary || (e.type !== "user" && e.type !== "assistant")) continue;
    const content = e.message?.content;
    const blocks: Block[] = typeof content === "string" ? [{ type: "text", text: content }] : (content ?? []);
    for (const b of blocks) {
      if (b.type === "text" && clean(b.text ?? ""))
        out.push(`${e.type === "user" ? "User" : "Agent"}: ${clean(b.text ?? "")}`);
      else if (b.type === "tool_use") {
        const i = b.input ?? {};
        out.push(`Agent: [${b.name}: ${cut(String(i.command ?? i.file_path ?? i.skill ?? JSON.stringify(i)), 600)}]`);
      } else if (b.type === "tool_result") {
        const text = typeof b.content === "string" ? b.content : JSON.stringify(b.content ?? "");
        out.push(`  (result) ${cut(clean(text), 300)}`);
      }
    }
  }
  const all = out.join("\n\n");
  return all.length > CONTEXT_CHARS ? `[earlier conversation cut]\n\n${all.slice(-CONTEXT_CHARS)}` : all;
}

function ask(systemFile: string, prompt: string, model: string, effort: string | undefined): Promise<string> {
  // No tools, settings, hooks or MCP servers: only the rules file differs between the two arms.
  const args = ["-p", "--model", model, "--tools", "", "--no-session-persistence", "--strict-mcp-config"];
  args.push("--setting-sources", "", "--system-prompt-file", systemFile, "--output-format", "json");
  if (effort) args.push("--effort", effort);
  return new Promise((done, fail) => {
    // A reply takes under a minute; ten means the process hangs.
    const child = spawn("claude", args, { windowsHide: true, timeout: 600_000, cwd: dirname(systemFile) });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (d) => {
      stdout += d;
    });
    child.stderr.on("data", (d) => {
      stderr += d;
    });
    child.on("error", fail);
    child.on("close", () => {
      try {
        const r = JSON.parse(stdout) as { is_error?: boolean; result?: string };
        if (r.is_error) fail(new Error(String(r.result)));
        else done(r.result ?? "");
      } catch {
        fail(new Error((stdout + stderr).slice(-300) || "claude gave no output"));
      }
    });
    child.stdin.end(`${prompt}\n\n(Write the agent's next message.)`);
  });
}

type Scored = Moment & { old?: { chance: boolean; miss: boolean }; new?: { chance: boolean; miss: boolean } };
export type Report = {
  measure: string;
  moments: number;
  sessions: number;
  bothChance: number; // moments where both replies could break the rule: the ones compared
  realMissRate: number;
  replayedMissRate: number; // under the rules in force, where the reply had a chance
  stands: boolean;
  effect: Effect;
  firstChances: Effect; // each session's first chance only: no earlier replies of its own to copy
  verdict: Verdict | "replay can't test this";
};

export function report(measure: string, scored: Scored[], inForce: "old" | "new", rng: () => number): Report {
  const both = scored.filter((m) => m.old?.chance && m.new?.chance);
  const pairs = (ms: Scored[]): Pair[] => {
    const bySession = new Map<string, Pair>();
    for (const m of ms) {
      const p = bySession.get(m.s) ?? { old: { chances: 0, misses: 0 }, new: { chances: 0, misses: 0 } };
      p.old.chances++;
      p.new.chances++;
      p.old.misses += Number(m.old?.miss);
      p.new.misses += Number(m.new?.miss);
      bySession.set(m.s, p);
    }
    return [...bySession.values()];
  };
  const share = (hits: number, of: number) => (of ? hits / of : Number.NaN);
  const had = scored.filter((m) => m[inForce]?.chance);
  const realMissRate = share(had.filter((m) => m.miss).length, had.length);
  const replayedMissRate = share(had.filter((m) => m[inForce]?.miss).length, had.length);
  const ratio = replayedMissRate / realMissRate;
  // Rates a few points apart agree even when their ratio is large, as when both are near zero.
  const stands = (ratio >= 1 / GATE && ratio <= GATE) || Math.abs(replayedMissRate - realMissRate) <= 0.05;
  const effect = comparePaired(pairs(both), rng);
  return {
    measure,
    moments: scored.length,
    sessions: new Set(scored.map((m) => m.s)).size,
    bothChance: both.length,
    realMissRate,
    replayedMissRate,
    stands,
    effect,
    firstChances: comparePaired(pairs(both.filter((m) => m.first)), rng),
    verdict: stands ? verdict(effect, 0.05) : "replay can't test this",
  };
}

const pct = (x: number) => (Number.isNaN(x) ? "n/a" : `${Math.round(100 * x)}%`);
const line = (e: Effect) =>
  `missed ${pct(e.off)} under the old rules, ${pct(e.on)} under the new: a drop of ${pct(e.drop)} (90% range ${pct(e.low)} to ${pct(e.high)}, p = ${e.p.toFixed(3)})`;

async function main(): Promise<number> {
  let v: Record<string, string | boolean | undefined>;
  try {
    v = parseArgs({
      options: {
        measure: { type: "string" },
        old: { type: "string" },
        new: { type: "string" },
        miss: { type: "string" },
        chance: { type: "string" },
        "min-length": { type: "string", default: "0" },
        "in-force": { type: "string" },
        from: { type: "string", default: "0000-00-00" },
        to: { type: "string", default: "9999-99-99" },
        n: { type: "string", default: "200" },
        model: { type: "string", default: "claude-opus-5-5" },
        effort: { type: "string" },
        out: { type: "string" },
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
  const inForce = v["in-force"];
  if (!v.measure || !v.old || !v.new || !v.miss || (inForce !== "old" && inForce !== "new")) {
    console.error(`--measure, --old, --new, --miss and --in-force old|new are all needed.\n\n${HELP}`);
    return 2;
  }
  const measure = String(v.measure);
  const out = resolve(String(v.out ?? join(DATA, "replays", measure)));
  mkdirSync(out, { recursive: true });
  const rng = seeded(1);

  const picksFile = join(out, "picks.json");
  const picks: Moment[] = existsSync(picksFile)
    ? (JSON.parse(readFileSync(picksFile, "utf8")) as Moment[])
    : pick(moments(measure, String(v.measures), String(v.from), String(v.to), out), Number(v.n), rng);
  writeFileSync(picksFile, JSON.stringify(picks));

  const system = { old: join(out, "system-old.txt"), new: join(out, "system-new.txt") };
  writeFileSync(system.old, FRAME(readFileSync(String(v.old), "utf8")));
  writeFileSync(system.new, FRAME(readFileSync(String(v.new), "utf8")));

  const repliesFile = join(out, "replies.jsonl");
  const replies: Reply[] = existsSync(repliesFile)
    ? readFileSync(repliesFile, "utf8")
        .split("\n")
        .filter(Boolean)
        .map((l) => JSON.parse(l) as Reply)
    : [];
  const have = new Set(replies.map((r) => `${r.uuid} ${r.arm}`));
  const jobs = picks
    .flatMap((m) => (["old", "new"] as const).map((arm) => ({ m, arm })))
    .filter((j) => !have.has(`${j.m.uuid} ${j.arm}`));
  console.error(`${picks.length} moments, ${jobs.length} replies to write`);
  let failed = 0;
  let next = 0;
  const worker = async () => {
    while (next < jobs.length) {
      const job = jobs[next++] as (typeof jobs)[number];
      try {
        const convo = context(readFileSync(job.m.file, "utf8").split("\n"), job.m.uuid);
        const reply = await ask(system[job.arm], convo, String(v.model), v.effort as string | undefined);
        const r: Reply = { uuid: job.m.uuid, arm: job.arm, reply };
        replies.push(r);
        appendFileSync(repliesFile, `${JSON.stringify(r)}\n`);
      } catch (e) {
        failed++;
        if (/limit/i.test((e as Error).message)) next = jobs.length; // out of quota: every further reply would fail too
        console.error(`failed ${job.m.uuid.slice(0, 8)} ${job.arm}: ${(e as Error).message.slice(0, 200)}`);
      }
      if (next % 20 === 0) console.error(`${next} of ${jobs.length}`);
    }
  };
  await Promise.all(Array.from({ length: PARALLEL }, worker));

  const miss = new RegExp(String(v.miss), "im");
  const chance = v.chance ? new RegExp(String(v.chance), "im") : undefined;
  const minLength = Number(v["min-length"]);
  const scored: Scored[] = picks.map((m) => ({ ...m }));
  const byUuid = new Map(scored.map((m) => [m.uuid, m]));
  for (const r of replies) {
    const m = byUuid.get(r.uuid);
    const could = r.reply.length >= minLength && (chance?.test(r.reply) ?? true);
    if (m) m[r.arm] = { chance: could, miss: could && miss.test(r.reply) };
  }
  const result = report(measure, scored, inForce, rng);
  writeFileSync(join(out, "report.json"), `${JSON.stringify(result, null, 2)}\n`);
  if (v.json) console.log(JSON.stringify(result, null, 2));
  else
    console.log(
      [
        `${measure}: ${result.verdict}`,
        `${result.moments} moments from ${result.sessions} sessions; in ${result.bothChance} both replies could break the rule`,
        `All: ${line(result.effect)}`,
        `Each session's first chance only: ${line(result.firstChances)}`,
        `Check: under the ${inForce} rules the real agents missed ${pct(result.realMissRate)} of these, the replay ${pct(result.replayedMissRate)}${result.stands ? "" : `: more than ${GATE} times apart, so the replay does not stand for the real agent here`}`,
      ].join("\n"),
    );
  return failed ? 1 : 0;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) process.exitCode = await main();
