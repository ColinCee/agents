// Run a skill's task with the skill and without it, and say whether the skill helped.
import { type ChildProcess, spawn, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  closeSync,
  cpSync,
  existsSync,
  mkdirSync,
  openSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { freemem, homedir } from "node:os";
import { basename, delimiter, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";

const HELP = `Run a skill's task with the skill and without it, and say whether the skill helped.

  npm run bench -- SKILL [--task NAME] [--model ID] [--runs N] [--batch N] [--until-decided] [--replay] [--force] [--json]
  npm run bench -- SKILL --from JOB_WITHOUT JOB_WITH
  npm run bench -- TASK --plain     only the side without a skill: a baseline before any skill exists

SKILL            a folder name under skills/ or skills/.experimental/
--task           whose test to run: a folder in agents-bench (default: SKILL's own); a checklist skill is scored on
                 its focused skills' tests, one at a time, never averaged
--model          the model the agent uses (default claude-haiku-5-5, the small fast one)
--runs           the most trials each way (default 10)
--batch          trials each way per batch, all at once (default 5)
--until-decided  stop after the first batch at which the decision rule gives a verdict (exploring, never deciding)
--replay         never start an agent: score saved batches, or say what would have to be run
--force          run every batch again even when nothing has changed (the old runs are set aside, not deleted)
--from           score two Harbor job folders that already exist
--json           print JSON instead of text
--min-free-gb    refuse to start a batch with less free memory than this (default 8)
--lease-wait     seconds to wait for the shared GPU and RAM lease before giving up (default 600; 0 refuses at once)

A command (a skill marked disable-model-invocation: true) is run as the user types it: the prompt starts with
/<name>. Each batch runs both sides at the same time, so they share load and versions. Saved batches are kept under
a hash of what decides their result, so a second call with nothing changed asks no model anything.

A run starts agents, which costs tokens, and needs Harbor, Docker and a sign-in for the agent in the environment.
Exit codes: 0 done, 1 a run failed, the lease was refused or --replay found nothing saved, 2 bad arguments.`;

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const JOBS = join(ROOT, "jobs"); // Harbor's raw output; not kept in git
// The tasks hold graders and answers, so they live in a private repository: beside this one, or at AGENTS_BENCH.
// It mirrors this repository: skills/<skill>/task is the test for that skill.
const BENCH = process.env.AGENTS_BENCH ?? join(ROOT, "..", "agents-bench");
const DEFAULT_MODEL = "claude-haiku-5-5";
const DEFAULT_RUNS = 10; // AGENTS.md: the fewest runs each way at which a skill can be promoted
const DEFAULT_BATCH = 5; // ten containers at once used 1.5 GB in all and met no refusal (14 October 2026)
const RETRIES = 2; // Harbor retries only errors it treats as passing (not sign-in or usage-limit errors)
const BUDGET_SECONDS = 300; // AGENTS.md: the task step is to finish in under five minutes
const MIN_FREE_GB = 8; // a batch of ten used 1.5 GB at the peak; the rest is room for whatever else is running
const LEASE_GB = 10; // what a batch of ten containers and Docker's VM hold, with room to spare
const LEASE_WAIT_S = 600; // long enough for Cortex to finish a catch-up, short enough to notice a stuck holder
const LEASE_RENEW_MS = 30_000; // the lease lapses 120 s after the last renewal; four chances before that
const CACHES = new Set(["__pycache__", ".ruff_cache", ".pytest_cache"]);
const CANARY = /^# AGENTS-BENCH CANARY [^\n]*\n/gm;

// The decision rule in AGENTS.md, as shares of the runs each way.
const PROMOTE_RUNS = 10;
const PROMOTE_GAP = 0.4;
const WORST_DROP = 0.1;
const TOKEN_RATIO = 3;
const DELETE_RUNS = 20;
const DELETE_GAP = 0.3;

type Side = "without" | "with";
interface TrajectoryCheck {
  name: string;
  forbid: string;
  pattern: RegExp;
}
export interface Trial {
  trial: string;
  served_models: string[];
  checks: Record<string, boolean>;
  passed: number;
  input_tokens: number | null;
  output_tokens: number | null;
  agent_seconds: number | null;
  setup_seconds: number;
  grading_seconds: number | null;
  skill_read: boolean;
  failed_to_run: boolean;
}

const isDir = (path: string): boolean => existsSync(path) && statSync(path).isDirectory();
const isFile = (path: string): boolean => existsSync(path) && statSync(path).isFile();

/** Every file under a folder, with its parts relative to the folder, skipping tool caches. */
function walk(base: string): { path: string; parts: string[] }[] {
  const out: { path: string; parts: string[] }[] = [];
  const visit = (dir: string, parts: string[]): void => {
    for (const name of readdirSync(dir)) {
      const path = join(dir, name);
      if (CACHES.has(name)) continue;
      if (isDir(path)) visit(path, [...parts, name]);
      else out.push({ path, parts: [...parts, name] });
    }
  };
  visit(base, []);
  return out;
}

/** Path order as Python sorts them on Windows: part by part, case folded. Keys made before the port depend on it. */
function byParts(a: string[], b: string[]): number {
  for (let i = 0; i < Math.min(a.length, b.length); i++) {
    const x = (a[i] ?? "").toLowerCase();
    const y = (b[i] ?? "").toLowerCase();
    if (x !== y) return x < y ? -1 : 1;
  }
  return a.length - b.length;
}

/** A hash of everything that decides the result. Line endings are ignored so every platform agrees. */
export function keyOf(folders: string[], salt: string): string {
  const digest = createHash("sha256").update(`${salt}\n`);
  for (const base of folders) {
    for (const { path, parts } of walk(base).sort((a, b) => byParts(a.parts, b.parts))) {
      if (parts.includes("evals")) continue;
      digest.update(parts.join("/"));
      const data = readFileSync(path).toString("latin1").replaceAll("\r\n", "\n");
      // The canary line marks the private benchmark; it changes nothing an agent or grader does.
      digest.update(Buffer.from(data.replace(CANARY, ""), "latin1"));
    }
  }
  return digest.digest("hex").slice(0, 12);
}

function seconds(span: { started_at?: string; finished_at?: string } | undefined): number | null {
  if (!span?.started_at || !span.finished_at) return null;
  return (Date.parse(span.finished_at) - Date.parse(span.started_at)) / 1000;
}

function loadTrajectoryChecks(task: string | null): TrajectoryCheck[] {
  const path = task ? join(task, "trajectory_checks.json") : null;
  if (!path || !isFile(path)) return [];
  const checks = JSON.parse(readFileSync(path, "utf8")) as Omit<TrajectoryCheck, "pattern">[];
  return checks.map((c) => ({ ...c, pattern: new RegExp(c.forbid) }));
}

function commandsRun(trajectory: string): string[] {
  if (!trajectory) return [];
  const steps = (JSON.parse(trajectory).steps ?? []) as { tool_calls?: { arguments?: { command?: unknown } }[] }[];
  return steps
    .flatMap((s) => (s.tool_calls ?? []).map((c) => c.arguments?.command))
    .filter(Boolean)
    .map(String);
}

/** The first line of a skill's body: present in a transcript when the skill's text reached the agent. */
function marker(skill: string | null): string | null {
  if (!skill) return null;
  const body = readFileSync(join(skill, "SKILL.md"), "utf8").split("---").slice(2).join("---");
  return (
    body
      .split("\n")
      .map((l) => l.trim())
      .find(Boolean) ?? null
  );
}

export function readJob(job: string, trajectoryChecks: TrajectoryCheck[], skillText: string | null = null): Trial[] {
  const trials: Trial[] = [];
  for (const name of readdirSync(job).sort()) {
    const trial = join(job, name);
    if (!isDir(trial) || !isFile(join(trial, "result.json"))) continue;
    const result = JSON.parse(readFileSync(join(trial, "result.json"), "utf8"));
    const usage = result.agent_result ?? {};
    const checksFile = join(trial, "verifier", "checks.txt");
    const checks: Record<string, boolean> = {};
    if (isFile(checksFile))
      for (const line of readFileSync(checksFile, "utf8").split(/\r?\n/)) {
        const parts = line.split(/\s+/).filter(Boolean);
        if (parts.length === 3 && parts[2]) checks[parts[2]] = parts[0] === "PASS";
      }
    const path = join(trial, "agent", "trajectory.json");
    const trajectory = isFile(path) ? readFileSync(path, "utf8") : "";
    if (Object.keys(checks).length) {
      const commands = commandsRun(trajectory);
      for (const check of trajectoryChecks) checks[`did:${check.name}`] = !commands.some((c) => check.pattern.test(c));
    }
    trials.push({
      trial: name,
      served_models: Object.keys(usage.model_usage ?? {}).sort(),
      checks,
      passed: Object.values(checks).filter(Boolean).length,
      input_tokens: usage.n_input_tokens ?? null,
      output_tokens: usage.n_output_tokens ?? null,
      agent_seconds: seconds(result.agent_execution),
      setup_seconds: (seconds(result.environment_setup) ?? 0) + (seconds(result.agent_setup) ?? 0),
      grading_seconds: seconds(result.verifier),
      // Loaded by a tool, read as a file, or put in the conversation by typing its name.
      skill_read:
        trajectory.includes('"Skill"') ||
        trajectory.includes("SKILL.md") ||
        (skillText !== null && trajectory.includes(JSON.stringify(skillText).slice(1, -1))),
      failed_to_run: isFile(join(trial, "exception.txt")) || !Object.keys(checks).length,
    });
  }
  return trials;
}

function complete(job: string, runs: number): boolean {
  if (!isFile(join(job, "result.json"))) return false;
  const trials = readJob(job, []);
  return trials.length >= runs && !trials.some((t) => t.failed_to_run);
}

function mean(values: (number | null)[]): number | null {
  const real = values.filter((v): v is number => v !== null);
  return real.length ? real.reduce((a, b) => a + b, 0) / real.length : null;
}

interface SideSummary {
  trials: number;
  checks_passed_mean: number | null;
  input_tokens_mean: number | null;
  output_tokens_mean: number | null;
  agent_seconds_mean: number | null;
  setup_seconds_mean: number | null;
  grading_seconds_mean: number | null;
  skill_read: number;
  served_models: string[];
}
interface CheckRow {
  check: string;
  without: number;
  with: number;
  tells_apart: boolean;
}
export interface Summary {
  checks_total: number;
  sides: Record<Side, SideSummary>;
  checks: CheckRow[];
  verdict: string;
  took_seconds?: number | null;
}

const pct = (x: number): string => `${Math.round(x * 100)}%`;

export function summarise(without: Trial[], withSkill: Trial[]): Summary {
  const names = [...new Set([...without, ...withSkill].flatMap((t) => Object.keys(t.checks)))];
  const table = names.map((check) => {
    const a = without.filter((t) => t.checks[check]).length;
    const b = withSkill.filter((t) => t.checks[check]).length;
    return { check, without: a, with: b, tells_apart: a !== b };
  });
  const side = (trials: Trial[]): SideSummary => ({
    trials: trials.length,
    checks_passed_mean: mean(trials.map((t) => t.passed)),
    input_tokens_mean: mean(trials.map((t) => t.input_tokens)),
    output_tokens_mean: mean(trials.map((t) => t.output_tokens)),
    agent_seconds_mean: mean(trials.map((t) => t.agent_seconds)),
    setup_seconds_mean: mean(trials.map((t) => t.setup_seconds)),
    grading_seconds_mean: mean(trials.map((t) => t.grading_seconds)),
    skill_read: trials.filter((t) => t.skill_read).length,
    served_models: [...new Set(trials.flatMap((t) => t.served_models))].sort(),
  });
  const summary: Summary = {
    checks_total: names.length,
    sides: { without: side(without), with: side(withSkill) },
    checks: table,
    verdict: "",
  };
  summary.verdict = verdict(summary);
  return summary;
}

/** The decision rule in AGENTS.md. */
export function verdict(summary: Summary): string {
  const a = summary.sides.without;
  const b = summary.sides.with;
  const runs = Math.min(a.trials, b.trials);
  if (!runs || !summary.checks.length) return "no runs";
  // Ties are broken by the check's name, as Python's max over (gap, name) does.
  const gaps = summary.checks
    .map((c) => ({ gap: c.with / b.trials - c.without / a.trials, check: c.check }))
    .sort((x, y) => x.gap - y.gap || (x.check < y.check ? -1 : x.check > y.check ? 1 : 0));
  const best = gaps.at(-1) as { gap: number; check: string };
  const worst = gaps[0] as { gap: number; check: string };
  const ratio = (b.input_tokens_mean ?? 0) / (a.input_tokens_mean || 1);
  if (runs >= PROMOTE_RUNS && best.gap >= PROMOTE_GAP && worst.gap >= -WORST_DROP && ratio <= TOKEN_RATIO)
    return `promote: ${best.check} ahead by ${pct(best.gap)} of runs, nothing behind by more than ${pct(WORST_DROP)}, tokens x${ratio.toFixed(2)}`;
  if (runs >= DELETE_RUNS && best.gap < DELETE_GAP)
    return `delete: after ${runs} runs each way no check is ahead by ${pct(DELETE_GAP)} (best ${best.check}, ${pct(best.gap)})`;
  const reasons: string[] = [];
  if (runs < PROMOTE_RUNS) reasons.push(`${runs} runs each way, the rule needs ${PROMOTE_RUNS}`);
  if (best.gap < PROMOTE_GAP)
    reasons.push(`best gap ${pct(best.gap)} (${best.check}), the rule needs ${pct(PROMOTE_GAP)}`);
  if (worst.gap < -WORST_DROP) reasons.push(`${worst.check} is behind by ${pct(-worst.gap)}`);
  if (ratio > TOKEN_RATIO) reasons.push(`tokens x${ratio.toFixed(2)}, the rule allows x${TOKEN_RATIO}`);
  return `undecided: ${reasons.join("; ")}`;
}

function num(value: number | null, digits = 0): string {
  if (value === null) return "n/a";
  return value.toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

function asMarkdown(skill: string, model: string, s: Summary, took: number | null, note: string): string {
  const a = s.sides.without;
  const b = s.sides.with;
  const lines = [
    `# ${skill} on ${model}, ${new Date().toLocaleDateString("sv-SE")}`,
    "",
    note,
    "",
    `**Verdict:** ${s.verdict}`,
    "",
    "| | Without the skill | With the skill |",
    "|---|---|---|",
    `| Runs | ${a.trials} | ${b.trials} |`,
    `| Checks passed, mean of ${s.checks_total} | ${num(a.checks_passed_mean, 1)} | ${num(b.checks_passed_mean, 1)} |`,
    `| Input tokens, mean | ${num(a.input_tokens_mean)} | ${num(b.input_tokens_mean)} |`,
    `| Output tokens, mean | ${num(a.output_tokens_mean)} | ${num(b.output_tokens_mean)} |`,
    `| Agent time, mean | ${num(a.agent_seconds_mean)} s | ${num(b.agent_seconds_mean)} s |`,
    `| Set-up and grading per run, mean | ${num(a.setup_seconds_mean)} s and ${num(a.grading_seconds_mean)} s | ${num(b.setup_seconds_mean)} s and ${num(b.grading_seconds_mean)} s |`,
    `| Skill read | | ${b.skill_read} of ${b.trials} |`,
    `| Model actually served | ${a.served_models.join(", ") || "n/a"} | ${b.served_models.join(", ") || "n/a"} |`,
    "",
    "Checks named `did:` are about what the agent did, read from its trajectory.",
    "",
    "| Check | Without | With | Tells them apart |",
    "|---|---|---|---|",
    ...s.checks.map(
      (c) => `| ${c.check} | ${c.without}/${a.trials} | ${c.with}/${b.trials} | ${c.tells_apart ? "yes" : "no"} |`,
    ),
  ];
  if (took !== null) {
    const over = took > BUDGET_SECONDS ? ` That is over the budget of ${BUDGET_SECONDS} s.` : "";
    lines.push("", `The runs took ${took.toFixed(0)} s.${over}`);
  }
  return `${lines.join("\n")}\n`;
}

function which(program: string): string | null {
  const exts = process.platform === "win32" ? (process.env.PATHEXT ?? ".EXE").split(";") : [""];
  for (const dir of (process.env.PATH ?? "").split(delimiter))
    for (const ext of exts) {
      const path = join(dir, program + ext.toLowerCase());
      if (isFile(path)) return path;
      if (isFile(join(dir, program + ext))) return join(dir, program + ext);
    }
  return null;
}

/** How to start Harbor. On Windows a uv-installed harbor.exe and its venv's python.exe are launchers that each
 * open a new console window; Harbor's base Python, pointed at its packages, opens none. */
function harborCommand(): string[] {
  const found = which("harbor");
  if (process.platform !== "win32" || !found) return ["harbor"];
  // The venv sits beside the launcher, or in uv's tool folder when uv installed it.
  const tools = process.env.UV_TOOL_DIR ?? join(process.env.APPDATA ?? "", "uv", "tools");
  const venv = [resolve(found, "..", ".."), join(tools, "harbor")].find((v) => isFile(join(v, "pyvenv.cfg")));
  if (!venv) return ["harbor"];
  const home = readFileSync(join(venv, "pyvenv.cfg"), "utf8")
    .split(/\r?\n/)
    .find((l) => l.startsWith("home"))
    ?.split("=")[1]
    ?.trim();
  const base = home ? join(home, "python.exe") : "";
  const site = join(venv, "Lib", "site-packages");
  if (!isFile(base) || !isDir(site)) return ["harbor"];
  const boot = `import site, sys; site.addsitedir(${JSON.stringify(site)}); from harbor.cli.main import app; sys.argv[0] = 'harbor'; app()`;
  return [base, "-c", boot];
}

function harborVersion(): string {
  const [program, ...args] = harborCommand();
  const done = spawnSync(program as string, [...args, "--version"], {
    encoding: "utf8",
    timeout: 30_000,
    windowsHide: true,
  });
  return done.error ? "harbor not found" : (done.stdout ?? "").trim();
}

/** A skill's test, or one archived when its skill was removed or folded into another. */
function testFolder(name: string): string {
  const live = join(BENCH, "skills", name, "task");
  const archived = join(BENCH, "archive", name, "task");
  return isDir(live) || !isDir(archived) ? live : archived;
}

/** A command loads only when the user names it, so it is measured that way. */
function isCommand(skill: string): boolean {
  const head = readFileSync(join(skill, "SKILL.md"), "utf8").split("---")[1] ?? "";
  return head.split(/\r?\n/).some((line) => line.trim() === "disable-model-invocation: true");
}

const noCaches = (src: string): boolean => !CACHES.has(basename(src));

/** A copy of the task whose prompt starts with /<skill>, as the user types a command. */
function asTyped(task: string, skill: string): string {
  const copy = join(JOBS, "task-copies", `${basename(skill)}-on-${basename(dirname(task))}`);
  rmSync(copy, { recursive: true, force: true });
  cpSync(task, copy, { recursive: true, filter: noCaches });
  const prompt = join(copy, "instruction.md");
  writeFileSync(prompt, `/${basename(skill)} ${readFileSync(prompt, "utf8")}`);
  return copy;
}

/** A copy of the skill without evals/, whose prompts and expected outputs would hint at the task. */
function withoutEvals(skill: string): string {
  const copy = join(JOBS, "skill-copies", basename(skill));
  rmSync(copy, { recursive: true, force: true });
  cpSync(skill, copy, { recursive: true, filter: (src) => noCaches(src) && basename(src) !== "evals" });
  return copy;
}

function harbor(task: string, model: string, runs: number, name: string, skill: string | null): ChildProcess {
  const [program, ...pre] = harborCommand();
  const args = [...pre, "run", "-p", task, "-a", "claude-code", "-m", model, "-k", String(runs), "-n", String(runs)];
  args.push("--max-retries", String(RETRIES), "-o", JOBS, "--job-name", name);
  // Web search and fetch run on Anthropic's side, past the task's network allowlist, so they are switched off.
  args.push("--ak", "disable_web_search=true");
  if (skill) args.push("--skill", withoutEvals(skill));
  const log = openSync(join(JOBS, `${name}.log`), "w");
  const child = spawn(program as string, args, {
    cwd: ROOT,
    env: { ...process.env, PYTHONUTF8: "1", PYTHONIOENCODING: "utf-8" },
    stdio: ["ignore", log, log],
    windowsHide: true,
  });
  child.on("close", () => closeSync(log));
  return child;
}

const exited = (child: ChildProcess): Promise<number> =>
  new Promise((done) => child.on("close", (code) => done(code ?? 1)));

/** The shared lock on the GPU and big RAM, through the lease command (see src/lease). */
class Lease {
  private timer: NodeJS.Timeout | null = null;
  held = false;
  lost = false;
  private readonly tool = join(process.env.LEASES_HOME ?? join(homedir(), ".leases"), "lease.mjs");

  private run(...args: string[]): Promise<{ code: number; out: string }> {
    return new Promise((done) => {
      const child = spawn(
        process.execPath,
        [this.tool, ...args, "--name", "bench", "--pid", String(process.pid), "--json"],
        {
          stdio: ["ignore", "pipe", "pipe"],
          windowsHide: true,
        },
      );
      let out = "";
      child.stdout?.on("data", (d) => {
        out += d;
      });
      child.on("close", (code) => done({ code: code ?? 2, out }));
    });
  }

  /** True when it is held, or when this machine has no lease command (other machines run without one). */
  async take(note: string, waitSeconds: number): Promise<boolean> {
    if (!isFile(this.tool)) {
      console.error(`No lease command at ${this.tool}; running without the shared lock.`);
      return true;
    }
    const { code, out } = await this.run(
      "take",
      "--gb",
      String(LEASE_GB),
      "--note",
      note,
      "--wait",
      String(waitSeconds),
    );
    if (code !== 0) {
      let holder = "";
      try {
        const view = JSON.parse(out).view;
        if (view?.holder) holder = ` It is held by ${view.holder.name} (${view.holder.note ?? "no note"}).`;
      } catch {
        // no JSON to read: the message below still says what happened
      }
      console.error(
        `Error: the GPU and RAM lease was not given within ${waitSeconds} s (lease exit ${code}).${holder} Try later.`,
      );
      return false;
    }
    this.held = true;
    this.timer = setInterval(async () => {
      const renewed = await this.run("renew");
      // 3: freed by hand or lapsed. Finish the batch that runs, start no new one. 2 is transient: next tick.
      if (renewed.code === 3) {
        this.lost = true;
        console.error(
          "The lease was taken back (freed by hand, or lapsed). The batch running now finishes; no new one starts.",
        );
      }
    }, LEASE_RENEW_MS);
    return true;
  }

  async free(): Promise<void> {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    if (this.held) await this.run("free");
    this.held = false;
  }
}

function findSkill(name: string): string | null {
  return (
    [join(ROOT, "skills", name), join(ROOT, "skills", ".experimental", name)].find((h) =>
      isFile(join(h, "SKILL.md")),
    ) ?? null
  );
}

async function main(): Promise<number> {
  let parsed: ReturnType<typeof parseArgs>;
  try {
    parsed = parseArgs({
      allowPositionals: true,
      options: {
        task: { type: "string" },
        model: { type: "string", default: DEFAULT_MODEL },
        runs: { type: "string", default: String(DEFAULT_RUNS) },
        batch: { type: "string", default: String(DEFAULT_BATCH) },
        "until-decided": { type: "boolean", default: false },
        replay: { type: "boolean", default: false },
        force: { type: "boolean", default: false },
        from: { type: "string", multiple: true },
        json: { type: "boolean", default: false },
        plain: { type: "boolean", default: false },
        "min-free-gb": { type: "string", default: String(MIN_FREE_GB) },
        "lease-wait": { type: "string", default: String(LEASE_WAIT_S) },
        help: { type: "boolean", short: "h", default: false },
      },
    });
  } catch (e) {
    console.error(`${(e as Error).message}\n\n${HELP}`);
    return 2;
  }
  const v = parsed.values;
  if (v.help) {
    console.log(HELP);
    return 0;
  }
  const skillName = parsed.positionals[0];
  const fromJobs = (v.from as string[] | undefined) ?? [];
  // --from takes two folders: accept them as two flags or as the flag and the next positional.
  if (fromJobs.length === 1 && parsed.positionals[1]) fromJobs.push(parsed.positionals[1]);
  const runs = Number(v.runs);
  const batchSize = Number(v.batch);
  const model = String(v.model);
  if (!skillName) {
    console.error(`Name a skill.\n\n${HELP}`);
    return 2;
  }
  if (!(runs >= 1) || !(batchSize >= 1)) {
    console.error("--runs and --batch must be 1 or more");
    return 2;
  }
  const taskName = (v.task as string | undefined) ?? skillName;

  let took: number | null = null;
  let note: string;
  const sides: Partial<Record<Side, Trial[]>> = {};
  if (fromJobs.length) {
    if (fromJobs.length !== 2 || !fromJobs.every(isDir)) {
      console.error("--from takes two existing job folders: WITHOUT WITH");
      return 2;
    }
    const task = testFolder(taskName);
    const checks = loadTrajectoryChecks(isDir(task) ? task : null);
    sides.without = readJob(fromJobs[0] as string, checks);
    sides.with = readJob(fromJobs[1] as string, checks);
    note = `Scored from saved runs: \`${basename(fromJobs[0] as string)}\` and \`${basename(fromJobs[1] as string)}\`.`;
  } else {
    const folder = v.plain ? null : findSkill(skillName);
    if (!v.plain && !folder) {
      console.error(`Error: no skill named "${skillName}" under skills/ or skills/.experimental/.`);
      return 2;
    }
    const task = testFolder(taskName);
    if (!isFile(join(task, "task.toml"))) {
      console.error(
        `Error: no task at ${task}/task.toml. Clone the private agents-bench repository beside this one, or set AGENTS_BENCH; --task names a skill folder there.`,
      );
      return 2;
    }
    const checks = loadTrajectoryChecks(task);
    const command = folder ? isCommand(folder) : false;
    // The run without the skill depends only on the task, so editing the skill does not repeat it.
    // The harness version and the way the agent is run decide the result too.
    const setup = `${harborVersion()}\nweb search off\n`;
    const keys: Partial<Record<Side, string>> = { without: keyOf([task], model + setup) };
    if (folder) keys.with = keyOf([folder, task], model + setup + (command ? "typed by name\n" : ""));
    const key = Object.values(keys).join("/");
    sides.without = [];
    if (folder) sides.with = [];
    const skillText = marker(folder);
    const lease = new Lease();
    const stop = (): void => {
      void lease.free().finally(() => process.exit(130));
    };
    process.once("SIGINT", stop);
    const started = performance.now();
    let ran = false;
    try {
      for (let batch = 0; batch < Math.ceil(runs / batchSize); batch++) {
        const size = Math.min(batchSize, runs - batch * batchSize);
        // The run without a skill is named after the task alone, so every skill scored on it shares it.
        const owner: Record<Side, string> = {
          without: taskName,
          with: taskName === skillName ? skillName : `${skillName}-on-${taskName}`,
        };
        const present = Object.keys(sides) as Side[];
        const jobs = Object.fromEntries(
          present.map((side) => [side, join(JOBS, `${owner[side]}-${model}-${keys[side]}-${side}-b${batch}`)]),
        ) as Record<Side, string>;
        const missing = present.filter((side) => v.force || !complete(jobs[side], size));
        if (missing.length && v.replay) {
          if (batch === 0) {
            console.error(`Nothing saved for key ${key}: would run ${size} trials ${missing.join(" and ")} the skill.`);
            return 1;
          }
          break;
        }
        if (missing.length) {
          if (lease.lost) break;
          const free = freemem() / 1024 ** 3;
          if (free < Number(v["min-free-gb"])) {
            console.error(
              `Error: ${free.toFixed(1)} GB of memory is free and --min-free-gb is ${v["min-free-gb"]}. Something else needs the machine; try later.`,
            );
            return 1;
          }
          if (!lease.held && !(await lease.take(`${skillName} batch`, Number(v["lease-wait"])))) return 1;
          mkdirSync(JOBS, { recursive: true });
          // Harbor resumes a job folder that exists, so a forced run would only read the old trials back.
          // They are set aside under a dated name, not deleted: they are the record of an earlier run.
          const stamp = new Date().toISOString().replace(/[-:]/g, "").replace("T", "-").slice(0, 15);
          for (const side of missing)
            if (existsSync(jobs[side])) renameSync(jobs[side], `${jobs[side]}.set-aside-${stamp}`);
          console.error(
            `Batch ${batch + 1}: running ${size} trials ${missing.join(" and ")} the skill on ${model} ...`,
          );
          const running = missing.map((side) =>
            harbor(
              side === "with" && folder && command ? asTyped(task, folder) : task,
              model,
              size,
              basename(jobs[side]),
              side === "with" ? folder : null,
            ),
          );
          const codes = await Promise.all(running.map(exited));
          ran = true;
          const bad = missing.filter((side) => !complete(jobs[side], size));
          if (codes.some(Boolean) || bad.length) {
            console.error(
              `Error: batch ${batch + 1} ${(bad.length ? bad : missing).join(" and ")} the skill did not finish cleanly. See jobs/*.log and each trial's exception.txt.`,
            );
            return 1;
          }
        }
        for (const side of present)
          (sides[side] as Trial[]).push(...readJob(jobs[side], checks, side === "with" ? skillText : null));
        if (folder && v["until-decided"] && !summarise(sides.without, sides.with ?? []).verdict.startsWith("undecided"))
          break;
      }
    } finally {
      await lease.free();
      process.removeListener("SIGINT", stop);
    }
    took = ran ? (performance.now() - started) / 1000 : null;
    if (!ran) console.error(`Nothing has changed since key ${key}: scoring the saved runs, no agent started.`);
    note = `Test \`${taskName}\`, agent Claude Code, batches of ${batchSize} each way run side by side. Key \`${key}\`.`;
  }

  if (v.plain) {
    const trials = sides.without ?? [];
    const names = [...new Set(trials.flatMap((t) => Object.keys(t.checks)))].sort();
    console.log(`# ${taskName}, no skill, on ${model}: ${trials.length} runs\n\n| Check | Passed |\n|---|---|`);
    for (const name of names)
      console.log(`| ${name} | ${trials.filter((t) => t.checks[name]).length}/${trials.length} |`);
    return 0;
  }
  const summary = summarise(sides.without ?? [], sides.with ?? []);
  summary.took_seconds = took;
  console.log(v.json ? JSON.stringify(summary, null, 2) : asMarkdown(skillName, model, summary, took, note));
  return 0;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) process.exitCode = await main();
