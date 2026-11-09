// A Claude Code PreToolUse hook (Bash, PowerShell, Edit, Write, MultiEdit): refuse a step until the session has loaded
// the skill for it, and refuse a commit that names no paths. Rules that only point at a skill loaded it about 1 time
// in 3; this refusal loaded shipping-prs every time. It also refuses a merge, or a push to main, whose checks have not
// passed: GitHub's free plan cannot require checks on a private repository, so this is the required check.
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { resolve } from "node:path";

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

// The command as gh and git read it. Quoted text after `bash -c`, `pwsh -Command` or `cmd /c` is code, so it is read
// as the command; other quoted text holding a separator is data (a message, a search pattern); a quoted word (a
// number, a repo, a path) still counts, its spaces kept as SP so it stays one word and no pattern matches it. An
// escaped quote (\") opens nothing.
const SP = "\u0001";
const runner = /\b(?:(?:ba|z)?sh|pwsh|powershell)(?:\.exe)?(?:\s+-\w+)*\s+-(?:\w*c|Command)\s*$|\bcmd(?:\.exe)?\s+\/[ck]\s*$/i;
const plain = command
  .replace(/\\"/g, "\u0002")
  .replace(/"([^"]*)"|'([^']*)'/g, (_m, d, s, at, all) => {
    const text = d ?? s;
    if (runner.test(all.slice(0, at))) return `; ${text}`;
    return /[;&|\n]/.test(text) ? '""' : text.replaceAll(" ", SP);
  });

// The folder a command at `index` runs in: the session's, moved by each cd, Set-Location or pushd before it.
// Git Bash spells D:\x as /d/x.
function folderAt(index, also) {
  let dir = input.cwd;
  const moves = /(?:^|[;&|(\n]\s*)(?:cd|chdir|pushd|Set-Location|sl|Push-Location)(?:\s+-(?:Literal)?Path|\s+--)?\s+([^\s;&|)]+)/gi;
  const to = [...plain.slice(0, index).matchAll(moves)].map((m) => m[1]);
  for (let path of [...to, also].filter((p) => p && p !== "-")) {
    path = path.replaceAll(SP, " ").replace(/^~(?=\/|\\|$)/, homedir());
    if (process.platform === "win32") path = path.replace(/^\/([a-zA-Z])(?=\/|$)/, "$1:");
    dir = resolve(dir ?? ".", path);
  }
  return dir;
}

// gh, run in the folder the command runs it in; a test names a stand-in script. Under the app's own hook time limit.
function gh(args, cwd) {
  const [file, pre] = process.env.REQUIRE_SKILL_GH ? [process.execPath, [process.env.REQUIRE_SKILL_GH]] : ["gh", []];
  const done = spawnSync(file, [...pre, ...args], { cwd, encoding: "utf8", timeout: 20_000 });
  return { status: done.status, out: `${done.stdout ?? ""}${done.stderr ?? ""}` };
}

// The pull request's checks must all have passed (or, with --auto, none failed: GitHub merges once they pass); a
// repository with no checks at all has nothing to wait for. When gh cannot say, nothing merges.
function green(selector, repo, auto, cwd) {
  const checks = gh(["pr", "checks", ...selector, ...(repo ? ["--repo", repo] : [])], cwd);
  if (checks.status === 0 || /no checks reported/i.test(checks.out)) return;
  const rows = checks.out.split("\n").filter((l) => /\t(fail|pending|cancel|skipping)/i.test(l));
  if (checks.status === null || (!rows.length && checks.status !== 8))
    refuse(`gh could not tell whether the checks passed (${checks.out.trim().slice(0, 200) || "no answer"}), asked in ${cwd}; fix gh, or pass --repo <owner>/<repo>.`);
  const failed = rows.filter((l) => /\t(fail|cancel)/i.test(l));
  if (auto && !failed.length) return;
  const named = (failed.length ? failed : rows).map((l) => l.split("\t").slice(0, 2).join(": ")).slice(0, 5);
  refuse(`Merge only once the checks pass (\`gh pr checks <number> --watch\` exits 0): ${named.join(", ")}. Fix a failure first.`);
}

// Each `gh pr merge` in the command, with what it names (number, URL or branch; none means the current branch's) and
// its --repo and folder. Read from `plain`, so `-R "o/r"` and `"664"` count; --help merges nothing.
const VALUED = new Set(["-R", "--repo", "-t", "--subject", "-b", "--body", "-F", "--body-file", "-A", "--author-email", "--match-head-commit"]);
function merges(text) {
  const found = [];
  for (const m of text.matchAll(/(?:^|[;&|(\n]\s*)((?:\w+=\S*\s+)*)gh(?:\.exe)?\s+pr\s+merge\b([^;&|\n)]*)/g)) {
    const words = m[2].trim().split(/\s+/).filter(Boolean);
    if (words.includes("--help") || words.includes("-h")) continue;
    let selector = [], repo = m[1].match(/\bGH_REPO=(\S+)/)?.[1], auto = false;
    for (let i = 0; i < words.length; i++) {
      const [flag, value] = words[i].split(/=(.*)/s);
      if (flag === "--auto") auto = true;
      if (VALUED.has(flag)) {
        const v = value ?? words[++i];
        if (flag === "-R" || flag === "--repo") repo = v;
      } else if (!flag.startsWith("-") && !selector.length) selector = [flag];
    }
    found.push({ selector, repo, auto, cwd: folderAt(m.index) });
  }
  return found;
}

// The folder of a push that lands on main or master (a refspec naming it, --all or --mirror, or a bare push while on
// it), or nothing.
function pushToMain(text) {
  const flags = /(?:\s+(?:-[cC]\s+\S+|--[\w-]+(?:=\S+)?))*/.source;
  for (const m of text.matchAll(new RegExp(`(?:^|[;&|(\\n]\\s*)(?:\\w+=\\S*\\s+)*git(?:\\.exe)?(${flags})\\s+push\\b([^;&|\\n]*)`, "g"))) {
    const cwd = folderAt(m.index, m[1].match(/-C\s+(\S+)/)?.[1]);
    const words = m[2].trim().split(/\s+/).filter(Boolean);
    if (words.some((w) => w === "--all" || w === "--mirror")) return cwd;
    const refs = words.filter((w) => !w.startsWith("-")).slice(1); // after the remote
    if (refs.some((r) => /^\+?([^:]*:)?(refs\/heads\/)?(main|master)$/.test(r))) return cwd;
    if (!refs.length) {
      const branch = spawnSync("git", ["branch", "--show-current"], { cwd, encoding: "utf8" }).stdout?.trim();
      if (branch === "main" || branch === "master") return cwd;
    }
  }
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
  for (const m of merges(plain)) green(m.selector, m.repo, m.auto, m.cwd);
  const api = mergeApi.exec(plain);
  const target = api && plain.slice(api.index).match(/repos\/([\w.-]+\/[\w.-]+)\/pulls\/(\d+)\/merge\b/);
  if (target) green([target[2]], target[1], false, folderAt(api.index));
  if (/\bgh(\.exe)?\s+api\s+graphql\b/.test(plain) && /mergePullRequest/.test(plain))
    refuse("Merge with `gh pr merge <number>`, which this hook checks, not a GraphQL mutation.");
  const pushed = pushToMain(plain);
  if (pushed) {
    // Only the head of a pull request whose checks passed (the route when gh may not merge a workflow change).
    const head = spawnSync("git", ["rev-parse", "HEAD"], { cwd: pushed, encoding: "utf8" }).stdout?.trim();
    const list = ["pr", "list", "--state", "open", "--search", head, "--json", "number", "--jq", ".[0].number"];
    const pr = head ? gh(list, pushed) : null;
    const number = pr?.status === 0 ? pr.out.trim() : "";
    if (!/^\d+$/.test(number))
      refuse("Push to main only the head of an open pull request whose checks have passed; open one, or use `gh pr merge`.");
    green([number], undefined, false, pushed);
  }
  if (measuring.test(bare)) needs("deciding", "measuring or comparing options");
} else if (installed)
  refuse(
    "This file is an installed copy and the next install overwrites it. Change it in its repo (skills, rules and hooks: the agents repo, https://github.com/ColinCee/agents), merge, then run `npm run install-home -- --apply` there.",
  );
else if (isDoc) needs("doc-upkeep", "writing or changing a document or code (comments follow its rules)");
process.exit(0);
