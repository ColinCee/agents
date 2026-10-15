/**
 * lease: shared locks on this machine's resources (the GPU, big RAM, a browser ...), kept in a small file, with no
 * server.
 *
 * A program about to start a heavy job takes the resources it needs in one step (all or none), renews the lease
 * while the job runs and frees it after. A lease is never stuck: it lapses when its holder stops renewing, frees at
 * once when the holder's process is gone, and anyone can force it free (`free --force`). Every take, free, lapse and
 * forced free is a line in the log, so "who did what when" has an answer.
 *
 * Resources are named by whoever takes them; nothing is listed in advance. `ram` is a pool shared by size (`ram:10`
 * is 10 GB of it); every other resource has one holder at a time. A take with `--gb` and no `--res` means
 * `gpu ram:<gb>`, what the first version of this command locked.
 *
 *   lease take --name N (--res R[:GB] ... | --gb G) [--label R=TEXT] [--note T] [--pid P] [--wait S] [--for S]
 *   lease run --name N (--res R[:GB] ... | --gb G) [--note T] [--wait S] [--for S] -- COMMAND [ARGS]
 *   lease renew --name N [--pid P] [--job-pid J] [--for S]
 *   lease free --name N [--pid P]
 *   lease free --force [--name N [--pid P]] [--stop-job] [--by WHO] [--cooldown S]
 *   lease show
 *   lease log [--lines N]
 *
 * Exit codes: 0 done, 1 held by another (or behind a waiter, or cooling down), 2 bad arguments or an error,
 * 3 not yours (the lease was freed, lapsed or taken by another).
 */

import { type ChildProcess, spawn, spawnSync } from "node:child_process";
import {
  appendFileSync,
  closeSync,
  existsSync,
  mkdirSync,
  openSync,
  readFileSync,
  renameSync,
  statSync,
  unlinkSync,
  writeFileSync,
  writeSync,
} from "node:fs";
import { freemem, homedir, totalmem } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { parseArgs } from "node:util";

export const RENEW_SECONDS = 30;
export const TTL_SECONDS = 120; // four missed renewals: a slow disk or a busy minute does not lose the lease
export const LATE_SECONDS = 2 * RENEW_SECONDS; // two missed renewals: shown as stuck, a minute before it lapses
export const WAITER_SECONDS = 150; // a waiter polls every few seconds; one not seen for this long has given up
export const POLL_SECONDS = 3;
export const RAM = "ram";
export const RAM_RESERVE_GB = 8; // Windows, the desktop and a browser: never handed out as a share of the pool
export const LOADING_SECONDS = 120; // a RAM share taken this recently may not be in use yet: counted as used anyway
export const GPU_BUSY_GB = 4; // the desktop, a browser and video take 1 to 3 GB of the card; a model or a game far more
export const FORGET_DAYS = 30; // a resource nobody has held for this long drops off the list of free ones
const LABEL_MAX = 4; // a band shows several side by side: four capitals are enough to tell them apart
const NAME_PATTERN = /^[a-z0-9][a-z0-9-]{0,31}$/; // a word a person can type; 32 characters is plenty
const LOCK_STALE_MS = 10_000; // an operation holds the lock for milliseconds: a lock this old was left by a killed process
const LOCK_GIVE_UP_MS = 15_000;
const LOG_MAX_BYTES = 1_000_000;

/** One resource a hold or a waiter asks for: `gb` is a share of a pool (`ram`), null the whole resource. */
export type Want = { resource: string; gb: number | null };
export type Job = { pid: number; started: string | null };
export type Hold = {
  name: string;
  pid: number;
  taken: string;
  renewed: string;
  expires: string;
  until: string | null;
  wants: Want[];
  note: string;
  job: Job | null;
  orphaned: string | null;
};
export type Waiter = { name: string; pid: number; wants: Want[]; note: string; since: string; seen: string };
export type Cooldown = { name: string; until: string };
export type Resource = { name: string; label: string; used: string };
export type State = {
  version: 2;
  holds: Hold[];
  waiting: Waiter[];
  cooldowns: Cooldown[];
  resources: Resource[];
  free_gb: number | null;
  /** GPU memory in use on the whole card, any program's, as the driver reports it; null where it cannot be read. */
  gpu_used_gb: number | null;
  measured: string | null;
};

export type Event =
  | "take"
  | "renew-gap"
  | "job"
  | "free"
  | "expire"
  | "holder-gone"
  | "orphaned"
  | "over-time"
  | "forced-free"
  | "job-stopped"
  | "wait"
  | "gave-up"
  | "reset";
export type LogLine = {
  at: string;
  event: Event;
  name: string;
  pid: number | null;
  gb: number | null;
  by: string | null;
  detail: string;
};

export type Outcome =
  | "taken"
  | "renewed"
  | "held"
  | "behind"
  | "cooldown"
  | "lost"
  | "freed"
  | "not-held"
  | "shown"
  | "gave-up";
export type Status = "free" | "held" | "orphaned";
/** How a hold is doing: `late` (no renewal for a minute), `over` (past the time it gave) and `orphaned` (its holder
 * is gone, its job runs) are stuck and want a look; none of them frees it. */
export type Health = "ok" | "late" | "over" | "orphaned";
/** The first version's single holder, kept in every answer for the programs that read it (Cortex). */
export type LegacyHolder = Omit<Hold, "wants" | "until"> & { gb: number };
export type HoldView = Hold & { health: Health; gb: number; seconds_left: number };
export type View = {
  status: Status;
  holder: LegacyHolder | null;
  seconds_left: number | null;
  holds: HoldView[];
  waiting: (Waiter & { gb: number })[];
  cooldowns: Cooldown[];
  resources: Resource[];
  ram_gb: number;
  free_gb: number | null;
  /** GPU memory in use on the whole card, any program's, as the driver reports it; null where it cannot be read. */
  gpu_used_gb: number | null;
  measured: string | null;
};
export type Answer = { outcome: Outcome; view: View };

/** What the lease asks of the machine. The tests hand in their own. */
export type System = {
  now: () => number;
  alive: (pid: number) => boolean;
  started: (pid: number) => string | null;
  stop: (pid: number) => boolean;
  freeGb: () => number;
  totalGb: () => number;
  gpuUsedGb: () => number | null;
  sleep: (ms: number) => void;
};

export const realSystem: System = {
  now: () => Date.now(),
  alive: (pid) => {
    try {
      process.kill(pid, 0);
      return true;
    } catch (error) {
      return (error as NodeJS.ErrnoException).code === "EPERM"; // there, and not ours to signal
    }
  },
  started: (pid) => {
    const run =
      process.platform === "win32"
        ? spawnSync(
            "powershell.exe",
            [
              "-NoProfile",
              "-NonInteractive",
              "-Command",
              `(Get-Process -Id ${pid}).StartTime.ToUniversalTime().ToString('o')`,
            ],
            { encoding: "utf8", windowsHide: true, timeout: 20_000 },
          )
        : spawnSync("ps", ["-o", "lstart=", "-p", String(pid)], { encoding: "utf8", timeout: 20_000 });
    const out = run.status === 0 ? run.stdout.trim() : "";
    return out === "" ? null : out;
  },
  stop: (pid) => {
    if (process.platform === "win32") {
      const run = spawnSync("taskkill", ["/PID", String(pid), "/T", "/F"], { windowsHide: true, timeout: 60_000 });
      return run.status === 0;
    }
    try {
      process.kill(pid, "SIGTERM");
      return true;
    } catch {
      return false;
    }
  },
  freeGb: () => freemem() / 2 ** 30,
  totalGb: () => totalmem() / 2 ** 30,
  // The card's total only: on Windows the driver does not say how much each process uses.
  gpuUsedGb: () => {
    const run = spawnSync("nvidia-smi", ["--query-gpu=memory.used", "--format=csv,noheader,nounits"], {
      encoding: "utf8",
      windowsHide: true,
      timeout: 10_000,
    });
    if (run.status !== 0) return null;
    const mib = run.stdout
      .split("\n")
      .filter((line) => line.trim() !== "")
      .map(Number)
      .filter(Number.isFinite);
    return mib.length === 0 ? null : mib.reduce((a, b) => a + b, 0) / 1024;
  },
  sleep: (ms) => {
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
  },
};

export function home(): string {
  return process.env.LEASES_HOME ?? join(homedir(), ".leases");
}

const statePath = () => join(home(), "state.json");
const lockPath = () => join(home(), "state.lock");
const logPath = () => join(home(), "log.jsonl");

export function emptyState(): State {
  return {
    version: 2,
    holds: [],
    waiting: [],
    cooldowns: [],
    resources: [],
    free_gb: null,
    gpu_used_gb: null,
    measured: null,
  };
}

const ramOf = (wants: Want[]) => wants.find((w) => w.resource === RAM)?.gb ?? 0;
const wantWords = (wants: Want[]) => wants.map((w) => (w.gb === null ? w.resource : `${w.resource}:${w.gb}`)).join(" ");
/** What the first version locked: the GPU and `gb` of RAM, together. */
export const legacyWants = (gb: number): Want[] => [
  { resource: "gpu", gb: null },
  { resource: RAM, gb },
];

// --- the edge: the file is read once into its type -----------------------------------------------------------

type Json = null | boolean | number | string | Json[] | { [key: string]: Json };
type Obj = { [key: string]: Json };

const isObj = (v: Json | undefined): v is Obj => typeof v === "object" && v !== null && !Array.isArray(v);
const str = (v: Json | undefined): string | undefined => (typeof v === "string" ? v : undefined);
const num = (v: Json | undefined): number | undefined => (typeof v === "number" && Number.isFinite(v) ? v : undefined);
const pid = (v: Json | undefined): number | undefined => {
  const n = num(v);
  return n !== undefined && Number.isInteger(n) && n > 0 ? n : undefined;
};
const maybe = (v: Json | undefined, what: string): string | null =>
  v === null || v === undefined ? null : need(str(v), what);

class Shape extends Error {}

function need<T>(value: T | undefined, what: string): T {
  if (value === undefined) throw new Shape(what);
  return value;
}

const list = (v: Json | undefined): Json[] => {
  if (!Array.isArray(v)) throw new Shape("list");
  return v;
};

function parseJob(v: Json | undefined): Job | null {
  if (v === null || v === undefined) return null;
  if (!isObj(v)) throw new Shape("job");
  const started = v.started;
  return { pid: need(pid(v.pid), "job.pid"), started: started === null ? null : need(str(started), "job.started") };
}

function parseWants(v: Json | undefined): Want[] {
  const wants = list(v).map((w) => {
    if (!isObj(w)) throw new Shape("want");
    const gb = w.gb;
    return { resource: need(str(w.resource), "want.resource"), gb: gb === null ? null : need(num(gb), "want.gb") };
  });
  if (wants.length === 0) throw new Shape("wants");
  return wants;
}

function parseHold(v: Json): Hold {
  if (!isObj(v)) throw new Shape("hold");
  return {
    name: need(str(v.name), "hold.name"),
    pid: need(pid(v.pid), "hold.pid"),
    taken: need(str(v.taken), "hold.taken"),
    renewed: need(str(v.renewed), "hold.renewed"),
    expires: need(str(v.expires), "hold.expires"),
    until: maybe(v.until, "hold.until"),
    wants: parseWants(v.wants),
    note: need(str(v.note), "hold.note"),
    job: parseJob(v.job),
    orphaned: maybe(v.orphaned, "hold.orphaned"),
  };
}

function parseWaiter(v: Json, version: 1 | 2): Waiter {
  if (!isObj(v)) throw new Shape("waiter");
  return {
    name: need(str(v.name), "waiter.name"),
    pid: need(pid(v.pid), "waiter.pid"),
    wants: version === 1 ? legacyWants(need(num(v.gb), "waiter.gb")) : parseWants(v.wants),
    note: need(str(v.note), "waiter.note"),
    since: need(str(v.since), "waiter.since"),
    seen: need(str(v.seen), "waiter.seen"),
  };
}

function parseCooldown(v: Json): Cooldown {
  if (!isObj(v)) throw new Shape("cooldown");
  return { name: need(str(v.name), "cooldown.name"), until: need(str(v.until), "cooldown.until") };
}

function parseResource(v: Json): Resource {
  if (!isObj(v)) throw new Shape("resource");
  return {
    name: need(str(v.name), "resource.name"),
    label: need(str(v.label), "resource.label"),
    used: need(str(v.used), "resource.used"),
  };
}

/** The first version's single holder as a hold of the GPU and its RAM, so a lease held across the upgrade stays
 * held (a Strata running while this command is replaced keeps its lock). */
function parseLegacyHolder(v: Json | undefined): Hold[] {
  if (v === null || v === undefined) return [];
  if (!isObj(v)) throw new Shape("holder");
  return [
    {
      name: need(str(v.name), "holder.name"),
      pid: need(pid(v.pid), "holder.pid"),
      taken: need(str(v.taken), "holder.taken"),
      renewed: need(str(v.renewed), "holder.renewed"),
      expires: need(str(v.expires), "holder.expires"),
      until: null,
      wants: legacyWants(need(num(v.gb), "holder.gb")),
      note: need(str(v.note), "holder.note"),
      job: parseJob(v.job),
      orphaned: maybe(v.orphaned, "holder.orphaned"),
    },
  ];
}

/** The state file's text as a State; a first-version file is read into the same shape. Throws Shape (a
 * SyntaxError for text that is not JSON) when it is neither. */
export function parseState(text: string): State {
  const raw = JSON.parse(text) as Json;
  if (!isObj(raw) || (raw.version !== 1 && raw.version !== 2)) throw new Shape("version");
  const version = raw.version;
  const free = raw.free_gb ?? null;
  const measured = raw.measured ?? null;
  const holds = version === 1 ? parseLegacyHolder(raw.holder) : list(raw.holds).map(parseHold);
  const resources = version === 1 ? [] : list(raw.resources ?? []).map(parseResource);
  return {
    version: 2,
    holds,
    waiting: list(raw.waiting).map((w) => parseWaiter(w, version)),
    cooldowns: list(raw.cooldowns ?? []).map(parseCooldown),
    resources,
    free_gb: free === null ? null : need(num(free), "free_gb"),
    gpu_used_gb:
      raw.gpu_used_gb === null || raw.gpu_used_gb === undefined ? null : need(num(raw.gpu_used_gb), "gpu_used_gb"),
    measured: measured === null ? null : need(str(measured), "measured"),
  };
}

// --- the file, under a lock held for milliseconds --------------------------------------------------------------

function lock(sys: System): () => void {
  mkdirSync(home(), { recursive: true });
  const path = lockPath();
  const deadline = sys.now() + LOCK_GIVE_UP_MS;
  for (;;) {
    try {
      const fd = openSync(path, "wx");
      writeSync(fd, String(process.pid));
      closeSync(fd);
      return () => {
        try {
          unlinkSync(path);
        } catch {}
      };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
    }
    try {
      if (Date.now() - statSync(path).mtimeMs > LOCK_STALE_MS) unlinkSync(path);
    } catch {}
    if (sys.now() > deadline) throw new Error(`the lease file stayed locked for ${LOCK_GIVE_UP_MS / 1000} s: ${path}`);
    sys.sleep(10);
  }
}

function write(state: State, sys: System): void {
  const path = statePath();
  const temp = `${path}.${process.pid}.tmp`;
  writeFileSync(temp, `${JSON.stringify(state, null, 2)}\n`, "utf8");
  for (let tries = 0; ; tries++) {
    try {
      renameSync(temp, path);
      return;
    } catch (error) {
      // Windows refuses a replace while another program has the file open without sharing it; it lets go in moments.
      const code = (error as NodeJS.ErrnoException).code;
      if (tries >= 50 || (code !== "EPERM" && code !== "EBUSY" && code !== "EACCES")) throw error;
      sys.sleep(20);
    }
  }
}

function record(line: Omit<LogLine, "at">, sys: System): void {
  const path = logPath();
  try {
    if (statSync(path).size > LOG_MAX_BYTES) renameSync(path, join(home(), "log.1.jsonl"));
  } catch {}
  appendFileSync(path, `${JSON.stringify({ at: iso(sys.now()), ...line })}\n`, "utf8");
}

const iso = (ms: number) => new Date(ms).toISOString();
const ms = (stamp: string) => Date.parse(stamp);

type Ops = { state: State; sys: System; log: (line: Omit<LogLine, "at">) => void };

const holdLine = (h: Hold, event: Event, detail: string, by: string | null = null): Omit<LogLine, "at"> => ({
  event,
  name: h.name,
  pid: h.pid,
  gb: ramOf(h.wants),
  by,
  detail,
});

/** Read, tidy, change and write the state under the lock. The change runs on a state already tidied (`tidy`). */
export function withState<T>(sys: System, change: (ops: Ops) => T): T {
  const release = lock(sys);
  try {
    const log = (line: Omit<LogLine, "at">) => record(line, sys);
    let state: State;
    if (!existsSync(statePath())) state = emptyState();
    else {
      const text = readFileSync(statePath(), "utf8");
      try {
        state = parseState(text);
      } catch (error) {
        // A broken file must not hold the machine forever: it is kept aside for a look, and the lease starts empty.
        const aside = join(home(), `state.bad-${sys.now()}.json`);
        writeFileSync(aside, text, "utf8");
        log({
          event: "reset",
          name: "",
          pid: null,
          gb: null,
          by: null,
          detail: `unreadable state kept as ${aside}: ${String(error)}`,
        });
        state = emptyState();
      }
    }
    tidy({ state, sys, log });
    const result = change({ state, sys, log });
    write(state, sys);
    return result;
  } finally {
    release();
  }
}

/** The ways out, applied on every read: a lapsed hold and a gone holder free it, unless the job the holder declared
 * still runs (then it is orphaned: the RAM is still in use, so it stays held until someone frees it and stops the
 * job). A hold past the time it gave is logged once and stays held. Waiters who stopped asking, cooldowns that ran
 * out and resources unused for a month are dropped. */
export function tidy({ state, sys, log }: Ops): void {
  const now = sys.now();
  state.free_gb = Math.round(sys.freeGb() * 10) / 10;
  const gpu = sys.gpuUsedGb();
  state.gpu_used_gb = gpu === null ? null : Math.round(gpu * 10) / 10;
  state.measured = iso(now);
  state.holds = state.holds.filter((h) => {
    const lapsed = now > ms(h.expires);
    const gone = !sys.alive(h.pid);
    if (!lapsed && !gone) return true;
    const why = gone ? `its process ${h.pid} is gone` : `not renewed since ${h.renewed}`;
    if (jobRuns(h, sys)) {
      if (h.orphaned === null) {
        h.orphaned = iso(now);
        log(holdLine(h, "orphaned", `${why}; its job ${h.job?.pid} still runs`));
      }
      return true;
    }
    log(holdLine(h, gone ? "holder-gone" : "expire", why));
    return false;
  });
  for (const h of state.holds) {
    for (const w of h.wants) remember(state, w.resource, null, now);
  }
  state.waiting = state.waiting.filter((w) => now - ms(w.seen) <= WAITER_SECONDS * 1000 && sys.alive(w.pid));
  state.cooldowns = state.cooldowns.filter((c) => now < ms(c.until));
  state.resources = state.resources.filter((r) => now - ms(r.used) <= FORGET_DAYS * 86_400_000);
}

function jobRuns(h: Hold, sys: System): boolean {
  if (h.job === null || !sys.alive(h.job.pid)) return false;
  if (h.orphaned !== null || h.job.started === null) return true; // its start time was compared when it was orphaned
  return sys.started(h.job.pid) === h.job.started; // the same pid, now another program, is not the job
}

/** Note a resource as used now, with the label given, the one it had, or its name's first letters. */
function remember(state: State, name: string, label: string | null, now: number): void {
  const known = state.resources.find((r) => r.name === name);
  const text = (label ?? known?.label ?? name.replace(/-/g, "").slice(0, 3)).toUpperCase().slice(0, LABEL_MAX);
  if (known === undefined) state.resources.push({ name, label: text, used: iso(now) });
  else Object.assign(known, { label: text, used: iso(now) });
}

export function health(h: Hold, now: number): Health {
  if (h.orphaned !== null) return "orphaned";
  if (now - ms(h.renewed) > LATE_SECONDS * 1000) return "late";
  if (h.until !== null && now > ms(h.until)) return "over";
  return "ok";
}

/** The pool `ram` may hand out: what the machine has, less what it needs for itself. */
const ramGb = (sys: System) => Math.max(0, Math.floor(sys.totalGb() - RAM_RESERVE_GB));

export function view(state: State, sys: System): View {
  const now = sys.now();
  const holds = state.holds.map((h) => ({
    ...h,
    health: health(h, now),
    gb: ramOf(h.wants),
    seconds_left: Math.max(0, Math.round((ms(h.expires) - now) / 1000)),
  }));
  // The first version had one holder; the hold of the GPU stands in for it, else the oldest.
  const first = holds.find((h) => h.wants.some((w) => w.resource === "gpu")) ?? holds[0] ?? null;
  const holder: LegacyHolder | null =
    first === null
      ? null
      : {
          name: first.name,
          pid: first.pid,
          taken: first.taken,
          renewed: first.renewed,
          expires: first.expires,
          gb: first.gb,
          note: first.note,
          job: first.job,
          orphaned: first.orphaned,
        };
  return {
    status: first === null ? "free" : first.orphaned !== null ? "orphaned" : "held",
    holder,
    seconds_left: first === null ? null : first.seconds_left,
    holds,
    waiting: state.waiting.map((w) => ({ ...w, gb: ramOf(w.wants) })),
    cooldowns: state.cooldowns,
    resources: state.resources,
    ram_gb: ramGb(sys),
    free_gb: state.free_gb,
    gpu_used_gb: state.gpu_used_gb,
    measured: state.measured,
  };
}

// --- the operations --------------------------------------------------------------------------------------------

export type Who = { name: string; pid: number };
export type TakeArgs = Who & {
  wants: Want[];
  labels?: Record<string, string>;
  note: string;
  ttl: number;
  forSeconds?: number | null;
};

const mine = (h: Hold, who: Who) => h.name === who.name && h.pid === who.pid;
const shares = (a: Want[], b: Want[]) => a.some((x) => b.some((y) => x.resource === y.resource));

/** Why `wants` cannot be taken now, or null when it can. A whole resource needs nobody else on it. A share of RAM
 * needs room in the pool by what the holds declared, and, beside another RAM hold, that much RAM really free: a
 * holder often uses more than it declared (on 14 October a model said 40 GB and left 1 GB free). */
function blocked(state: State, wants: Want[], sys: System): string | null {
  const now = sys.now();
  for (const want of wants) {
    const others = state.holds.filter((h) => h.wants.some((w) => w.resource === want.resource));
    // Nobody holds the GPU but something uses it: a program that took no lock, or the owner playing a game.
    if (want.resource === "gpu" && others.length === 0 && (state.gpu_used_gb ?? 0) > GPU_BUSY_GB)
      return `the GPU is in use without a lock (${Math.round(state.gpu_used_gb ?? 0)} GB)`;
    if (others.length === 0) continue;
    const by = others.map((h) => h.name).join(", ");
    if (want.resource !== RAM || want.gb === null) return `held by ${by}`;
    const declared = others.reduce((sum, h) => sum + ramOf(h.wants), 0);
    if (declared + want.gb > ramGb(sys)) return `held by ${by}`;
    const loading = others
      .filter((h) => now - ms(h.taken) < LOADING_SECONDS * 1000)
      .reduce((sum, h) => sum + ramOf(h.wants), 0);
    if ((state.free_gb ?? 0) - loading < want.gb) return `held by ${by} (${Math.round(state.free_gb ?? 0)} GB free)`;
  }
  return null;
}

export function takeOnce(args: TakeArgs, sys: System = realSystem): Answer {
  return withState(sys, ({ state, log }) => {
    const now = sys.now();
    const held = state.holds.find((h) => mine(h, args));
    if (held !== undefined) {
      if (args.forSeconds != null) held.until = iso(now + args.forSeconds * 1000);
      return { outcome: renewHeld(held, args, sys, log), view: view(state, sys) };
    }
    const isMe = (w: Waiter) => w.name === args.name && w.pid === args.pid;
    const cools = (name: string) => state.cooldowns.some((c) => c.name === name);
    const me = state.waiting.find(isMe);
    // First come, first served among those who want a resource this taker wants; a waiter in its cooldown is not
    // served. One queue, not one per resource: a waiter for RAM can keep a later GPU-only taker waiting too.
    const before = me === undefined ? state.waiting : state.waiting.slice(0, state.waiting.indexOf(me));
    const behind = before.some((w) => !cools(w.name) && shares(w.wants, args.wants));
    const cooling = cools(args.name);
    const why = blocked(state, args.wants, sys);
    if (why === null && !behind && !cooling) {
      for (const w of args.wants) remember(state, w.resource, args.labels?.[w.resource] ?? null, now);
      const hold: Hold = {
        name: args.name,
        pid: args.pid,
        taken: iso(now),
        renewed: iso(now),
        expires: iso(now + args.ttl * 1000),
        until: args.forSeconds == null ? null : iso(now + args.forSeconds * 1000),
        wants: args.wants,
        note: args.note,
        job: null,
        orphaned: null,
      };
      state.holds.push(hold);
      state.waiting = state.waiting.filter((w) => !isMe(w));
      log(holdLine(hold, "take", [wantWords(args.wants), args.note].filter(Boolean).join(" · ")));
      return { outcome: "taken", view: view(state, sys) };
    }
    if (me === undefined && cooling) {
      // Not queued: a holder freed by hand would otherwise stand first in line for when its cooldown ends.
    } else if (me === undefined) {
      state.waiting.push({
        name: args.name,
        pid: args.pid,
        wants: args.wants,
        note: args.note,
        since: iso(now),
        seen: iso(now),
      });
      log({
        event: "wait",
        name: args.name,
        pid: args.pid,
        gb: ramOf(args.wants),
        by: null,
        detail: `${wantWords(args.wants)}: ${why ?? (cooling ? "cooling down" : "behind a waiter")}`,
      });
    } else me.seen = iso(now);
    const outcome: Outcome = why !== null ? "held" : cooling ? "cooldown" : "behind";
    return { outcome, view: view(state, sys) };
  });
}

/** Take, waiting up to `waitSeconds` while another holds it (visible as a waiter). All of `wants` is taken in one
 * step or none of it, so two takers never each hold half of what the other needs. */
export function take(args: TakeArgs, waitSeconds: number, sys: System = realSystem): Answer {
  const deadline = sys.now() + waitSeconds * 1000;
  for (;;) {
    const answer = takeOnce(args, sys);
    if (answer.outcome === "taken" || answer.outcome === "renewed") return answer;
    if (sys.now() + POLL_SECONDS * 1000 > deadline) {
      return withState(sys, ({ state, log }) => {
        const before = state.waiting.length;
        state.waiting = state.waiting.filter((w) => !(w.name === args.name && w.pid === args.pid));
        if (state.waiting.length < before)
          log({
            event: "gave-up",
            name: args.name,
            pid: args.pid,
            gb: ramOf(args.wants),
            by: null,
            detail: `after ${waitSeconds} s`,
          });
        return { outcome: answer.outcome, view: view(state, sys) };
      });
    }
    sys.sleep(POLL_SECONDS * 1000);
  }
}

function renewHeld(h: Hold, args: { ttl: number }, sys: System, log: Ops["log"]): Outcome {
  const now = sys.now();
  const gap = (now - ms(h.renewed)) / 1000;
  if (gap > LATE_SECONDS) log(holdLine(h, "renew-gap", `${Math.round(gap)} s since the last renewal`));
  if (h.until !== null && now > ms(h.until) && ms(h.renewed) <= ms(h.until))
    log(holdLine(h, "over-time", `past the time it gave, ${h.until}; still held`));
  h.renewed = iso(now);
  h.expires = iso(now + args.ttl * 1000);
  h.orphaned = null;
  return "renewed";
}

export function renew(
  args: Who & { ttl: number; jobPid: number | null; forSeconds?: number | null },
  sys: System = realSystem,
): Answer {
  const started = args.jobPid === null ? null : sys.started(args.jobPid);
  return withState(sys, ({ state, log }) => {
    const h = state.holds.find((x) => mine(x, args));
    if (h === undefined) return { outcome: "lost", view: view(state, sys) };
    const outcome = renewHeld(h, args, sys, log);
    if (args.forSeconds != null) h.until = iso(sys.now() + args.forSeconds * 1000);
    if (args.jobPid !== null && h.job?.pid !== args.jobPid) {
      h.job = { pid: args.jobPid, started };
      log(holdLine(h, "job", `job ${args.jobPid}`));
    }
    return { outcome, view: view(state, sys) };
  });
}

export function free(who: Who, sys: System = realSystem): Answer {
  return withState(sys, ({ state, log }) => {
    const h = state.holds.find((x) => mine(x, who));
    if (h === undefined) return { outcome: "not-held", view: view(state, sys) };
    state.holds = state.holds.filter((x) => x !== h);
    log(holdLine(h, "free", h.note));
    return { outcome: "freed", view: view(state, sys) };
  });
}

/** Free a hold whoever has it: the one named by `target`, or with none the one `show` reports as the holder (the
 * hold of the GPU, else the oldest). With `stopJob`, the job its holder declared (and only that) is stopped too; a
 * holder that declared none is told by its next renewal and stops its own work. `cooldown` keeps that holder from
 * taking anything straight back. */
export function forceFree(
  args: { by: string; stopJob: boolean; cooldown: number; target?: { name: string; pid: number | null } },
  sys: System = realSystem,
): Answer {
  const freed = withState(sys, ({ state, log }) => {
    const target = args.target;
    const h =
      target === undefined
        ? (state.holds.find((x) => x.wants.some((w) => w.resource === "gpu")) ?? state.holds[0])
        : state.holds.find((x) => x.name === target.name && (target.pid === null || x.pid === target.pid));
    if (h === undefined) return null;
    state.holds = state.holds.filter((x) => x !== h);
    if (args.cooldown > 0) {
      state.cooldowns = state.cooldowns.filter((c) => c.name !== h.name);
      state.cooldowns.push({ name: h.name, until: iso(sys.now() + args.cooldown * 1000) });
    }
    const stopping = args.stopJob && h.job !== null ? ` and stopping job ${h.job.pid}` : "";
    log(holdLine(h, "forced-free", `${wantWords(h.wants)} · ${h.note}${stopping}`, args.by));
    return h;
  });
  if (freed !== null && args.stopJob && freed.job !== null && sys.alive(freed.job.pid)) {
    const stopped = sys.stop(freed.job.pid);
    withState(sys, ({ log }) =>
      log({
        ...holdLine(freed, "job-stopped", stopped ? "stopped" : "could not be stopped", args.by),
        pid: freed.job?.pid ?? null,
      }),
    );
  }
  return withState(sys, ({ state }) => ({ outcome: freed === null ? "not-held" : "freed", view: view(state, sys) }));
}

export function show(sys: System = realSystem): Answer {
  return withState(sys, ({ state }) => ({ outcome: "shown", view: view(state, sys) }));
}

export function readLog(lines: number): LogLine[] {
  if (!existsSync(logPath())) return [];
  const all = readFileSync(logPath(), "utf8")
    .split("\n")
    .filter((l) => l.trim() !== "");
  return all.slice(-lines).flatMap((l) => {
    try {
      return [JSON.parse(l) as LogLine];
    } catch {
      return [];
    }
  });
}

// --- words -----------------------------------------------------------------------------------------------------

function minutes(seconds: number): string {
  return seconds >= 90 ? `${Math.round(seconds / 60)} min` : `${seconds} s`;
}

const HEALTH_WORDS: Record<Health, string> = {
  ok: "",
  late: " · stuck: no renewal for a minute",
  over: " · stuck: past the time it gave",
  orphaned: " · stuck: its holder is gone, its job still runs",
};

export function words(v: View): string {
  const gpuHeld = v.holds.some((h) => h.wants.some((w) => w.resource === "gpu"));
  const unlocked =
    !gpuHeld && (v.gpu_used_gb ?? 0) > GPU_BUSY_GB
      ? ` · the GPU is in use without a lock (${Math.round(v.gpu_used_gb ?? 0)} GB)`
      : "";
  const free = v.free_gb === null ? "" : `${Math.round(v.free_gb)} GB free${unlocked}`;
  const waiting =
    v.waiting.length > 0 ? ` · waiting: ${v.waiting.map((w) => `${w.name} (${wantWords(w.wants)})`).join(", ")}` : "";
  if (v.holds.length === 0) return `free · ${free}${waiting}`;
  const holds = v.holds.map((h) => {
    const what = `${h.name} (pid ${h.pid})${h.note === "" ? "" : `, ${h.note}`}`;
    return `${wantWords(h.wants)} held by ${what} · ${minutes(h.seconds_left)} left${HEALTH_WORDS[h.health]}`;
  });
  return `${holds.join("; ")} · ${free}${waiting}`;
}

export function logWords(line: LogLine): string {
  const who = line.pid === null ? line.name : `${line.name} (pid ${line.pid})`;
  const by = line.by === null ? "" : ` by ${line.by}`;
  const at = line.at.replace("T", " ").replace(/\.\d+Z$/, "Z");
  return `${at}  ${line.event.padEnd(11)} ${who}${by}${line.detail === "" ? "" : `: ${line.detail}`}`;
}

// --- the command -----------------------------------------------------------------------------------------------

const EXIT: Record<Outcome, number> = {
  taken: 0,
  renewed: 0,
  freed: 0,
  shown: 0,
  held: 1,
  behind: 1,
  cooldown: 1,
  "gave-up": 1,
  lost: 3,
  "not-held": 3,
};

class Usage extends Error {}

function wholeNumber(value: string | undefined, flag: string, fallback: number | null): number | null {
  if (value === undefined) return fallback;
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0)
    throw new Usage(`${flag} must be a number of 0 or more, not ${JSON.stringify(value)}`);
  return n;
}

function parseWant(text: string): Want {
  const [name = "", gb, ...extra] = text.split(":");
  if (!NAME_PATTERN.test(name) || extra.length > 0)
    throw new Usage(
      `--res takes a lowercase name with an optional size, such as gpu or ram:10, not ${JSON.stringify(text)}`,
    );
  if (gb === undefined) {
    if (name === RAM) throw new Usage("--res ram needs a size in GB, such as ram:10");
    return { resource: name, gb: null };
  }
  if (name !== RAM) throw new Usage(`only ram is shared by size; --res ${name} takes no :GB`);
  return { resource: name, gb: wholeNumber(gb, "--res ram:GB", 0) ?? 0 };
}

function parseLabels(values: string[] | undefined): Record<string, string> {
  const labels: Record<string, string> = {};
  for (const v of values ?? []) {
    const [name = "", text = ""] = v.split("=");
    if (!NAME_PATTERN.test(name) || !/^[A-Za-z0-9+]{1,4}$/.test(text))
      throw new Usage(
        `--label takes resource=TEXT, one to four letters or digits, such as browser=WEB, not ${JSON.stringify(v)}`,
      );
    labels[name] = text;
  }
  return labels;
}

function wantsFrom(o: ReturnType<typeof parseCli>["values"], command: string): Want[] {
  const res = o.res ?? [];
  if (res.length > 0 && o.gb !== undefined)
    throw new Usage(`${command} needs --res or --gb, not both: --gb G means --res gpu --res ram:G`);
  if (res.length === 0 && o.gb === undefined)
    throw new Usage(`${command} needs --res (such as --res gpu --res ram:10) or --gb`);
  const wants = res.length > 0 ? res.map(parseWant) : legacyWants(wholeNumber(o.gb, "--gb", 0) ?? 0);
  if (new Set(wants.map((w) => w.resource)).size < wants.length)
    throw new Usage("each --res names a different resource");
  return wants;
}

/** Run a command under a lease: take it (waiting up to `waitSeconds`), start the command as its declared job,
 * renew while it runs, and free it however the command ends. The exit code is the command's, or 1 when the lease
 * was not given. A forced free with --stop-job stops the command. */
export async function runUnder(
  args: TakeArgs,
  waitSeconds: number,
  command: string[],
  sys: System = realSystem,
  out: (text: string) => void = console.error,
): Promise<number> {
  const answer = take(args, waitSeconds, sys);
  if (answer.outcome !== "taken" && answer.outcome !== "renewed") {
    out(`lease: not given (${answer.outcome}): ${words(answer.view)}`);
    return 1;
  }
  const who = { name: args.name, pid: args.pid };
  const start = (file: string) =>
    spawn(file, command.slice(1), { stdio: "inherit", windowsHide: true }) as ChildProcess;
  return new Promise<number>((done) => {
    let child = start(command[0] ?? "");
    let tried = false;
    let timer: NodeJS.Timeout | null = null;
    let warned = false;
    const finish = (code: number) => {
      if (timer) clearInterval(timer);
      process.removeListener("SIGINT", stopChild);
      process.removeListener("SIGTERM", stopChild);
      free(who, sys);
      done(code);
    };
    const stopChild = () => child.kill();
    const watch = () => {
      child.once("spawn", () => {
        renew({ ...who, ttl: args.ttl, jobPid: child.pid ?? null }, sys);
        timer = setInterval(() => {
          if (renew({ ...who, ttl: args.ttl, jobPid: child.pid ?? null }, sys).outcome === "lost" && !warned) {
            warned = true;
            out("lease: the lease was taken back (freed by hand, or lapsed); the command keeps running.");
          }
        }, RENEW_SECONDS * 1000);
      });
      child.once("error", (error: NodeJS.ErrnoException) => {
        // On Windows `npm`, `npx` and the like are .cmd files, which spawn does not find by their bare name.
        if (error.code === "ENOENT" && process.platform === "win32" && !tried) {
          tried = true;
          child = start(`${command[0]}.cmd`);
          watch();
          return;
        }
        out(`lease: could not start ${command[0]}: ${error.message}`);
        finish(127);
      });
      child.once("exit", (code, signal) => finish(code ?? (signal ? 1 : 0)));
    };
    process.on("SIGINT", stopChild);
    process.on("SIGTERM", stopChild);
    watch();
  });
}

export function main(
  argv: string[],
  out: (text: string) => void = console.log,
  sys: System = realSystem,
): number | Promise<number> {
  const [command, ...rest] = argv;
  let parsed: ReturnType<typeof parseCli>;
  try {
    parsed = parseCli(rest);
  } catch (error) {
    out(`lease: ${(error as Error).message}. See lease --help.`);
    return 2;
  }
  const o = parsed.values;
  const json = o.json === true;
  const need = (value: string | undefined, flag: string): string => {
    if (value === undefined || value === "") throw new Usage(`${command} needs ${flag}`);
    return value;
  };
  try {
    const who = (): Who => ({
      name: need(o.name, "--name"),
      pid: wholeNumber(o.pid, "--pid", process.ppid) ?? process.ppid,
    });
    const ttl = wholeNumber(o.ttl, "--ttl", TTL_SECONDS) ?? TTL_SECONDS;
    const forSeconds = wholeNumber(o.for, "--for", null);
    let answer: Answer;
    if (command !== "run" && parsed.positionals.length > 0)
      throw new Usage(`${command} takes no words of its own, only flags: ${parsed.positionals.join(" ")}`);
    switch (command) {
      case "run": {
        if (parsed.positionals.length === 0)
          throw new Usage("run needs the command after --, such as lease run --name job --res gpu -- python train.py");
        const wants = wantsFrom(o, "run");
        return runUnder(
          {
            name: need(o.name, "--name"),
            pid: process.pid,
            wants,
            labels: parseLabels(o.label),
            note: o.note ?? parsed.positionals.join(" ").slice(0, 60),
            ttl,
            forSeconds,
          },
          wholeNumber(o.wait, "--wait", 0) ?? 0,
          parsed.positionals,
          sys,
        );
      }
      case "take": {
        const wants = wantsFrom(o, "take");
        answer = take(
          { ...who(), wants, labels: parseLabels(o.label), note: o.note ?? "", ttl, forSeconds },
          wholeNumber(o.wait, "--wait", 0) ?? 0,
          sys,
        );
        break;
      }
      case "renew":
        answer = renew({ ...who(), ttl, jobPid: wholeNumber(o["job-pid"], "--job-pid", null), forSeconds }, sys);
        break;
      case "free":
        answer =
          o.force === true
            ? forceFree(
                {
                  by: o.by ?? "someone",
                  stopJob: o["stop-job"] === true,
                  cooldown: wholeNumber(o.cooldown, "--cooldown", 0) ?? 0,
                  target: o.name === undefined ? undefined : { name: o.name, pid: wholeNumber(o.pid, "--pid", null) },
                },
                sys,
              )
            : free(who(), sys);
        break;
      case "show":
        answer = show(sys);
        break;
      case "log": {
        const lines = readLog(wholeNumber(o.lines, "--lines", 30) ?? 30);
        out(json ? JSON.stringify(lines) : lines.map(logWords).join("\n") || "(nothing logged yet)");
        return 0;
      }
      case undefined:
      case "help":
      case "--help":
      case "-h":
        out(HELP);
        return 0;
      default:
        throw new Usage(`unknown command ${JSON.stringify(command)}`);
    }
    out(json ? JSON.stringify(answer) : `${answer.outcome}: ${words(answer.view)}`);
    return EXIT[answer.outcome];
  } catch (error) {
    out(`lease: ${(error as Error).message}${error instanceof Usage ? ". See lease --help." : ""}`);
    return 2;
  }
}

function parseCli(args: string[]) {
  return parseArgs({
    args,
    strict: true,
    allowPositionals: true,
    options: {
      name: { type: "string" },
      pid: { type: "string" },
      res: { type: "string", multiple: true },
      gb: { type: "string" },
      label: { type: "string", multiple: true },
      note: { type: "string" },
      wait: { type: "string" },
      for: { type: "string" },
      ttl: { type: "string" },
      "job-pid": { type: "string" },
      force: { type: "boolean" },
      "stop-job": { type: "boolean" },
      by: { type: "string" },
      cooldown: { type: "string" },
      lines: { type: "string" },
      json: { type: "boolean" },
    },
  });
}

const HELP = `lease: shared locks on this machine's resources (state and log in ${home()}).

  lease take --name N --res R[:GB] [--res ...] [--label R=TEXT] [--note T] [--pid P] [--wait S] [--for S]
      Take every resource named, or none, for process P (default: the caller). ram is shared by size
      (ram:10 is 10 GB); any other name, such as gpu or browser, has one holder. --gb G alone means
      --res gpu --res ram:G. Held: wait up to S seconds (default 0), listed as a waiter. --for says how long
      the job should take; past it the lease shows as stuck, and stays held. Taking again renews it.
  lease renew --name N [--pid P] [--job-pid J] [--for S]
      Keep it: every ${RENEW_SECONDS} s; it lapses ${TTL_SECONDS} s after the last renewal. --job-pid declares the
      process doing the heavy work, which "free --stop-job" may stop and whose life keeps an orphaned lease held.
  lease free --name N [--pid P]          Give it back.
  lease free --force [--name N [--pid P]] [--stop-job] [--by WHO] [--cooldown S]
      Free N's lease (with no --name: the GPU's holder, else the oldest) whoever you are; --stop-job also
      stops the job it declared (nothing else); --cooldown keeps it from taking again for S seconds.
  lease run --name N --res R[:GB] ... [--note T] [--wait S] [--for S] -- COMMAND [ARGS]
      Take the lease, run COMMAND as its job, renew it while COMMAND runs and free it when COMMAND ends,
      however it ends. Exits with COMMAND's code, or 1 when the lease was not given within S seconds.
  lease show                             Who holds what, how it is doing, who waits, free RAM.
  lease log [--lines N]                  The last N events (default 30).

  --json prints a form a program can read. Exit codes: 0 done, 1 held by another, behind a waiter or cooling
  down, 2 bad arguments or an error, 3 not yours (freed, lapsed or taken by another).`;

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  void Promise.resolve(main(process.argv.slice(2))).then((code) => {
    process.exitCode = code;
  });
}
