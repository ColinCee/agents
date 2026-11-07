// A Claude Code PreToolUse hook (Bash, PowerShell, Edit, Write, MultiEdit): refuse a step until the session has loaded
// the skill for it, refuse a commit that names no paths, and refuse a merge (or a push to main) whose checks have not
// passed: GitHub's free plan cannot require checks on a private repository, so this is the required check. Rules that only point at a skill loaded it about 1 time
// in 3; this refusal loaded shipping-prs every time.
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { homedir } from "node:os";

const input = JSON.parse(readFileSync(0, "utf8"));
const tool = String(input.tool_name ?? "");
const command = String(input.tool_input?.command ?? "");
const file = String(input.tool_input?.file_path ?? "").replaceAll("\\", "/");
const home = homedir().replaceAll("\\", "/").toLowerCase();
// Copies installed from the agents repo: an edit here is lost at the next install.
// Skills count only when the installer's lock says they came from the agents repo; other skills stay editable.
let fromRepo = [];
try {
  const lock = JSON.parse(readFileSync(`${homedir()}/.agents/.skill-lock.json`, "utf8"));
  fromRepo = Object.entries(lock.skills ?? {})
    .filter(([, s]) => s.source === "ColinCee/agents")
    .map(([name]) => `.claude/skills/${name.toLowerCase()}/`);
} catch {}
const installed = [
  ...fromRepo,
  ".claude/hooks/require-skill.mjs",
  ".claude/agents.md",
  ".claude/claude.md",
  ".codex/agents.md",
].some((p) => file.toLowerCase().startsWith(`${home}/${p}`));

// A command at the start of a line or after a separator, in any spelling (git, git.exe, flags before the subcommand).
const at = (name, rest) => new RegExp(`(^|[;&|(\\n]\\s*)${name}(\\.exe)?\\b[^;&|\\n]*?\\b${rest}`);
// git's own subcommand, after its global flags, so a branch named fix-commit is not a commit.
const git = (sub) =>
  new RegExp(`(^|[;&|(\\n]\\s*)git(\\.exe)?(\\s+(-[cC]\\s+("[^"]*"|'[^']*'|\\S+)|--[\\w-]+(=\\S+)?))*\\s+${sub}`);
const prCommand = at("gh", "pr\\s+(create|merge)\\b");
const mergeApi = at("gh", "api\\b[^;&|\\n]*\\/pulls\\/\\d+\\/merge\\b");
const firstPush = git("push\\b[^;&|\\n]*\\s(-u|--set-upstream)\\b");
const prMerge = at("gh", "pr\\s+merge\\b");
// A push whose destination is main or master: `main`, `HEAD:main`, `x:refs/heads/main`.
const pushToMain = git("push\\b[^;&|\\n]*\\s([^\\s:]*:)?(refs\\/heads\\/)?(main|master)(\\s|$)");
const commit = git("commit\\b");
const measuring = /(^|[;&|(\n]\s*)(hyperfine\b|(npm|pnpm) run bench\b)/;
// Docs and code in a project, since code carries comments; not the app's memory, plans or scratch files.
const isDoc =
  /\.(md|py|[cm]?[jt]sx?|ya?ml|sh|ps1|css|html|sql|toml|go|rs|java|kt|swift|cs|c|cpp|h|rb|php)$/i.test(file) &&
  !/\/\.claude\/(projects|plans)\/|\/AppData\/Local\/Temp\/|\/scratchpad\/|\/node_modules\/|lock\.ya?ml$|\.min\.|\.d\.ts$/i.test(file);

function refuse(message) {
  console.error(message);
  process.exit(2);
}

// gh, run where the agent runs it; a test names a stand-in script.
function gh(args) {
  const [file, pre] = process.env.REQUIRE_SKILL_GH ? [process.execPath, [process.env.REQUIRE_SKILL_GH]] : ["gh", []];
  const done = spawnSync(file, [...pre, ...args], { cwd: input.cwd, encoding: "utf8", timeout: 60_000 });
  return { status: done.status, out: `${done.stdout ?? ""}${done.stderr ?? ""}` };
}

// The pull request's checks must all have passed; a repository with no checks at all has nothing to wait for.
function green(number, repo) {
  const where = repo ? ["--repo", repo] : [];
  const checks = gh(["pr", "checks", ...number, ...where]);
  if (checks.status === 0 || /no checks reported/i.test(checks.out)) return;
  const open = checks.out
    .split("\n")
    .filter((l) => /\t(fail|pending|cancel)/i.test(l))
    .map((l) => l.split("\t").slice(0, 2).join(": "))
    .slice(0, 5);
  refuse(
    `Merge only once the checks pass (\`gh pr checks <number> --watch\` exits 0): ${open.join(", ") || "they have not passed"}. Fix a failure first.`,
  );
}

function needs(skill, why) {
  let transcript = "";
  for (const path of [input.transcript_path, input.agent_transcript_path].filter(Boolean)) {
    try {
      transcript += readFileSync(path, "utf8");
    } catch {}
  }
  if (!transcript) return; // nothing to check against: never trap an agent
  // The Skill tool call itself, not any text that merely mentions the skill.
  if (!transcript.includes(`"name":"Skill","input":{"skill":"${skill}"`))
    refuse(`Load the ${skill} skill with the Skill tool (a slash command does not count) before ${why}, and follow it.`);
}

if (tool === "Bash" || tool === "PowerShell") {
  // Quoted text is data (a commit message, a search pattern like "| git commit"), never a command to check.
  const bare = command.replace(/"[^"]*"|'[^']*'/g, '""');
  // The paths may follow a message holding ; or &&, so look for `-- <path>` anywhere after `commit`. Amends, empty
  // commits and merge or cherry-pick conclusions (--no-edit) take no paths.
  if (commit.test(bare) && !/\s--\s+[^\s-]|--(amend|allow-empty|no-edit)\b/.test(bare.slice(bare.search(commit))))
    refuse(
      "Commit only the paths you changed: `git commit -m <message> -- <paths>`. A shared checkout holds other sessions' staged work.",
    );
  if (prCommand.test(bare) || mergeApi.test(bare) || firstPush.test(bare))
    needs("shipping-prs", "pushing a new branch or opening or merging a pull request (its reviews come before the push)");
  const repo = bare.match(/(?:-R|--repo)[\s=]+(\S+)/)?.[1] ?? bare.match(/repos\/([\w.-]+\/[\w.-]+)\/pulls/)?.[1];
  if (prMerge.test(bare)) green(bare.match(/pr\s+merge\s+(\d+)/)?.slice(1) ?? [], repo);
  else if (mergeApi.test(bare)) green(bare.match(/\/pulls\/(\d+)\/merge/)?.slice(1) ?? [], repo);
  else if (pushToMain.test(bare)) {
    // Only the head of a pull request whose checks passed (the route when gh may not merge a workflow change).
    const head = spawnSync("git", ["rev-parse", "HEAD"], { cwd: input.cwd, encoding: "utf8" }).stdout?.trim();
    const pr = head ? gh(["pr", "list", "--state", "open", "--search", head, "--json", "number", "--jq", ".[0].number"]) : null;
    const number = pr?.status === 0 ? pr.out.trim() : "";
    if (!/^\d+$/.test(number))
      refuse("Push to main only the head of an open pull request whose checks have passed; open one, or merge it with `gh pr merge`.");
    green([number], undefined);
  }
  if (measuring.test(bare)) needs("deciding", "measuring or comparing options");
} else if (installed)
  refuse(
    "This file is an installed copy and the next install overwrites it. Change it in its repo (skills, rules and hooks: the agents repo, https://github.com/ColinCee/agents), merge, then run `npm run install-home -- --apply` there.",
  );
else if (isDoc) needs("doc-upkeep", "writing or changing a document or code (comments follow its rules)");
process.exit(0);
