import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { expect, test } from "vitest";

// The hook is what assigns groups, so it is run as Claude Code runs it.
function hook(home: string, input: object): string {
  const run = spawnSync("node", [resolve(import.meta.dirname, "..", "home", "hooks", "rule-groups.mjs")], {
    input: JSON.stringify({ hook_event_name: "SessionStart", ...input }),
    encoding: "utf8",
    env: { ...process.env, HOME: home, USERPROFILE: home },
  });
  return JSON.parse(run.stdout).hookSpecificOutput.additionalContext as string;
}

test("the hook gives a task the same groups in every session, splits tasks in half per trial, and holds some out of settled rules", () => {
  const home = mkdtempSync(join(tmpdir(), "rule-groups-"));
  mkdirSync(join(home, ".claude", "trials"), { recursive: true });
  const trial = (status: string, on: string) =>
    `---\nstatus: ${status}\nmeasures: x\nstarted: 2026-01-01\n---\n\n## Off\n\n## On\n${on}\n`;
  writeFileSync(join(home, ".claude", "trials", "a.md"), trial("testing", "Rule A."));
  writeFileSync(join(home, ".claude", "trials", "b.md"), trial("testing", "Rule B."));
  writeFileSync(join(home, ".claude", "trials", "kept.md"), trial("settled", "Rule kept."));

  const first = hook(home, { session_id: "one", cwd: "/repo/.claude/worktrees/calm-task" });
  expect(hook(home, { session_id: "two", cwd: "/repo/.claude/worktrees/calm-task/src" })).toBe(first);
  expect(first.includes("Rule kept.")).toBe(first.includes("kept=on"));

  const stamps = Array.from(
    { length: 400 },
    (_, i) => hook(home, { session_id: `s${i}`, cwd: "/repo" }).split("\n")[0] ?? "",
  );
  const share = (text: string) => stamps.filter((s) => s.includes(text)).length / stamps.length;
  expect(share("a=on")).toBeGreaterThan(0.4);
  expect(share("a=on")).toBeLessThan(0.6);
  // Independent splits: b is on in about half of a's sessions, not all or none.
  expect(share("a=on b=on") / share("a=on")).toBeGreaterThan(0.35);
  expect(share("a=on b=on") / share("a=on")).toBeLessThan(0.65);
  expect(share("holdout=yes")).toBeGreaterThan(0.05);
  expect(share("holdout=yes")).toBeLessThan(0.16);
  expect(stamps.every((s) => s.includes("holdout=yes") === s.includes("kept=off"))).toBe(true);
}, 120_000);

test("with no trials installed, as on Kaizen's runner, the hook holds no task out", () => {
  const home = mkdtempSync(join(tmpdir(), "rule-groups-"));
  const stamps = Array.from({ length: 100 }, (_, i) => hook(home, { session_id: `s${i}`, cwd: "/repo" }));
  expect(stamps.every((s) => s.includes("holdout=no"))).toBe(true);
}, 60_000);
