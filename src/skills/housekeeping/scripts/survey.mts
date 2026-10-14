#!/usr/bin/env node
// Survey a git repository before housekeeping. Reports only: it changes and deletes nothing.
import { execFileSync } from "node:child_process";
import { existsSync, lstatSync, readdirSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { basename, join, resolve } from "node:path";
import { parseArgs } from "node:util";

const HELP = `Survey a git repository before housekeeping. Reports only.

  node survey.mjs [repo] [--also DIR ...] [--days N] [--big MB] [--json]

repo     the repository to look at (default: the current folder)
--also   a folder outside the repository to size up as well (a data or cache folder); may be given more than once
--days   what counts as old, in days (default 14)
--big    what counts as a big file, in MB (default 5)
--json   print JSON instead of text

Needs Node 22 or later and git. Exit codes: 0 done, 2 not a git repository or bad arguments.`;

// Folders that are made again by tools; their size says nothing about the owner's data.
const SKIP = new Set([
  ".git",
  "node_modules",
  ".venv",
  "venv",
  "__pycache__",
  ".ruff_cache",
  ".pytest_cache",
  "dist",
  "build",
  "target",
]);
const MB = 1_048_576;
const DAY_MS = 86_400_000;
const SHOWN = 20; // rows per list in the text report; the JSON has them all

interface Branch {
  name: string;
  days_old: number;
  commits_not_in_default: number | null;
  upstream_gone: boolean;
}
interface Entry {
  name: string;
  mb: number;
  files: number;
  days_untouched: number;
  old: boolean;
}
type Folder = { folder: string; error: string } | { folder: string; total_mb: number; entries: Entry[] };

/** The lines git prints, or none when it fails (not a repository, no remote, an old git). */
function git(repo: string, ...args: string[]): string[] {
  try {
    const out = execFileSync("git", ["-C", repo, ...args], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
      windowsHide: true,
    });
    return out.split(/\r?\n/).filter((line) => line.trim());
  } catch {
    return [];
  }
}

function defaultBranch(repo: string): string {
  const head = git(repo, "symbolic-ref", "--short", "refs/remotes/origin/HEAD")[0];
  if (head) return head.split("/").slice(1).join("/");
  const names = new Set(git(repo, "branch", "--format=%(refname:short)").map((n) => n.trim()));
  return ["main", "master"].find((n) => names.has(n)) ?? "";
}

/** Bytes, files and the newest change under a folder, without following links. */
function sizeOf(folder: string): { size: number; files: number; newest: number } {
  let size = 0;
  let files = 0;
  let newest = 0;
  const walk = (dir: string): void => {
    let names: string[];
    try {
      names = readdirSync(dir);
    } catch {
      return;
    }
    for (const name of names) {
      const path = join(dir, name);
      try {
        const info = lstatSync(path);
        if (info.isDirectory()) walk(path);
        else {
          size += info.size;
          files += 1;
          newest = Math.max(newest, info.mtimeMs);
        }
      } catch {
        // gone or unreadable since the listing: skip it
      }
    }
  };
  walk(folder);
  return { size, files, newest };
}

const mb = (bytes: number): number => Math.round((bytes / MB) * 10) / 10;

function repoFacts(repo: string, days: number, bigMb: number) {
  const now = Date.now();
  const main = defaultBranch(repo);
  const status = git(repo, "status", "--porcelain");
  const branches: Branch[] = [];
  for (const line of git(
    repo,
    "for-each-ref",
    "refs/heads",
    "--format=%(refname:short)\t%(committerdate:unix)\t%(upstream:track)",
  )) {
    const [name = "", when = "0", track = ""] = line.split("\t");
    if (name === main) continue;
    const ahead = main ? git(repo, "rev-list", "--count", `${main}..${name}`)[0] : undefined;
    branches.push({
      name,
      days_old: Math.floor((now - Number(when) * 1000) / DAY_MS),
      commits_not_in_default: ahead === undefined ? null : Number(ahead),
      upstream_gone: track.includes("gone"),
    });
  }
  const worktrees = git(repo, "worktree", "list", "--porcelain")
    .filter((line) => line.startsWith("worktree "))
    .map((line) => line.slice("worktree ".length))
    .slice(1);
  const big = git(repo, "ls-files")
    .map((file) => {
      try {
        return { file, mb: mb(statSync(join(repo, file)).size) };
      } catch {
        return { file, mb: 0 };
      }
    })
    .filter((f) => f.mb >= bigMb)
    .sort((a, b) => b.mb - a.mb);
  const ignored = git(repo, "status", "--porcelain", "--ignored")
    .filter((line) => line.startsWith("!! "))
    .map((line) => line.slice(3).replace(/^"|"$/g, ""))
    .filter((path) => !SKIP.has(basename(path.replace(/\/$/, ""))))
    .map((path) => {
      const full = join(repo, path);
      const isDir = existsSync(full) && statSync(full).isDirectory();
      const { size, files } = isDir ? sizeOf(full) : { size: existsSync(full) ? statSync(full).size : 0, files: 1 };
      return { path, mb: mb(size), files };
    })
    .filter((p) => p.mb >= bigMb)
    .sort((a, b) => b.mb - a.mb);
  const last = git(repo, "log", "-1", "--format=%ct")[0];
  return {
    repo,
    default_branch: main,
    days_since_last_commit: last ? Math.floor((now - Number(last) * 1000) / DAY_MS) : null,
    uncommitted: status.filter((s) => !s.startsWith("??")),
    untracked: status.filter((s) => s.startsWith("??")).map((s) => s.slice(3)),
    stashes: git(repo, "stash", "list").length,
    unpushed_commits: git(repo, "log", "--oneline", "@{upstream}..HEAD").length,
    other_branches: branches,
    other_worktrees: worktrees,
    big_tracked_files: big,
    big_ignored_paths: ignored,
    old_means_days: days,
  };
}

/** What is in a folder outside the repository: each entry's size, and how long since anything in it changed. */
function folderFacts(folder: string, days: number): Folder {
  if (!existsSync(folder) || !statSync(folder).isDirectory()) return { folder, error: "not a folder" };
  const now = Date.now();
  const entries: Entry[] = [];
  for (const name of readdirSync(folder).sort()) {
    const path = join(folder, name);
    try {
      const info = lstatSync(path);
      const isDir = info.isDirectory();
      const { size, files, newest } = isDir ? sizeOf(path) : { size: info.size, files: 1, newest: info.mtimeMs };
      const age = Math.floor((now - (newest || info.mtimeMs)) / DAY_MS);
      entries.push({ name: name + (isDir ? "/" : ""), mb: mb(size), files, days_untouched: age, old: age >= days });
    } catch {
      // gone or unreadable since the listing: skip it
    }
  }
  entries.sort((a, b) => b.mb - a.mb);
  return { folder, total_mb: Math.round(entries.reduce((sum, e) => sum + e.mb, 0) * 10) / 10, entries };
}

function asText(repo: ReturnType<typeof repoFacts>, also: Folder[]): string {
  const lines = [
    `Repository: ${repo.repo} (default branch: ${repo.default_branch || "unknown"}, last commit ${repo.days_since_last_commit} days ago)`,
    `Uncommitted changes: ${repo.uncommitted.length}   Untracked: ${repo.untracked.length}   Stashes: ${repo.stashes}   Commits not pushed: ${repo.unpushed_commits}`,
  ];
  for (const name of repo.untracked.slice(0, SHOWN)) lines.push(`  untracked: ${name}`);
  for (const b of repo.other_branches) {
    const notes = [`${b.days_old} days old`];
    if (b.commits_not_in_default === 0) notes.push("nothing the default branch lacks");
    else if (b.commits_not_in_default) notes.push(`${b.commits_not_in_default} commits not in the default branch`);
    if (b.upstream_gone) notes.push("its remote branch is gone");
    lines.push(`  branch ${b.name}: ${notes.join(", ")}`);
  }
  for (const w of repo.other_worktrees) lines.push(`  worktree: ${w}`);
  for (const f of repo.big_tracked_files.slice(0, SHOWN)) lines.push(`  big file in git: ${f.file} (${f.mb} MB)`);
  for (const f of repo.big_ignored_paths.slice(0, SHOWN))
    lines.push(`  big and ignored by git: ${f.path} (${f.mb} MB, ${f.files} files)`);
  for (const folder of also) {
    if ("error" in folder) {
      lines.push(`\n${folder.folder}: ${folder.error}`);
      continue;
    }
    lines.push(`\n${folder.folder}: ${folder.total_mb} MB`);
    for (const e of folder.entries.slice(0, SHOWN * 2))
      lines.push(
        `  ${String(e.mb).padStart(10)} MB  ${String(e.days_untouched).padStart(4)} days untouched  ${e.name}${e.old ? "  (old)" : ""}`,
      );
  }
  lines.push("\nNothing was changed. This is a report.");
  return lines.join("\n");
}

function main(): number {
  let args: ReturnType<typeof parseArgs>;
  try {
    args = parseArgs({
      allowPositionals: true,
      options: {
        also: { type: "string", multiple: true, default: [] },
        days: { type: "string", default: "14" },
        big: { type: "string", default: "5" },
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
  const repo = resolve((args.positionals[0] ?? ".").replace(/^~/, homedir()));
  const top = git(repo, "rev-parse", "--show-toplevel")[0];
  if (!top) {
    console.error(`${repo} is not a git repository (or git is not installed). Pass the repository's folder.`);
    return 2;
  }
  const days = Number(args.values.days);
  const big = Number(args.values.big);
  if (!Number.isFinite(days) || !Number.isFinite(big)) {
    console.error("--days and --big take numbers, such as --days 14 --big 5.");
    return 2;
  }
  const facts = repoFacts(resolve(top), days, big);
  const also = (args.values.also as string[]).map((d) => folderFacts(resolve(d.replace(/^~/, homedir())), days));
  console.log(args.values.json ? JSON.stringify({ repo: facts, also }, null, 2) : asText(facts, also));
  return 0;
}

process.exitCode = main();
