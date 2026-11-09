// A Claude Code PreToolUse hook (Bash, PowerShell, Edit, Write, MultiEdit): refuse a step until the session has loaded
// the skill for it, and refuse a commit that names no paths. Rules that only point at a skill loaded it about 1 time
// in 3; this refusal loaded shipping-prs every time. It also refuses a merge, or a push to main, whose checks have not
// passed: GitHub's free plan cannot require checks on a private repository, so this is the required check.
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

// gh, run where the agent runs it; a test names a stand-in script. Under the app's own hook time limit.
function gh(args) {
  const [file, pre] = process.env.REQUIRE_SKILL_GH ? [process.execPath, [process.env.REQUIRE_SKILL_GH]] : ["gh", []];
  const done = spawnSync(file, [...pre, ...args], { cwd: input.cwd, encoding: "utf8", timeout: 20_000 });
  return { status: done.status, out: `${done.stdout ?? ""}${done.stderr ?? ""}` };
}

// The pull request's checks must all have passed (or, with --auto, none failed: GitHub merges once they pass); a
// repository with no checks at all has nothing to wait for. When gh cannot say, nothing merges.
function green(selector, repo, auto = false) {
  const checks = gh(["pr", "checks", ...selector, ...(repo ? ["--repo", repo] : [])]);
  if (checks.status === 0 || /no checks reported/i.test(checks.out)) return;
  const rows = checks.out.split("\n").filter((l) => /\t(fail|pending|cancel|skipping)/i.test(l));
  if (checks.status === null || (!rows.length && checks.status !== 8))
    refuse(`gh could not tell whether the checks passed (${checks.out.trim().slice(0, 200) || "no answer"}); fix gh first.`);
  const failed = rows.filter((l) => /\t(fail|cancel)/i.test(l));
  if (auto && !failed.length) return;
  const named = (failed.length ? failed : rows).map((l) => l.split("\t").slice(0, 2).join(": ")).slice(0, 5);
  refuse(`Merge only once the checks pass (\`gh pr checks <number> --watch\` exits 0): ${named.join(", ")}. Fix a failure first.`);
}

// Each `gh pr merge` in the command, with what it names (number, URL or branch; none means the current branch's) and
// its --repo. Read with quotes taken off, so `-R "o/r"` and `"664"` count.
const VALUED = new Set(["-R", "--repo", "-t", "--subject", "-b", "--body", "-F", "--body-file", "-A", "--author-email", "--match-head-commit"]);
function merges(text) {
  const found = [];
  for (const m of text.matchAll(/(?:^|[;&|(\n]\s*)(?:\w+=\S*\s+)*gh(?:\.exe)?\s+pr\s+merge\b([^;&|\n]*)/g)) {
    const words = m[1].trim().split(/\s+/).filter(Boolean);
    let selector = [], repo, auto = false;
    for (let i = 0; i < words.length; i++) {
      const [flag, value] = words[i].split(/=(.*)/s);
      if (flag === "--auto") auto = true;
      if (VALUED.has(flag)) {
        const v = value ?? words[++i];
        if (flag === "-R" || flag === "--repo") repo = v;
      } else if (!flag.startsWith("-") && !selector.length) selector = [flag];
    }
    found.push({ selector, repo, auto });
  }
  return found;
}

// A push that lands on main or master: a refspec naming it, --all or --mirror, or a bare push while on it.
function pushesToMain(text) {
  for (const m of text.matchAll(/(?:^|[;&|(\n]\s*)(?:\w+=\S*\s+)*git(?:\.exe)?\s+(?:-C\s+\S+\s+)?push\b([^;&|\n]*)/g)) {
    const words = m[1].trim().split(/\s+/).filter(Boolean);
    if (words.some((w) => w === "--all" || w === "--mirror")) return true;
    const refs = words.filter((w) => !w.startsWith("-")).slice(1); // after the remote
    if (refs.some((r) => /^\+?([^:]*:)?(refs\/heads\/)?(main|master)$/.test(r))) return true;
    if (!refs.length) {
      const branch = spawnSync("git", ["branch", "--show-current"], { cwd: input.cwd, encoding: "utf8" }).stdout?.trim();
      if (branch === "main" || branch === "master") return true;
    }
  }
  return false;
}

function needs(skill, why) {
  let transcript = "";
  // A subagent's own Skill calls are in its file beside the session's, not in transcript_path.
  const own = input.agent_id && input.transcript_path
    ? `${String(input.transcript_path).replace(/\.jsonl$/, "")}/subagents/agent-${input.agent_id}.jsonl`
    : "";
  for (const path of [input.transcript_path, input.agent_transcript_path, own].filter(Boolean)) {
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
  // Read with the quotes taken off: a quoted number, repo or refspec still counts.
  const plain = command.replace(/["']/g, "");
  for (const m of merges(plain)) green(m.selector, m.repo, m.auto);
  const api = plain.match(/repos\/([\w.-]+\/[\w.-]+)\/pulls\/(\d+)\/merge\b/);
  if (api && mergeApi.test(plain)) green([api[2]], api[1]);
  if (/\bgh(\.exe)?\s+api\s+graphql\b/.test(plain) && /mergePullRequest/.test(plain))
    refuse("Merge with `gh pr merge <number>`, which this hook checks, not a GraphQL mutation.");
  if (pushesToMain(plain)) {
    // Only the head of a pull request whose checks passed (the route when gh may not merge a workflow change).
    const head = spawnSync("git", ["rev-parse", "HEAD"], { cwd: input.cwd, encoding: "utf8" }).stdout?.trim();
    const pr = head ? gh(["pr", "list", "--state", "open", "--search", head, "--json", "number", "--jq", ".[0].number"]) : null;
    const number = pr?.status === 0 ? pr.out.trim() : "";
    if (!/^\d+$/.test(number))
      refuse("Push to main only the head of an open pull request whose checks have passed; open one, or use `gh pr merge`.");
    green([number], undefined);
  }
  if (measuring.test(bare)) needs("deciding", "measuring or comparing options");
} else if (installed)
  refuse(
    "This file is an installed copy and the next install overwrites it. Change it in its repo (skills, rules and hooks: the agents repo, https://github.com/ColinCee/agents), merge, then run `npm run install-home -- --apply` there.",
  );
else if (isDoc) needs("doc-upkeep", "writing or changing a document or code (comments follow its rules)");
process.exit(0);
