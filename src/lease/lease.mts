/**
 * lease: one shared lock on this machine's GPU and big RAM, kept in a small file, with no server.
 *
 * A program about to start a heavy job (a local model, a batch of containers) takes the lease, renews it while the
 * job runs and frees it after. The lease is never stuck: it lapses when its holder stops renewing, frees at once when
 * the holder's process is gone, and anyone can force it free (`free --force`). Every take, free, lapse and forced free
 * is a line in the log, so "who did what when" has an answer.
 *
 *   lease take --name N --gb G [--note T] [--pid P] [--wait S]
 *   lease renew --name N [--pid P] [--job-pid J]
 *   lease free --name N [--pid P]
 *   lease free --force [--stop-job] [--by WHO] [--cooldown S]
 *   lease show
 *   lease log [--lines N]
 *
 * Exit codes: 0 done, 1 held by another (or behind a waiter, or cooling down), 2 bad arguments or an error,
 * 3 not yours (the lease was freed, lapsed or taken by another).
 */

import { spawnSync } from "node:child_process";
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
import { freemem, homedir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { parseArgs } from "node:util";

export const RENEW_SECONDS = 30;
export const TTL_SECONDS = 120; // four missed renewals: a slow disk or a busy minute does not lose the lease
export const WAITER_SECONDS = 150; // a waiter polls every few seconds; one not seen for this long has given up
export const POLL_SECONDS = 3;
const LOCK_STALE_MS = 10_000; // an operation holds the lock for milliseconds: a lock this old was left by a killed process
const LOCK_GIVE_UP_MS = 15_000;
const LOG_MAX_BYTES = 1_000_000;

export type Job = { pid: number; started: string | null };
export type Holder = {
  name: string;
  pid: number;
  taken: string;
  renewed: string;
  expires: string;
  gb: number;
  note: string;
  job: Job | null;
  orphaned: string | null;
};
export type Waiter = { name: string; pid: number; gb: number; note: string; since: string; seen: string };
export type Cooldown = { name: string; until: string };
export type State = {
  version: 1;
  holder: Holder | null;
  waiting: Waiter[];
  cooldowns: Cooldown[];
  free_gb: number | null;
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
export type View = {
  status: Status;
  holder: Holder | null;
  seconds_left: number | null;
  waiting: Waiter[];
  cooldowns: Cooldown[];
  free_gb: number | null;
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
  return { version: 1, holder: null, waiting: [], cooldowns: [], free_gb: null, measured: null };
}

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

class Shape extends Error {}

function need<T>(value: T | undefined, what: string): T {
  if (value === undefined) throw new Shape(what);
  return value;
}

function parseJob(v: Json | undefined): Job | null {
  if (v === null || v === undefined) return null;
  if (!isObj(v)) throw new Shape("job");
  const started = v.started;
  return { pid: need(pid(v.pid), "job.pid"), started: started === null ? null : need(str(started), "job.started") };
}

function parseHolder(v: Json | undefined): Holder | null {
  if (v === null || v === undefined) return null;
  if (!isObj(v)) throw new Shape("holder");
  const orphaned = v.orphaned;
  return {
    name: need(str(v.name), "holder.name"),
    pid: need(pid(v.pid), "holder.pid"),
    taken: need(str(v.taken), "holder.taken"),
    renewed: need(str(v.renewed), "holder.renewed"),
    expires: need(str(v.expires), "holder.expires"),
    gb: need(num(v.gb), "holder.gb"),
    note: need(str(v.note), "holder.note"),
    job: parseJob(v.job),
    orphaned: orphaned === null || orphaned === undefined ? null : need(str(orphaned), "holder.orphaned"),
  };
}

function parseWaiter(v: Json): Waiter {
  if (!isObj(v)) throw new Shape("waiter");
  return {
    name: need(str(v.name), "waiter.name"),
    pid: need(pid(v.pid), "waiter.pid"),
    gb: need(num(v.gb), "waiter.gb"),
    note: need(str(v.note), "waiter.note"),
    since: need(str(v.since), "waiter.since"),
    seen: need(str(v.seen), "waiter.seen"),
  };
}

function parseCooldown(v: Json): Cooldown {
  if (!isObj(v)) throw new Shape("cooldown");
  return { name: need(str(v.name), "cooldown.name"), until: need(str(v.until), "cooldown.until") };
}

/** The state file's text as a State. Throws Shape (a SyntaxError for text that is not JSON) when it is not one. */
export function parseState(text: string): State {
  const raw = JSON.parse(text) as Json;
  if (!isObj(raw) || raw.version !== 1) throw new Shape("version");
  const list = (v: Json | undefined): Json[] => {
    if (!Array.isArray(v)) throw new Shape("list");
    return v;
  };
  const free = raw.free_gb ?? null;
  const measured = raw.measured ?? null;
  return {
    version: 1,
    holder: parseHolder(raw.holder),
    waiting: list(raw.waiting).map(parseWaiter),
    cooldowns: list(raw.cooldowns ?? []).map(parseCooldown),
    free_gb: free === null ? null : need(num(free), "free_gb"),
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

/** The four ways out, applied on every read: a lapsed lease and a gone holder free it, unless the job the holder
 * declared still runs (then it is orphaned: the RAM is still in use, so it stays held until someone frees it and stops
 * the job). Waiters who stopped asking and cooldowns that ran out are dropped. */
export function tidy({ state, sys, log }: Ops): void {
  const now = sys.now();
  state.free_gb = Math.round(sys.freeGb() * 10) / 10;
  state.measured = iso(now);
  const h = state.holder;
  if (h !== null) {
    const lapsed = now > ms(h.expires);
    const gone = !sys.alive(h.pid);
    if (lapsed || gone) {
      const why = gone ? `its process ${h.pid} is gone` : `not renewed since ${h.renewed}`;
      if (jobRuns(h, sys)) {
        if (h.orphaned === null) {
          h.orphaned = iso(now);
          log({
            event: "orphaned",
            name: h.name,
            pid: h.pid,
            gb: h.gb,
            by: null,
            detail: `${why}; its job ${h.job?.pid} still runs`,
          });
        }
      } else {
        state.holder = null;
        log({ event: gone ? "holder-gone" : "expire", name: h.name, pid: h.pid, gb: h.gb, by: null, detail: why });
      }
    }
  }
  state.waiting = state.waiting.filter((w) => now - ms(w.seen) <= WAITER_SECONDS * 1000 && sys.alive(w.pid));
  state.cooldowns = state.cooldowns.filter((c) => now < ms(c.until));
}

function jobRuns(h: Holder, sys: System): boolean {
  if (h.job === null || !sys.alive(h.job.pid)) return false;
  if (h.orphaned !== null || h.job.started === null) return true; // its start time was compared when it was orphaned
  return sys.started(h.job.pid) === h.job.started; // the same pid, now another program, is not the job
}

export function view(state: State, sys: System): View {
  const h = state.holder;
  return {
    status: h === null ? "free" : h.orphaned !== null ? "orphaned" : "held",
    holder: h,
    seconds_left: h === null ? null : Math.max(0, Math.round((ms(h.expires) - sys.now()) / 1000)),
    waiting: state.waiting,
    cooldowns: state.cooldowns,
    free_gb: state.free_gb,
    measured: state.measured,
  };
}

// --- the operations --------------------------------------------------------------------------------------------

export type Who = { name: string; pid: number };
export type TakeArgs = Who & { gb: number; note: string; ttl: number };

const mine = (h: Holder | null, who: Who) => h !== null && h.name === who.name && h.pid === who.pid;

export function takeOnce(args: TakeArgs, sys: System = realSystem): Answer {
  return withState(sys, ({ state, log }) => {
    const now = sys.now();
    if (mine(state.holder, args)) return { outcome: renewHeld(state, args, sys, log), view: view(state, sys) };
    const isMe = (w: Waiter) => w.name === args.name && w.pid === args.pid;
    const cools = (name: string) => state.cooldowns.some((c) => c.name === name);
    const me = state.waiting.find(isMe);
    const queue = state.waiting.filter((w) => !cools(w.name)); // first come, first served; a waiter in its cooldown is not served
    const place = me === undefined ? queue.length : queue.indexOf(me);
    const behind = place > 0;
    const cooling = cools(args.name);
    const ahead = state.waiting.filter((w) => !isMe(w));
    if (state.holder === null && !behind && !cooling) {
      state.holder = {
        name: args.name,
        pid: args.pid,
        taken: iso(now),
        renewed: iso(now),
        expires: iso(now + args.ttl * 1000),
        gb: args.gb,
        note: args.note,
        job: null,
        orphaned: null,
      };
      state.waiting = ahead;
      log({ event: "take", name: args.name, pid: args.pid, gb: args.gb, by: null, detail: args.note });
      return { outcome: "taken", view: view(state, sys) };
    }
    if (me === undefined && cooling) {
      // Not queued: a holder freed by hand would otherwise stand first in line for when its cooldown ends.
    } else if (me === undefined) {
      state.waiting.push({
        name: args.name,
        pid: args.pid,
        gb: args.gb,
        note: args.note,
        since: iso(now),
        seen: iso(now),
      });
      const why = state.holder !== null ? `held by ${state.holder.name}` : cooling ? "cooling down" : "behind a waiter";
      log({ event: "wait", name: args.name, pid: args.pid, gb: args.gb, by: null, detail: why });
    } else me.seen = iso(now);
    const outcome: Outcome = state.holder !== null ? "held" : cooling ? "cooldown" : "behind";
    return { outcome, view: view(state, sys) };
  });
}

/** Take, waiting up to `waitSeconds` while another holds it (visible as a waiter). One lock: no deadlock. */
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
            gb: args.gb,
            by: null,
            detail: `after ${waitSeconds} s`,
          });
        return { outcome: answer.outcome, view: view(state, sys) };
      });
    }
    sys.sleep(POLL_SECONDS * 1000);
  }
}

function renewHeld(state: State, args: Who & { ttl: number }, sys: System, log: Ops["log"]): Outcome {
  const h = state.holder;
  if (h === null) return "lost";
  const now = sys.now();
  const gap = (now - ms(h.renewed)) / 1000;
  if (gap > 2 * RENEW_SECONDS)
    log({
      event: "renew-gap",
      name: h.name,
      pid: h.pid,
      gb: h.gb,
      by: null,
      detail: `${Math.round(gap)} s since the last renewal`,
    });
  h.renewed = iso(now);
  h.expires = iso(now + args.ttl * 1000);
  h.orphaned = null;
  return "renewed";
}

export function renew(args: Who & { ttl: number; jobPid: number | null }, sys: System = realSystem): Answer {
  const started = args.jobPid === null ? null : sys.started(args.jobPid);
  return withState(sys, ({ state, log }) => {
    if (!mine(state.holder, args)) return { outcome: "lost", view: view(state, sys) };
    const outcome = renewHeld(state, args, sys, log);
    const h = state.holder;
    if (h !== null && args.jobPid !== null && h.job?.pid !== args.jobPid) {
      h.job = { pid: args.jobPid, started };
      log({ event: "job", name: h.name, pid: h.pid, gb: h.gb, by: null, detail: `job ${args.jobPid}` });
    }
    return { outcome, view: view(state, sys) };
  });
}

export function free(who: Who, sys: System = realSystem): Answer {
  return withState(sys, ({ state, log }) => {
    const h = state.holder;
    if (h === null || !mine(h, who)) return { outcome: "not-held", view: view(state, sys) };
    state.holder = null;
    log({ event: "free", name: h.name, pid: h.pid, gb: h.gb, by: null, detail: h.note });
    return { outcome: "freed", view: view(state, sys) };
  });
}

/** Free it whoever holds it. With `stopJob`, the job its holder declared (and only that) is stopped too; a holder
 * that declared none is told by its next renewal and stops its own work. `cooldown` keeps that holder from taking it
 * straight back. */
export function forceFree(args: { by: string; stopJob: boolean; cooldown: number }, sys: System = realSystem): Answer {
  const freed = withState(sys, ({ state, log }) => {
    const h = state.holder;
    if (h === null) return null;
    state.holder = null;
    if (args.cooldown > 0) {
      state.cooldowns = state.cooldowns.filter((c) => c.name !== h.name);
      state.cooldowns.push({ name: h.name, until: iso(sys.now() + args.cooldown * 1000) });
    }
    const stopping = args.stopJob && h.job !== null ? ` and stopping job ${h.job.pid}` : "";
    log({ event: "forced-free", name: h.name, pid: h.pid, gb: h.gb, by: args.by, detail: `${h.note}${stopping}` });
    return h;
  });
  if (freed !== null && args.stopJob && freed.job !== null && sys.alive(freed.job.pid)) {
    const stopped = sys.stop(freed.job.pid);
    withState(sys, ({ log }) =>
      log({
        event: "job-stopped",
        name: freed.name,
        pid: freed.job?.pid ?? null,
        gb: freed.gb,
        by: args.by,
        detail: stopped ? "stopped" : "could not be stopped",
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

export function words(v: View): string {
  const free = v.free_gb === null ? "" : ` · ${Math.round(v.free_gb)} GB free`;
  const waiting = v.waiting.length > 0 ? ` · waiting: ${v.waiting.map((w) => w.name).join(", ")}` : "";
  const h = v.holder;
  if (h === null) return `free${free}${waiting}`;
  const what = `${h.name} (pid ${h.pid})${h.note === "" ? "" : `, ${h.note}`} · ${Math.round(h.gb)} GB`;
  if (v.status === "orphaned")
    return `orphaned: ${what}, its holder is gone and job ${h.job?.pid} still runs${free}${waiting}`;
  return `held by ${what} · ${minutes(v.seconds_left ?? 0)} left${free}${waiting}`;
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

export function main(argv: string[], out: (text: string) => void = console.log, sys: System = realSystem): number {
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
    let answer: Answer;
    switch (command) {
      case "take":
        answer = take(
          { ...who(), gb: wholeNumber(need(o.gb, "--gb"), "--gb", 0) ?? 0, note: o.note ?? "", ttl },
          wholeNumber(o.wait, "--wait", 0) ?? 0,
          sys,
        );
        break;
      case "renew":
        answer = renew({ ...who(), ttl, jobPid: wholeNumber(o["job-pid"], "--job-pid", null) }, sys);
        break;
      case "free":
        answer =
          o.force === true
            ? forceFree(
                {
                  by: o.by ?? "someone",
                  stopJob: o["stop-job"] === true,
                  cooldown: wholeNumber(o.cooldown, "--cooldown", 0) ?? 0,
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
    allowPositionals: false,
    options: {
      name: { type: "string" },
      pid: { type: "string" },
      gb: { type: "string" },
      note: { type: "string" },
      wait: { type: "string" },
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

const HELP = `lease: one shared lock on this machine's GPU and big RAM (state and log in ${home()}).

  lease take --name N --gb G [--note T] [--pid P] [--wait S] [--ttl S]
      Take it for process P (default: the caller). Held by another: wait up to S seconds (default 0),
      listed as a waiter meanwhile. Taking it again while holding it renews it.
  lease renew --name N [--pid P] [--job-pid J] [--ttl S]
      Keep it: every ${RENEW_SECONDS} s; it lapses ${TTL_SECONDS} s after the last renewal. --job-pid declares the
      process doing the heavy work, which "free --stop-job" may stop and whose life keeps an orphaned lease held.
  lease free --name N [--pid P]          Give it back.
  lease free --force [--stop-job] [--by WHO] [--cooldown S]
      Free it whoever holds it; --stop-job also stops the job its holder declared (nothing else);
      --cooldown keeps that holder from taking it again for S seconds.
  lease show                             Who holds it, until when, who waits, free RAM.
  lease log [--lines N]                  The last N events (default 30).

  --json prints a form a program can read. Exit codes: 0 done, 1 held by another, behind a waiter or cooling
  down, 2 bad arguments or an error, 3 not yours (freed, lapsed or taken by another).`;

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  process.exitCode = main(process.argv.slice(2));
}
