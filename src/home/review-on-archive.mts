#!/usr/bin/env node
// Review a Claude Code session for lessons when it is archived in the Claude desktop app. Report only.
import { spawn, spawnSync } from "node:child_process";
import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { homedir } from "node:os";
import { basename, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const HELP = `Review a Claude Code session for lessons when it is archived in the Claude desktop app.

  node review-on-archive.mjs             as a SessionEnd hook: queue the session from the hook's JSON on
                                         stdin and start a drain in the background
  node review-on-archive.mjs drain       review every queued session the app shows as archived
  node review-on-archive.mjs review ID   review one session now, archived or not (ID or path to .jsonl)

Archiving fires SessionEnd, but so do quitting the app and its restarts: a queued session is reviewed only once
the app's own record of it says archived, and waits in the queue (up to ${14} days) until then.
Each review runs the session-review skill's scripts, then a headless Claude with read-only tools, and writes
the report to ~/.claude/session-reviews/. It never edits a skill or an instruction file.
Exit codes: 0 done, 1 a review failed, 2 bad arguments.`;

const HOME = join(homedir(), ".claude", "session-reviews");
const QUEUE = join(HOME, "queue.jsonl");
const DONE = join(HOME, "done.json");
const LOCK = join(HOME, "drain.lock");
const LOG = join(HOME, "log.txt");
// The installed skill; SESSION_REVIEW_SKILL points at another copy (a checkout, to try a change).
const SKILL = process.env.SESSION_REVIEW_SKILL ?? join(homedir(), ".claude", "skills", "session-review");
const MODEL = "sonnet"; // judgement over a few thousand lines of text; the largest models cost five times more
const MAX_TURNS = "30"; // reading the instruction files and skills a lesson might already be in
const MAX_BUDGET_USD = "1"; // a stop for a runaway review; a normal one costs a few cents
const SETTLE_MS = 20_000; // the app marks the session archived around when it ends the process
const REVIEW_TIMEOUT_MS = 10 * 60_000; // a review takes one to three minutes; a hang shows within ten
const STALE_LOCK_MS = 30 * 60_000; // three hung reviews: by then the drain holding the lock is gone
const KEEP_DAYS = 14; // a session ended by an app restart waits this long to be archived
const LAUNCH_TIMEOUT_MS = 8_000; // under the hook's own ten seconds; the launch takes about one
const MIN_PROMPTS = 2; // one prompt and no hand edits leaves nothing to correct

interface Queued {
  session_id: string;
  transcript_path: string;
  cwd?: string;
  queued_at: string;
}

const log = (line: string): void => {
  mkdirSync(HOME, { recursive: true });
  appendFileSync(LOG, `${new Date().toISOString()} ${line}\n`);
};

function readJson<T>(path: string, fallback: T): T {
  try {
    return JSON.parse(readFileSync(path, "utf8")) as T;
  } catch {
    return fallback;
  }
}

function readQueue(): Queued[] {
  if (!existsSync(QUEUE)) return [];
  return readFileSync(QUEUE, "utf8")
    .split("\n")
    .flatMap((l) => {
      try {
        return [JSON.parse(l) as Queued];
      } catch {
        return [];
      }
    });
}

/** The desktop app's record of the session whose Claude Code id this is: its title, archived state and link id. */
function appRecord(sessionId: string): { title?: string; isArchived?: boolean; sessionId?: string } | undefined {
  const roots = [
    join(process.env.APPDATA ?? join(homedir(), "AppData", "Roaming"), "Claude", "claude-code-sessions"),
    join(homedir(), "Library", "Application Support", "Claude", "claude-code-sessions"),
  ];
  const walk = (dir: string, depth: number): string[] => {
    let names: string[];
    try {
      names = readdirSync(dir);
    } catch {
      return [];
    }
    return names.flatMap((n) =>
      depth ? walk(join(dir, n), depth - 1) : n.startsWith("local_") && n.endsWith(".json") ? [join(dir, n)] : [],
    );
  };
  for (const file of roots.flatMap((r) => walk(r, 2))) {
    const record = readJson<Record<string, unknown>>(file, {});
    if (record.cliSessionId === sessionId) return record as ReturnType<typeof appRecord>;
  }
  return undefined;
}

/** Start the drain in the background, outside the app's process job, so it outlives the session and the app. */
function startDrain(): void {
  const self = fileURLToPath(import.meta.url);
  const command = `"${process.execPath}" "${self}" drain`;
  if (process.platform === "win32") {
    // Win32_Process.Create starts the process from the WMI service: not a child, not in the app's job.
    const ps =
      "$s=New-CimInstance -ClassName Win32_ProcessStartup -ClientOnly -Property @{ShowWindow=[uint16]0};" +
      "Invoke-CimMethod -ClassName Win32_Process -MethodName Create -Arguments @{CommandLine=$env:REVIEW_COMMAND;ProcessStartupInformation=$s} | Out-Null";
    // Waited for (about a second): a detached PowerShell never ran the command, and one left running died with
    // the hook. Claude Code gives SessionEnd hooks the longest timeout set on one, ten seconds here.
    spawnSync("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", ps], {
      stdio: "ignore",
      windowsHide: true,
      timeout: LAUNCH_TIMEOUT_MS,
      env: { ...process.env, REVIEW_COMMAND: command },
    });
    return;
  }
  spawn(process.execPath, [self, "drain"], { detached: true, stdio: "ignore" }).unref();
}

function hook(): number {
  // The review's own headless session ends too; it has nothing to queue.
  if (process.env.SESSION_REVIEW_CHILD) return 0;
  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(readFileSync(0, "utf8"));
  } catch {
    return 0;
  }
  if (typeof payload.session_id !== "string" || typeof payload.transcript_path !== "string") return 0;
  mkdirSync(HOME, { recursive: true });
  const entry: Queued = {
    session_id: payload.session_id,
    transcript_path: payload.transcript_path,
    cwd: typeof payload.cwd === "string" ? payload.cwd : undefined,
    queued_at: new Date().toISOString(),
  };
  appendFileSync(QUEUE, `${JSON.stringify(entry)}\n`);
  startDrain();
  return 0;
}

function run(script: string, args: string[]): string {
  const done = spawnSync(process.execPath, [join(SKILL, "scripts", script), ...args], {
    encoding: "utf8",
    windowsHide: true,
    maxBuffer: 64 * 1024 * 1024,
  });
  if (done.status !== 0)
    throw new Error(`${script} failed: ${(done.error?.message ?? done.stderr ?? "").trim().slice(0, 300)}`);
  return `${done.stderr.trim()}\n${done.stdout.trim()}`.trim();
}

const slug = (text: string): string =>
  text
    .replace(/[<>:"/\\|?*]/g, "") // not allowed in a Windows file name
    .trim()
    .slice(0, 60) || "session";

/** One review: the skill's scripts, then a headless Claude that may only read. Returns the report's path. */
function review(transcript: string, sessionId: string): string | undefined {
  if (!existsSync(join(SKILL, "scripts", "edits.mjs")))
    throw new Error(`${SKILL} has no scripts/edits.mjs; install the session-review skill again`);
  mkdirSync(HOME, { recursive: true }); // the review runs from here
  const prompts = run("prompts.mjs", ["--session", transcript, "--context", "300"]);
  const edits = run("edits.mjs", ["--session", transcript]);
  const promptCount = Number(/^(\d+) prompts/m.exec(prompts)?.[1] ?? 0);
  const editCount = Number(/^(\d+) hand changes/m.exec(edits)?.[1] ?? 0);
  if (promptCount < MIN_PROMPTS && editCount === 0) {
    log(`skipped ${sessionId}: ${promptCount} prompts, no hand edits`);
    return undefined;
  }
  const record = appRecord(sessionId);
  const title = record?.title ?? basename(transcript, ".jsonl");
  const ask = [
    "Review one finished coding-agent session for lessons, following the skill below in its one-session mode.",
    "Step 1 is done: its output is below. Do steps 2 to 5, reading the user's instruction files, memory and installed skills",
    `(under ${join(homedir(), ".claude")}, ${join(homedir(), ".agents")} and the project folders the session worked in) to see where each lesson is already written.`,
    "Step 6: your final answer is the report itself, in Markdown, and nothing else: the table, then one line on what was left out.",
    "Name the exact file each lesson belongs in. If there is nothing worth a rule, answer only: No lessons.",
    "",
    "<skill>",
    readFileSync(join(SKILL, "SKILL.md"), "utf8"),
    "</skill>",
    "",
    `<session title="${title.replace(/"/g, "'")}" id="${sessionId}">`,
    "<prompts>",
    prompts,
    "</prompts>",
    "<hand-edits>",
    edits,
    "</hand-edits>",
    "</session>",
  ].join("\n");
  const done = spawnSync(
    "claude",
    [
      "-p",
      "--model",
      MODEL,
      "--output-format",
      "json",
      "--max-turns",
      MAX_TURNS,
      "--max-budget-usd",
      MAX_BUDGET_USD,
      // Read-only: the review reports and never edits an instruction file.
      "--tools",
      "Read,Glob,Grep",
      "--allowedTools",
      "Read,Glob,Grep",
      "--strict-mcp-config",
      // No user settings: their hooks would log the review as the user's own session.
      "--setting-sources",
      "project",
      "--no-session-persistence",
    ],
    {
      cwd: HOME,
      input: ask,
      encoding: "utf8",
      shell: process.platform === "win32", // claude is a .cmd or .exe on PATH
      windowsHide: true,
      timeout: REVIEW_TIMEOUT_MS,
      maxBuffer: 64 * 1024 * 1024,
      env: { ...process.env, SESSION_REVIEW_CHILD: "1" },
    },
  );
  let result: { result?: string; total_cost_usd?: number; is_error?: boolean; num_turns?: number };
  try {
    result = JSON.parse(done.stdout);
  } catch {
    const said = done.error?.message ?? (done.stderr || done.stdout || "");
    throw new Error(`claude gave no JSON (exit ${done.status}): ${said.trim().slice(0, 300)}`);
  }
  if (result.is_error || !result.result) throw new Error(`claude failed: ${JSON.stringify(result).slice(0, 300)}`);
  const date = new Date().toISOString().slice(0, 10);
  const report = join(HOME, `${date} ${slug(title)}.md`);
  const link = record?.sessionId ? ` · [open the session](claude://claude.ai/epitaxy/${record.sessionId})` : "";
  const cost = result.total_cost_usd === undefined ? "" : ` · $${result.total_cost_usd.toFixed(2)}`;
  writeFileSync(
    report,
    `# ${title}\n\n${date}${link}${cost} · ${promptCount} prompts, ${editCount} hand edits\n\n${result.result.trim()}\n`,
  );
  log(`reviewed ${sessionId} -> ${report}${cost}`);
  notify(title, report);
  return report;
}

/** A Windows notification that opens the report; elsewhere the log and the folder are enough. */
function notify(title: string, report: string): void {
  if (process.platform !== "win32") return;
  const xml = `<toast activationType="protocol" launch="${pathToFileURL(report).href}"><visual><binding template="ToastGeneric"><text>Session review ready</text><text>${title.replace(/[<>&"]/g, "")}</text></binding></visual></toast>`;
  // Windows PowerShell 5.1, which can load the WinRT notification types; its own app id shows the toast.
  const ps = [
    "[Windows.UI.Notifications.ToastNotificationManager,Windows.UI.Notifications,ContentType=WindowsRuntime]|Out-Null",
    "[Windows.Data.Xml.Dom.XmlDocument,Windows.Data.Xml.Dom.XmlDocument,ContentType=WindowsRuntime]|Out-Null",
    "$x=New-Object Windows.Data.Xml.Dom.XmlDocument;$x.LoadXml($env:REVIEW_TOAST)",
    "$id='{1AC14E77-02E7-4E5D-B744-2EB1AE5198B7}\\WindowsPowerShell\\v1.0\\powershell.exe'",
    "[Windows.UI.Notifications.ToastNotificationManager]::CreateToastNotifier($id).Show([Windows.UI.Notifications.ToastNotification]::new($x))",
  ].join(";");
  spawnSync("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", ps], {
    windowsHide: true,
    timeout: 30_000,
    env: { ...process.env, REVIEW_TOAST: xml },
  });
}

async function drain(): Promise<number> {
  mkdirSync(HOME, { recursive: true });
  const held = statSync(LOCK, { throwIfNoEntry: false });
  if (held && Date.now() - held.mtimeMs < STALE_LOCK_MS) return 0; // another drain is running and rereads the queue
  writeFileSync(LOCK, String(process.pid));
  let failed = 0;
  try {
    await new Promise((r) => setTimeout(r, SETTLE_MS));
    const done = readJson<Record<string, number>>(DONE, {});
    const seen = new Set<string>();
    for (;;) {
      const queue = readQueue();
      const next = queue.find((q) => !seen.has(q.session_id));
      if (!next) break;
      seen.add(next.session_id);
      const mtime = statSync(next.transcript_path, { throwIfNoEntry: false })?.mtimeMs;
      const old = Date.now() - Date.parse(next.queued_at) > KEEP_DAYS * 86_400_000;
      let keep = false;
      if (mtime === undefined || old) log(`dropped ${next.session_id}: ${old ? "never archived" : "no transcript"}`);
      else if (done[next.session_id] === mtime) log(`skipped ${next.session_id}: reviewed already`);
      else if (!appRecord(next.session_id)?.isArchived) keep = true;
      else {
        try {
          review(next.transcript_path, next.session_id);
          done[next.session_id] = mtime;
          writeFileSync(DONE, JSON.stringify(done));
        } catch (e) {
          failed++;
          log(`failed ${next.session_id}: ${(e as Error).message}`);
        }
      }
      // Rewrite from a fresh read: the hook may have queued more while this one ran.
      const rest = readQueue().filter((q) => q.session_id !== next.session_id || keep);
      const unique = [...new Map(rest.map((q) => [q.session_id, q])).values()];
      writeFileSync(QUEUE, unique.map((q) => `${JSON.stringify(q)}\n`).join(""));
    }
  } finally {
    rmSync(LOCK, { force: true });
  }
  return failed ? 1 : 0;
}

async function main(): Promise<number> {
  const [mode, arg] = process.argv.slice(2);
  if (mode === "--help" || mode === "-h") {
    console.log(HELP);
    return 0;
  }
  if (!mode) return hook();
  if (mode === "drain") return drain();
  if (mode === "review" && arg) {
    const id = basename(arg, ".jsonl");
    try {
      const transcript = arg.endsWith(".jsonl") ? arg : findTranscript(id);
      const report = review(transcript, id);
      console.log(report ?? "nothing to review: too few prompts and no hand edits");
      return 0;
    } catch (e) {
      console.error((e as Error).message);
      return 1;
    }
  }
  console.error(HELP);
  return 2;
}

function findTranscript(id: string): string {
  const root = join(homedir(), ".claude", "projects");
  for (const dir of readdirSync(root)) {
    const path = join(root, dir, `${id}.jsonl`);
    if (existsSync(path)) return path;
  }
  throw new Error(`no transcript ${id}.jsonl under ${root}`);
}

process.exitCode = await main();
