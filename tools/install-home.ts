// Install home/core.md and home/desktop.md as the user-level instructions of the coding agents on this machine, with
// the hook and skills.
import {
  copyFileSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { homedir } from "node:os";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";

const HELP = `Install home/core.md and home/desktop.md as every agent's user-level instructions. Reports only unless --apply.

  npm run install-home             # what would change
  npm run install-home -- --apply  # write it

They are the author's own instructions. Read them before installing them as yours.

With --apply, joins them into ~/.claude/AGENTS.md and ~/.codex/AGENTS.md (Codex), copies every skill in skills/ to
~/.claude/skills/ (and downloads the skills kept in other repos, such as homelab-network, except where CI=true;
one that does not load is named and the run exits 1), home/hooks/require-skill.mjs to
~/.claude/hooks/ with its PreToolUse entry in ~/.claude/settings.json, where it also turns Claude Code's auto memory off
(only those two; the rest of the file is kept), and writes ~/.claude/CLAUDE.md as
one line, @AGENTS.md: Claude Code reads only CLAUDE.md at user level, and the import pulls AGENTS.md in. Any file
it replaces is first kept as <name>.<date-time>.bak beside it. Copies, not links: Windows without Developer Mode
cannot make links.

Exit codes: 0 everything matches or was installed, 1 something differs (report only), 2 home/core.md or home/desktop.md is missing.`;

const HOME = resolve(dirname(fileURLToPath(import.meta.url)), "..", "home");
// core.md is what unattended agents also read (they take it alone); desktop.md is for sessions with the author present.
const SOURCES = [join(HOME, "core.md"), join(HOME, "desktop.md")];
// The hook that refuses `gh pr create` and `gh pr merge` until shipping-prs is loaded; settings.json points at it.
const HOOK = join(HOME, "hooks", "require-skill.mjs");
// Claude Code reads ~/.claude/CLAUDE.md, never ~/.claude/AGENTS.md; a relative import resolves beside the file.
const IMPORT = Buffer.from("@AGENTS.md\n");
// Every skill in this repo (skills/<name>, skills/.experimental/<name>), installed as ~/.claude/skills/<name>. The
// installed copies are only ever copies: a fix made in one was lost when the skill was next installed (5 Nov 2026).
const SKILLS = resolve(HOME, "..", "skills");
// Skills that live in the author's other public repos, beside what they describe, so a new machine gets them from
// this one command. Not in CI: Kaizen's runners install these rules too, and these skills are not their work.
const OTHER_SKILLS: Record<string, string> = {
  "homelab-network": "https://raw.githubusercontent.com/ColinCee/homelab/main/.github/skills/homelab-network/SKILL.md",
};

// A skill that did not load is left as it is and named, and the run exits 1, so a failed fetch never reads as success.
async function otherSkillTargets(): Promise<{ targets: [string, Buffer][]; failed: string[] }> {
  const targets: [string, Buffer][] = [];
  const failed: string[] = [];
  if (process.env.CI === "true") return { targets, failed };
  for (const [name, url] of Object.entries(OTHER_SKILLS)) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(15_000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const body = Buffer.from(await res.arrayBuffer());
      // A captive portal or error page answers 200 too.
      if (!body.toString("utf8").startsWith(`---\nname: ${name}\n`)) throw new Error("not a SKILL.md for it");
      targets.push([join(homedir(), ".claude", "skills", name, "SKILL.md"), body]);
    } catch (e) {
      failed.push(`${name}: ${url} did not load (${(e as Error).message})`);
    }
  }
  return { targets, failed };
}

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? files(path).map((f) => join(name, f)) : [name];
  });
}

function skillTargets(): [string, Buffer][] {
  return [SKILLS, join(SKILLS, ".experimental")]
    .filter((root) => existsSync(root))
    .flatMap((root) =>
      readdirSync(root)
        .filter((name) => !name.startsWith(".") && existsSync(join(root, name, "SKILL.md")))
        .flatMap((name) =>
          files(join(root, name)).map((f): [string, Buffer] => [
            join(homedir(), ".claude", "skills", name, f),
            readFileSync(join(root, name, f)),
          ]),
        ),
    );
}

// The hook's PreToolUse entry in ~/.claude/settings.json, so every machine runs the same checks. Only the entry whose
// command runs require-skill.mjs is replaced or added; every other setting and hook stays as it was, but one: the
// auto memory is turned off, since it stays on one machine and what an agent learns belongs in git (doc-upkeep, Homes).
function settingsTarget(): [string, Buffer] {
  const path = join(homedir(), ".claude", "settings.json");
  const settings = existsSync(path) ? JSON.parse(readFileSync(path, "utf8")) : {};
  const command = `node "${join(homedir(), ".claude", "hooks", "require-skill.mjs").replaceAll("\\", "/")}"`;
  const entry = { matcher: "Bash|PowerShell|Edit|Write|MultiEdit", hooks: [{ type: "command", command }] };
  const ours = (e: { hooks?: { command?: string }[] }) =>
    e.hooks?.some((h) => h.command?.includes("require-skill.mjs"));
  const pre: object[] = settings.hooks?.PreToolUse ?? [];
  const at = pre.findIndex(ours);
  settings.hooks = { ...settings.hooks, PreToolUse: at < 0 ? [...pre, entry] : pre.with(at, entry) };
  settings.autoMemoryEnabled = false;
  const want = Buffer.from(`${JSON.stringify(settings, null, 2)}\n`);
  // Same settings in other formatting count as matching, so a hand-formatted file is left alone.
  const same = existsSync(path) && JSON.stringify(JSON.parse(readFileSync(path, "utf8"))) === JSON.stringify(settings);
  return [path, same ? readFileSync(path) : want];
}

function keep(path: string): string {
  const stamp = new Date().toISOString().replace(/[-:]/g, "").replace("T", "-").slice(0, 15);
  // A backup inside a live skill folder would ship with the skill, so skills keep theirs in one folder beside them.
  const skills = join(homedir(), ".claude", "skills");
  const backup = path.startsWith(skills)
    ? join(homedir(), ".claude", "skills-replaced", `${relative(skills, path)}.${stamp}.bak`)
    : `${path}.${stamp}.bak`;
  mkdirSync(dirname(backup), { recursive: true });
  copyFileSync(path, backup);
  return backup;
}

async function main(): Promise<number> {
  let apply: boolean;
  try {
    const { values } = parseArgs({
      options: { apply: { type: "boolean", default: false }, help: { type: "boolean", short: "h", default: false } },
    });
    if (values.help) {
      console.log(HELP);
      return 0;
    }
    apply = Boolean(values.apply);
  } catch (e) {
    console.error(`${(e as Error).message}\n\n${HELP}`);
    return 2;
  }
  const missing = SOURCES.find((p) => !existsSync(p));
  if (missing) {
    console.error(`Error: ${missing} is missing.`);
    return 2;
  }
  const text = Buffer.concat(SOURCES.map((p) => readFileSync(p)));
  const targets: [string, Buffer][] = [
    [join(homedir(), ".claude", "AGENTS.md"), text],
    [join(homedir(), ".claude", "CLAUDE.md"), IMPORT],
    [join(homedir(), ".codex", "AGENTS.md"), text],
    [join(homedir(), ".claude", "hooks", "require-skill.mjs"), readFileSync(HOOK)],
    ...skillTargets(),
  ];
  const other = await otherSkillTargets();
  targets.push(...other.targets);
  for (const f of other.failed) console.error(`skipped ${f}`);
  try {
    targets.push(settingsTarget());
  } catch (e) {
    console.error(`Error: ~/.claude/settings.json is not valid JSON, so it was left alone: ${(e as Error).message}`);
    return 2;
  }
  const skills = join(homedir(), ".claude", "skills");
  // A skill folder that is a link (another installer's, such as npx skills) would be written through into its store,
  // so it becomes a real folder and every file of that skill is written.
  const linked = (path: string): string | undefined => {
    if (!path.startsWith(skills)) return undefined;
    const folder = join(skills, relative(skills, path).split(/[\\/]/)[0] ?? "");
    try {
      return lstatSync(folder).isSymbolicLink() ? folder : undefined;
    } catch {
      return undefined;
    }
  };
  const stale = targets.filter(([path, want]) => linked(path) || !existsSync(path) || !readFileSync(path).equals(want));

  if (!apply) {
    for (const [path] of targets)
      console.log(`${stale.some(([p]) => p === path) ? "would replace" : "matches"}: ${path}`);
    if (stale.length) console.log("Run with --apply to install.");
    return stale.length || other.failed.length ? 1 : 0;
  }
  for (const [path, want] of stale) {
    const folder = linked(path);
    if (folder) {
      rmSync(folder);
      console.log(`replaced the link ${folder} with a copy`);
    }
    mkdirSync(dirname(path), { recursive: true });
    if (existsSync(path)) console.log(`kept ${keep(path)}`);
    // A link (even a dangling one) would be written through, overwriting what it points to.
    rmSync(path, { force: true });
    writeFileSync(path, want);
    console.log(`installed ${path}`);
  }
  if (!stale.length && !other.failed.length) console.log("Everything already matches.");
  return other.failed.length ? 1 : 0;
}

process.exitCode = await main();
