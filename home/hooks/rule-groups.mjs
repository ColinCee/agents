// A Claude Code SessionStart and SubagentStart hook: gives every session the rules kept as trials in ~/.claude/trials
// (docs/keep-going.md), each trial's On wording. The first line it prints is the session's record of the trials and
// its task: agent-experiments reads it back from the transcript and judges each rule change by before and after.
import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

try {
  const input = JSON.parse(readFileSync(0, "utf8"));
  const claude = join(homedir(), ".claude");
  // A task stays one unit across restarts: the desktop app gives each task a worktree, whose name outlives the
  // session id.
  const task =
    /[\\/]\.claude[\\/]worktrees[\\/]([^\\/]+)/.exec(String(input.cwd ?? ""))?.[1] ?? String(input.session_id ?? "");
  const read = (path) => {
    try {
      return readFileSync(path, "utf8");
    } catch {
      return "";
    }
  };
  let names = [];
  try {
    names = readdirSync(join(claude, "trials")).filter((f) => f.endsWith(".md")).sort();
  } catch {}
  const version = createHash("sha256").update(read(join(claude, "AGENTS.md")));
  const trials = [];
  const rules = [];
  for (const name of names) {
    const text = read(join(claude, "trials", name)).replaceAll("\r\n", "\n");
    version.update(text);
    const rule = /^## On\n([\s\S]*?)(?=^## |(?![\s\S]))/m.exec(text)?.[1]?.trim();
    trials.push(`${name.slice(0, -3)}=on`);
    if (rule) rules.push(rule);
  }
  const stamp = `Rule trials: ${[...trials, `task=${createHash("sha256").update(task).digest("hex").slice(0, 8)}`, `rules=${version.digest("hex").slice(0, 7)}`].join(" ")}`;
  const additionalContext = rules.length
    ? `${stamp}\nMore of the user's rules, with the same standing as their AGENTS.md:\n${rules.map((r) => `- ${r}`).join("\n")}`
    : stamp;
  console.log(JSON.stringify({ hookSpecificOutput: { hookEventName: input.hook_event_name, additionalContext } }));
} catch {
  // A session with no stamp is left out of every count; failing here must never stop a session from starting.
}
