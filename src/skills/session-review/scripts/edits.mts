#!/usr/bin/env node
// Show what the user changed by hand in files a coding-agent session wrote: each is a correction they never typed.
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join, resolve } from "node:path";
import { parseArgs } from "node:util";
import { defaultRoots, findSession, jsonlFiles, SECRETS } from "./prompts.mjs";

const HELP = `Show what the user changed by hand in the files one coding-agent session wrote.

  node edits.mjs --session ID|PATH [ROOT ...] [--chars N] [--limit N] [--json]

--session   the session: its id (the transcript's file name) or the path of its .jsonl
ROOT        folders of session transcripts, searched for the session and for later writes to the same files.
            Default: ~/.claude/projects
--chars     characters of word diff kept per change (default 5000)
--limit     the most changes printed (default 40); the rest are counted
--json      one JSON object per line in place of text

For each file the session wrote, the agent's version after its write is compared with what came next: the
file as the next agent write found it (in any session), or the file on disk now. A difference there was made
outside the agent's edits: by the user, or by a command that names the file or rewrites files (a script, a
formatter, git). Changes with no such command in between come first; the others name the commands. Also shows
where the user changed an edit the agent proposed before accepting it.
Reads Claude Code transcripts only. Needs git, for its word diff. Writes nothing but a temporary folder it
removes. Anything that looks like a key or token is replaced with [secret removed].
Exit codes: 0 done, 1 session not found, 2 bad arguments.`;

const DEFAULT_CHARS = 5000; // enough of a diff to see the pattern of a rewrite; past that it is one rewrite
const DEFAULT_LIMIT = 40; // more than one session's worth of hand edits; past that the diffs are noise
const MIN_PIECE = 3; // shorter changed text (a quote, "an") is found in almost any script by chance
const MIN_LINE = 8; // a shorter line a command wrote ("}", "</Fig>") matches anything
const NEAR = 0.4; // share of words two lines need to be one line reworded: "a game, under 1¢" vs "1 game, < $0.01"
const COMMAND_CHARS = 100; // enough to see what a command was; the rest is its script
const COMMANDS_SHOWN = 3; // a few say whether the agent was editing the file; the count says the rest
const MAX_FILE_BYTES = 1_000_000; // larger files are data or builds, not text the user rewrites
// Commands that change files without an Edit: their runs between a write and the next look are named.
const FILE_CHANGERS =
  /\b(biome|prettier|eslint|ruff|black|gofmt|rustfmt|sed|perl|git (checkout|restore|merge|rebase|pull|stash|reset|apply|cherry-pick))\b/;

interface Write {
  file: string; // the key: resolved, and lower case where paths ignore case
  path: string;
  session: string;
  ts: string;
  before: string | null;
  after: string | null;
}

interface Command {
  ts: string;
  session: string;
  command: string;
}

interface Change {
  file: string;
  written: string;
  against: string;
  skills: string[];
  commands: string[];
  diff: string;
  blob: string; // every command in between, flattened, to tell the agent's changes from the user's
}

const keyOf = (path: string): string => {
  const full = resolve(path);
  return process.platform === "win32" || process.platform === "darwin" ? full.toLowerCase() : full;
};
const lf = (text: string): string => text.replace(/\r\n/g, "\n");

function replaceOnce(text: string, from: string, to: string, all: boolean): string | null {
  if (all) return text.split(from).join(to);
  const at = text.indexOf(from);
  return at < 0 ? null : text.slice(0, at) + to + text.slice(at + from.length);
}

type Entry = Record<string, unknown>;

/** The file state before and after one Write or Edit result, from Claude Code's toolUseResult. */
function writeOf(e: Entry, previous: string | null): Omit<Write, "file" | "session" | "ts"> | null {
  const r = e.toolUseResult as Entry | undefined;
  if (typeof r !== "object" || r === null || Array.isArray(r) || typeof r.filePath !== "string") return null;
  const before = typeof r.originalFile === "string" ? lf(r.originalFile) : previous;
  if (typeof r.content === "string" && (r.type === "create" || r.type === "update"))
    return { path: r.filePath, before, after: lf(r.content) };
  const edits = Array.isArray(r.edits)
    ? (r.edits as Entry[])
    : typeof r.oldString === "string"
      ? [{ old_string: r.oldString, new_string: r.newString, replace_all: r.replaceAll }]
      : null;
  if (!edits) return null;
  let after = before;
  for (const edit of edits) {
    if (after === null) break;
    after = replaceOnce(
      after,
      lf(String(edit.old_string)),
      lf(String(edit.new_string ?? "")),
      Boolean(edit.replace_all),
    );
  }
  return { path: r.filePath, before, after };
}

function entries(path: string, mustHave?: string[]): Entry[] {
  let text: string;
  try {
    text = readFileSync(path, "utf8");
  } catch {
    return [];
  }
  if (mustHave && !mustHave.some((s) => text.includes(s))) return [];
  const out: Entry[] = [];
  for (const line of text.split("\n")) {
    if (mustHave && !mustHave.some((s) => line.includes(s))) continue;
    try {
      const e = JSON.parse(line);
      if (typeof e === "object" && e !== null && !e.isSidechain) out.push(e);
    } catch {
      // a line cut off while the session was writing it
    }
  }
  return out;
}

function toolUses(e: Entry): Entry[] {
  const content = (e.message as Entry | undefined)?.content;
  return Array.isArray(content) ? content.filter((p) => p?.type === "tool_use") : [];
}

const flat = (text: string): string =>
  text
    .replace(/\\[nt]/g, " ")
    .replace(/\\(["'`$])/g, "$1")
    .replace(/\s+/g, " ");

/**
 * Drop changed lines whose every changed piece of text is in a command run in between: an agent's sed or script
 * wrote them. Pieces shorter than MIN_PIECE (a quote, a full stop) prove nothing either way.
 */
function hand(diff: string, blob: string): { kept: string; dropped: number } {
  if (!blob) return { kept: diff, dropped: 0 };
  const all = flat(blob);
  const written = blob
    .split(/\n|\\n/)
    .map((l) => flat(l).trim())
    .filter((l) => l.length >= MIN_LINE);
  let dropped = 0;
  const lines = diff.split("\n").flatMap((line) => {
    const pieces = [...line.matchAll(/\[-(.*?)-\]|\{\+(.*?)\+\}/g)].map((m) => flat(m[1] ?? m[2] ?? "").trim());
    const long = pieces.filter((p) => p.length >= MIN_PIECE);
    if (long.length > 0 && long.every((p) => all.includes(p))) {
      dropped++;
      return [];
    }
    // A whole new line may replace one a command wrote, which the agent's version from its edits never had.
    const added = /^\{\+(.*)\+\}$/.exec(line.trim())?.[1];
    const near = added ? nearest(flat(added), written) : undefined;
    return near ? [line, `    (a command had written: ${near.slice(0, COMMAND_CHARS)})`] : [line];
  });
  // A hunk left with no change in it is only context.
  const hunks = lines
    .join("\n")
    .split(/(?=^@@)/m)
    .filter((h) => /\[-|\{\+/.test(h));
  return { kept: hunks.join("").trim(), dropped };
}

const words = (text: string): Set<string> => new Set(text.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? []);

/** The line a command wrote that shares the most words with this one, when it is close but not the same. */
function nearest(line: string, written: string[]): string | undefined {
  const mine = words(line);
  let best: string | undefined;
  let score = NEAR;
  for (const w of written) {
    if (w === line.trim()) return undefined;
    const theirs = words(w);
    const shared = [...mine].filter((x) => theirs.has(x)).length;
    const s = shared / (mine.size + theirs.size - shared || 1);
    if (s >= score) [best, score] = [w, s];
  }
  return best;
}

function wordDiff(dir: string, a: string, b: string, chars: number, blob: string): string {
  writeFileSync(join(dir, "agent"), a);
  writeFileSync(join(dir, "later"), b);
  const done = spawnSync(
    "git",
    ["diff", "--no-index", "--no-color", "--word-diff=plain", "--unified=1", "--", "agent", "later"],
    { cwd: dir, encoding: "utf8", windowsHide: true, maxBuffer: 64 * 1024 * 1024 },
  );
  if (done.error) throw new Error(`git did not run (${done.error.message}); this script needs git on PATH`);
  const body = done.stdout.slice(Math.max(0, done.stdout.indexOf("@@")));
  const { kept, dropped } = hand(body, blob);
  if (!kept) return "";
  const masked = `${kept.replace(SECRETS, "[secret removed]")}${dropped ? `\n(${dropped} changed lines left out: the same text is in a command run in between)` : ""}`;
  return masked.length > chars ? `${masked.slice(0, chars)}\n... ${masked.length - chars} more characters` : masked;
}

function main(): number {
  let args: ReturnType<typeof parseArgs>;
  try {
    args = parseArgs({
      allowPositionals: true,
      options: {
        session: { type: "string" },
        chars: { type: "string", default: String(DEFAULT_CHARS) },
        limit: { type: "string", default: String(DEFAULT_LIMIT) },
        json: { type: "boolean", default: false },
        help: { type: "boolean", short: "h", default: false },
      },
    });
  } catch (e) {
    console.error(`${(e as Error).message}\n\n${HELP}`);
    return 2;
  }
  if (args.values.help) {
    console.log(HELP);
    return 0;
  }
  const session = args.values.session as string | undefined;
  if (!session) {
    console.error(`--session is required.\n\n${HELP}`);
    return 2;
  }
  const chars = Number(args.values.chars);
  const limit = Number(args.values.limit);
  const roots = args.positionals.length ? args.positionals : defaultRoots().filter((r) => !r.includes(".codex"));
  const transcript = findSession(session, roots);
  if (!transcript) {
    console.error(`No transcript for --session ${session} under ${roots.join(", ")}. Pass the .jsonl path instead.`);
    return 1;
  }

  // The session's own writes, the skills it loaded and the commands it ran.
  const mine: Write[] = [];
  const skills = new Set<string>();
  const commands: Command[] = [];
  const proposed = new Map<string, Entry>();
  const changes: Change[] = [];
  let id = basename(transcript, ".jsonl");
  const last = new Map<string, string | null>();
  for (const e of entries(transcript)) {
    id = String(e.sessionId ?? id);
    const ts = String(e.timestamp ?? "");
    for (const use of toolUses(e)) {
      const input = (use.input ?? {}) as Entry;
      proposed.set(String(use.id), input);
      if (use.name === "Skill" && typeof input.skill === "string") skills.add(input.skill);
      const read =
        typeof input.file_path === "string" ? /[\\/]skills[\\/]([^\\/]+)[\\/]SKILL\.md$/i.exec(input.file_path) : null;
      if (read?.[1]) skills.add(read[1]);
      if (typeof input.command === "string") commands.push({ ts, session: id, command: input.command });
    }
    const w = writeOf(e, null);
    if (!w) continue;
    const file = keyOf(w.path);
    if (w.before === null && last.has(file)) w.before = last.get(file) ?? null;
    if (w.after === null && w.before !== null) w.after = writeOf(e, w.before)?.after ?? null;
    last.set(file, w.after);
    mine.push({ ...w, file, session: id, ts });
    // The user changed the edit the agent proposed before accepting it.
    const r = e.toolUseResult as Entry;
    const content = (e.message as Entry | undefined)?.content;
    const useId = Array.isArray(content) ? content.find((p) => p?.type === "tool_result")?.tool_use_id : undefined;
    const asked = proposed.get(String(useId));
    const askedText = asked?.new_string ?? asked?.content;
    const gotText = r.newString ?? r.content;
    if (r.userModified === true && typeof askedText === "string" && typeof gotText === "string")
      changes.push({
        file: w.path,
        written: ts,
        against: "the edit as the user accepted it",
        skills: [],
        commands: [],
        diff: `${lf(askedText)}\0${lf(gotText)}`,
        blob: "",
      });
  }
  if (!mine.length) {
    console.error(`Session ${id} wrote no files.`);
    return 0;
  }

  // Every later write to the same files, from any session: its "before" is what the user left there.
  const files = new Set(mine.map((w) => w.file));
  const first = mine.map((w) => w.ts).sort()[0] ?? "";
  // File names, not paths: a command names a file relative to where it runs.
  const needles = [...new Set(mine.map((w) => basename(w.path)))];
  const later: Write[] = [];
  for (const path of roots.flatMap(jsonlFiles)) {
    if (path === transcript) continue;
    const mtime = statSync(path, { throwIfNoEntry: false })?.mtime.toISOString() ?? "";
    if (mtime < first) continue;
    for (const e of entries(path, needles)) {
      const ts = String(e.timestamp ?? "");
      if (ts <= first) continue;
      const session = String(e.sessionId ?? basename(path, ".jsonl"));
      for (const use of toolUses(e)) {
        const command = (use.input as Entry | undefined)?.command;
        if (typeof command === "string" && needles.some((n) => command.includes(n)))
          commands.push({ ts, session, command });
      }
      const w = writeOf(e, null);
      if (!w || ts <= first || !files.has(keyOf(w.path))) continue;
      later.push({ ...w, file: keyOf(w.path), session, ts });
    }
  }
  const timeline = [...mine, ...later].sort((a, b) => a.ts.localeCompare(b.ts));

  for (const w of mine) {
    if (w.after === null) {
      console.error(`skipped ${w.path} at ${w.ts}: the agent's version could not be rebuilt from the transcript`);
      continue;
    }
    const next = timeline.find((n) => n.file === w.file && n.ts > w.ts);
    let now: string | null;
    let against: string;
    if (next) {
      if (next.before === null) continue;
      now = next.before;
      against =
        next.session === w.session
          ? `the file at this session's next write (${next.ts})`
          : `the file when session ${next.session} next wrote it (${next.ts})`;
    } else {
      const size = statSync(w.path, { throwIfNoEntry: false })?.size;
      if (size === undefined) {
        changes.push({
          file: w.path,
          written: w.ts,
          against: "the file now",
          skills: [],
          commands: [],
          diff: "(deleted since)",
          blob: "",
        });
        continue;
      }
      if (size > MAX_FILE_BYTES) continue;
      now = lf(readFileSync(w.path, "utf8"));
      against = "the file now";
    }
    if (now === w.after) continue;
    const end = next?.ts ?? "￿";
    const name = basename(w.path);
    const between = commands
      .filter((c) => c.ts > w.ts && c.ts < end)
      .filter((c) => c.command.includes(name) || (c.session === id && FILE_CHANGERS.test(c.command)));
    const blob = between.map((c) => c.command).join("\n");
    const ran = between.map(
      (c) =>
        `${c.session === id ? "" : `(session ${c.session.slice(0, 8)}) `}${c.command.replace(/\s+/g, " ").slice(0, COMMAND_CHARS)}`,
    );
    changes.push({ file: w.path, written: w.ts, against, skills: [], commands: ran, diff: `${w.after}\0${now}`, blob });
  }

  const dir = mkdtempSync(join(tmpdir(), "session-review-"));
  try {
    for (const c of changes) {
      c.skills = [...skills];
      if (c.diff.includes("\0")) {
        const [a = "", b = ""] = c.diff.split("\0");
        c.diff = wordDiff(dir, a, b, chars, c.blob);
      }
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
  // Changes nothing else could have made first: they are the user's for certain.
  const shown = changes
    .filter((c) => c.diff)
    .sort((a, b) => Number(a.commands.length > 0) - Number(b.commands.length > 0));
  console.error(
    `${shown.length} hand changes to files session ${id} wrote${skills.size ? `; skills it used: ${[...skills].join(", ")}` : ""}`,
  );
  for (const c of shown.slice(0, limit)) {
    if (args.values.json) {
      const { blob: _, ...row } = c;
      console.log(JSON.stringify(row));
      continue;
    }
    console.log(`\n## ${c.file}\nagent wrote it ${c.written}; compared with ${c.against}`);
    if (c.commands.length)
      console.log(
        `${c.commands.length} commands in between may have changed it, so some of this may be an agent's: ${c.commands.slice(0, COMMANDS_SHOWN).join(" | ")}`,
      );
    console.log(c.diff);
  }
  if (shown.length > limit) console.error(`... ${shown.length - limit} more not shown; raise --limit`);
  return 0;
}

process.exitCode = main();
