// Install home/AGENTS.md as the user-level instructions of the coding agents on this machine.
import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";

const HELP = `Install home/AGENTS.md as every agent's user-level instructions. Reports only unless --apply.

  npm run install-home             # what would change
  npm run install-home -- --apply  # write it

home/AGENTS.md is the author's own instructions. Read it before installing it as yours.

With --apply, copies it to ~/.claude/AGENTS.md (Claude Code) and ~/.codex/AGENTS.md (Codex), and moves aside a
~/.claude/CLAUDE.md, which Claude Code would read instead. Any file it replaces or moves is first kept as
<name>.<date-time>.bak beside it. Copies, not links: Windows without Developer Mode cannot make links.

Exit codes: 0 everything matches or was installed, 1 something differs (report only), 2 home/AGENTS.md is missing.`;

const SOURCE = resolve(dirname(fileURLToPath(import.meta.url)), "..", "home", "AGENTS.md");
const TARGETS = [join(homedir(), ".claude", "AGENTS.md"), join(homedir(), ".codex", "AGENTS.md")];
const SHADOW = join(homedir(), ".claude", "CLAUDE.md");

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
  const stale = TARGETS.filter((t) => !existsSync(t) || !readFileSync(t).equals(text));
  const shadowed = existsSync(SHADOW);

  if (!apply) {
    for (const target of TARGETS) console.log(`${stale.includes(target) ? "would replace" : "matches"}: ${target}`);
    if (shadowed) console.log(`would move aside, because Claude Code reads it instead: ${SHADOW}`);
    if (stale.length || shadowed) {
      console.log("Run with --apply to install.");
      return 1;
    }
    return 0;
  }
  for (const target of stale) {
    mkdirSync(dirname(target), { recursive: true });
    if (existsSync(target)) console.log(`kept ${keep(target)}`);
    writeFileSync(target, text);
    console.log(`installed ${target}`);
  }
  if (shadowed) {
    console.log(`kept ${keep(SHADOW)}`);
    rmSync(SHADOW);
    console.log(`moved aside ${SHADOW}`);
  }
  if (!stale.length && !shadowed) console.log("Everything already matches.");
  return 0;
}

process.exitCode = main();
