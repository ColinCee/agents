import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { expect, test } from "vitest";

// The hook is what gives sessions their trial rules, so it is run as Claude Code runs it.
function hook(home: string, input: object): string {
  const run = spawnSync("node", [resolve(import.meta.dirname, "..", "home", "hooks", "rule-groups.mjs")], {
    input: JSON.stringify({ hook_event_name: "SessionStart", ...input }),
    encoding: "utf8",
    env: { ...process.env, HOME: home, USERPROFILE: home },
  });
  return JSON.parse(run.stdout).hookSpecificOutput.additionalContext as string;
}

test("every session gets every trial's On wording, and a task keeps one stamp across its sessions", () => {
  const home = mkdtempSync(join(tmpdir(), "rule-groups-"));
  mkdirSync(join(home, ".claude", "trials"), { recursive: true });
  const trial = (status: string, on: string) =>
    `---\nstatus: ${status}\nmeasures: x\nstarted: 2026-01-01\n---\n\n## Off\nOld wording.\n\n## On\n${on}\n`;
  writeFileSync(join(home, ".claude", "trials", "a.md"), trial("testing", "Rule A."));
  writeFileSync(join(home, ".claude", "trials", "kept.md"), trial("settled", "Rule kept."));

  const first = hook(home, { session_id: "one", cwd: "/repo/.claude/worktrees/calm-task" });
  expect(hook(home, { session_id: "two", cwd: "/repo/.claude/worktrees/calm-task/src" })).toBe(first);
  expect(first.split("\n")[0]).toMatch(/^Rule trials: a=on kept=on task=[0-9a-f]{8} rules=[0-9a-f]{7}$/);
  for (const session of ["s1", "s2", "s3"]) {
    const context = hook(home, { session_id: session, cwd: "/repo" });
    expect(context).toContain("- Rule A.\n- Rule kept.");
    expect(context).not.toContain("Old wording.");
  }
});
