// Install home/AGENTS.md as the user-level instructions of the coding agents on this machine, and the session review
// that runs when a Claude Code session is archived.
import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";

const HELP = `Install home/AGENTS.md as every agent's user-level instructions, and the review of each archived
Claude Code session. Reports only unless --apply.

  npm run install-home             # what would change
  npm run install-home -- --apply  # write it

home/AGENTS.md is the author's own instructions. Read it before installing it as yours.

With --apply, copies it to ~/.claude/AGENTS.md and ~/.codex/AGENTS.md (Codex), and writes ~/.claude/CLAUDE.md as
one line, @AGENTS.md: Claude Code reads only CLAUDE.md at user level, and the import pulls AGENTS.md in. Any file
it replaces is first kept as <name>.<date-time>.bak beside it. Copies, not links: Windows without Developer Mode
cannot make links.

It also copies the session review (built from src/home/review-on-archive.mts) to
~/.claude/session-reviews/review-on-archive.mjs and adds it as a SessionEnd hook in ~/.claude/settings.json,
keeping every other setting and hook. Reports land in ~/.claude/session-reviews/.

Exit codes: 0 everything matches or was installed, 1 something differs (report only), 2 home/AGENTS.md is missing.`;

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SOURCE = join(ROOT, "home", "AGENTS.md");
const REVIEW = join(ROOT, "dist", "home", "review-on-archive.mjs");
const REVIEW_NAME = "review-on-archive.mjs";
// Claude Code reads ~/.claude/CLAUDE.md, never ~/.claude/AGENTS.md; a relative import resolves beside the file.
const IMPORT = Buffer.from("@AGENTS.md\n");

function keep(path: string): string {
  const stamp = new Date().toISOString().replace(/[-:]/g, "").replace("T", "-").slice(0, 15);
  const backup = `${path}.${stamp}.bak`;
  copyFileSync(path, backup);
  return backup;
}

type Hook = { type: string; command: string; args?: string[]; timeout?: number };
type Settings = { hooks?: Record<string, { matcher?: string; hooks: Hook[] }[]> } & Record<string, unknown>;

/** settings.json with the review's SessionEnd hook in it; every other key and hook kept as it was. */
function withHook(text: string | undefined, script: string): Buffer {
  const settings: Settings = text ? JSON.parse(text) : {};
  const ours = (h: Hook): boolean => [h.command, ...(h.args ?? [])].some((p) => p.includes(REVIEW_NAME));
  const end = (settings.hooks?.SessionEnd ?? [])
    .map((group) => ({ ...group, hooks: group.hooks.filter((h) => !ours(h)) }))
    .filter((group) => group.hooks.length);
  // Ten seconds: the hook only queues the session and starts the review in the background.
  end.push({ hooks: [{ type: "command", command: "node", args: [script], timeout: 10 }] });
  settings.hooks = { ...settings.hooks, SessionEnd: end };
  return Buffer.from(`${JSON.stringify(settings, null, 2)}\n`);
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
  if (!existsSync(REVIEW)) {
    console.error(`Error: ${REVIEW} is missing; npm run install-home builds it.`);
    return 2;
  }
  const text = readFileSync(SOURCE);
  const script = join(homedir(), ".claude", "session-reviews", REVIEW_NAME);
  const settingsPath = join(homedir(), ".claude", "settings.json");
  let settings: Buffer;
  try {
    settings = withHook(existsSync(settingsPath) ? readFileSync(settingsPath, "utf8") : undefined, script);
  } catch (e) {
    console.error(`Error: ${settingsPath} is not JSON (${(e as Error).message}); fix it, then run this again.`);
    return 2;
  }
  const targets: [string, Buffer][] = [
    [join(homedir(), ".claude", "AGENTS.md"), text],
    [join(homedir(), ".claude", "CLAUDE.md"), IMPORT],
    [join(homedir(), ".codex", "AGENTS.md"), text],
    [script, readFileSync(REVIEW)],
    [settingsPath, settings],
  ];
  // The review runs the installed skill's scripts; an older install has no edits.mjs.
  const skill = join(homedir(), ".claude", "skills", "session-review", "scripts", "edits.mjs");
  if (!existsSync(skill))
    console.log(`note: ${skill} is missing; reinstall the session-review skill (README.md) or reviews fail`);
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
