// Install home/AGENTS.md as the user-level instructions of the coding agents on this machine, with its hook and skills.
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";

const HELP = `Install home/AGENTS.md as every agent's user-level instructions. Reports only unless --apply.

  npm run install-home             # what would change
  npm run install-home -- --apply  # write it

home/AGENTS.md is the author's own instructions. Read it before installing it as yours.

With --apply, copies it to ~/.claude/AGENTS.md and ~/.codex/AGENTS.md (Codex), every skill in skills/ to
~/.claude/skills/, home/hooks/require-skill.mjs to
~/.claude/hooks/ (listed under PreToolUse for Bash|PowerShell|Edit|Write|MultiEdit in ~/.claude/settings.json, which this does not edit), and writes ~/.claude/CLAUDE.md as
one line, @AGENTS.md: Claude Code reads only CLAUDE.md at user level, and the import pulls AGENTS.md in. Any file
it replaces is first kept as <name>.<date-time>.bak beside it. Copies, not links: Windows without Developer Mode
cannot make links.

Exit codes: 0 everything matches or was installed, 1 something differs (report only), 2 home/AGENTS.md is missing.`;

const SOURCE = resolve(dirname(fileURLToPath(import.meta.url)), "..", "home", "AGENTS.md");
// The hook that refuses `gh pr create` and `gh pr merge` until shipping-prs is loaded; settings.json points at it.
const HOOK = resolve(dirname(SOURCE), "hooks", "require-skill.mjs");
// Claude Code reads ~/.claude/CLAUDE.md, never ~/.claude/AGENTS.md; a relative import resolves beside the file.
const IMPORT = Buffer.from("@AGENTS.md\n");
// Every skill in this repo (skills/<name>, skills/.experimental/<name>), installed as ~/.claude/skills/<name>. The
// installed copies are only ever copies: a fix made in one was lost when the skill was next installed (5 Nov 2026).
const SKILLS = resolve(dirname(SOURCE), "..", "skills");

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

function keep(path: string): string {
  const stamp = new Date().toISOString().replace(/[-:]/g, "").replace("T", "-").slice(0, 15);
  const backup = `${path}.${stamp}.bak`;
  copyFileSync(path, backup);
  return backup;
}

function main(): number {
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
  if (!existsSync(SOURCE)) {
    console.error(`Error: ${SOURCE} is missing.`);
    return 2;
  }
  const text = readFileSync(SOURCE);
  const targets: [string, Buffer][] = [
    [join(homedir(), ".claude", "AGENTS.md"), text],
    [join(homedir(), ".claude", "CLAUDE.md"), IMPORT],
    [join(homedir(), ".codex", "AGENTS.md"), text],
    [join(homedir(), ".claude", "hooks", "require-skill.mjs"), readFileSync(HOOK)],
    ...skillTargets(),
  ];
  const stale = targets.filter(([path, want]) => !existsSync(path) || !readFileSync(path).equals(want));

  if (!apply) {
    for (const [path] of targets)
      console.log(`${stale.some(([p]) => p === path) ? "would replace" : "matches"}: ${path}`);
    if (stale.length) {
      console.log("Run with --apply to install.");
      return 1;
    }
    return 0;
  }
  for (const [path, want] of stale) {
    mkdirSync(dirname(path), { recursive: true });
    if (existsSync(path)) console.log(`kept ${keep(path)}`);
    // A link (even a dangling one) would be written through, overwriting what it points to.
    rmSync(path, { force: true });
    writeFileSync(path, want);
    console.log(`installed ${path}`);
  }
  if (!stale.length) console.log("Everything already matches.");
  return 0;
}

process.exitCode = main();
