// A Claude Code SessionStart and SubagentStart hook: gives the session the rules kept as trials in ~/.claude/trials
// (docs/keep-going.md), each on for a random half of tasks, so a rule's effect is measured against sessions of the
// same days without it. The first line it prints is the session's record of its groups: tools/sessions.sql reads it
// back from the transcript.
import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const HOLDOUT = 0.1; // share of tasks that never get a settled rule: the standing comparison group

try {
  const input = JSON.parse(readFileSync(0, "utf8"));
  const claude = join(homedir(), ".claude");
  // A task keeps its groups across restarts: the desktop app gives each task a worktree, whose name outlives the
  // session id.
  const task =
    /[\\/]\.claude[\\/]worktrees[\\/]([^\\/]+)/.exec(String(input.cwd ?? ""))?.[1] ?? String(input.session_id ?? "");
  const share = (key) => createHash("sha256").update(`${key}:${task}`).digest().readUInt32BE(0) / 2 ** 32;
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
  const holdout = share("holdout") < HOLDOUT;
  const version = createHash("sha256").update(read(join(claude, "AGENTS.md")));
  const groups = [];
  const rules = [];
  for (const name of names) {
    const text = read(join(claude, "trials", name)).replaceAll("\r\n", "\n");
    version.update(text);
    const settled = /^status:\s*settled\s*$/m.test(text);
    // Each trial hashes on its own name, so two trials split the same tasks independently.
    const on = settled ? !holdout : share(name) < 0.5;
    const section = (title) => new RegExp(`^## ${title}\\n([\\s\\S]*?)(?=^## |(?![\\s\\S]))`, "m").exec(text)?.[1]?.trim();
    const rule = section(on ? "On" : "Off");
    groups.push(`${name.slice(0, -3)}=${on ? "on" : "off"}`);
    if (rule) rules.push(rule);
  }
  const stamp = `Rule trials: ${[...groups, `holdout=${holdout ? "yes" : "no"}`, `task=${createHash("sha256").update(task).digest("hex").slice(0, 8)}`, `rules=${version.digest("hex").slice(0, 7)}`].join(" ")}`;
  const additionalContext = rules.length
    ? `${stamp}\nMore of the user's rules, with the same standing as their AGENTS.md:\n${rules.map((r) => `- ${r}`).join("\n")}`
    : stamp;
  console.log(JSON.stringify({ hookSpecificOutput: { hookEventName: input.hook_event_name, additionalContext } }));
} catch {
  // A session with no stamp is left out of every trial; failing here must never stop a session from starting.
}
