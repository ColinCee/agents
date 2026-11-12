import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { expect, test } from "vitest";
import { compare, comparePaired, seeded, type Unit, verdict } from "../tools/rule-stats.js";
import { dueLooks, LOOK_P, LOOKS, type Row } from "../tools/rule-tests.js";

// Sessions as they really come: a few chances each, most often 1 to 10, and misses that clump within a session.
function session(rng: () => number, missRate: number): Unit {
  const chances = 1 + Math.floor(rng() ** 2 * 30);
  const prone = rng() < missRate * 1.5 ? 0.66 : 0; // some sessions miss often, the rest never
  let misses = 0;
  for (let i = 0; i < chances; i++) misses += Number(rng() < prone);
  return { chances, misses };
}
const sessions = (rng: () => number, n: number, missRate: number) =>
  Array.from({ length: n }, () => session(rng, missRate));

/** A trial run to its last look: whether any look said "works". */
function passes(rng: () => number, rateOff: number, rateOn: number): boolean {
  const off = sessions(rng, 40, rateOff);
  const on = sessions(rng, 40, rateOn);
  return LOOKS.some((n) => verdict(compare(off.slice(0, n), on.slice(0, n), rng, 400), LOOK_P) === "works");
}

test("a rule that halves misses is rarely called useless at the last look", () => {
  const rng = seeded(11);
  let useless = 0;
  for (let i = 0; i < 200; i++)
    useless += Number(
      verdict(compare(sessions(rng, 40, 0.5), sessions(rng, 40, 0.25), rng, 400), LOOK_P) === "no useful effect",
    );
  expect(useless / 200).toBeLessThan(0.07);
});

test("three looks pass a rule that does nothing in about 1 trial in 20 at most", () => {
  const rng = seeded(7);
  const trials = 300;
  let passed = 0;
  for (let i = 0; i < trials; i++) passed += Number(passes(rng, 0.4, 0.4));
  expect(passed / trials).toBeLessThan(0.07);
});

test("a rule that removes most misses passes, and one that adds misses never reads as working", () => {
  const rng = seeded(8);
  let passed = 0;
  for (let i = 0; i < 40; i++) passed += Number(passes(rng, 0.5, 0.1));
  expect(passed).toBeGreaterThan(32);
  const worse = compare(sessions(rng, 40, 0.1), sessions(rng, 40, 0.5), rng);
  expect(verdict(worse, LOOK_P)).toBe("no useful effect");
});

test("a replay of the same moments under both rules sees a drop that the unpaired comparison would miss", () => {
  const rng = seeded(9);
  const pairs = sessions(rng, 30, 0.5).map((old) => ({
    old,
    new: { chances: old.chances, misses: Math.floor(old.misses / 2) },
  }));
  const paired = comparePaired(pairs, rng);
  expect(paired.drop).toBeGreaterThan(0.4);
  expect(paired.p).toBeLessThan(0.05);
  expect(paired.low).toBeGreaterThan(0);
});

const row = (root: string, day: string, stamp: string, misses: number): Row => ({
  root,
  day,
  model: "m",
  stamp,
  measure: "x",
  chances: 4,
  misses,
});

test("a look is due when the smaller group reaches its size, is never retaken, and the last comes after a week", () => {
  const trial = { id: "t", status: "testing" as const, measures: ["x"], started: "2026-01-01" };
  const rows = Array.from({ length: 24 }, (_, i) =>
    row(`s${i}`, "2026-01-02", `t=${i % 2 ? "on" : "off"} holdout=no`, i % 2 ? 0 : 3),
  );
  rows.push(row("before", "2025-12-31", "t=off", 4), row("ungrouped", "2026-01-02", "", 4));
  const [look] = dueLooks(trial, rows, [], "2026-01-03", seeded(1));
  expect(look).toMatchObject({ look: 1, sessionsOff: 12, sessionsOn: 12, verdict: "works" });
  // No difference: an early look gives no verdict, and a session whose stamps disagree on its group is left out.
  const same = rows.map((r) => ({ ...r, misses: 2 }));
  same.push(row("mixed", "2026-01-02", "t=on rules=a | t=off rules=b", 4));
  expect(dueLooks(trial, same, [], "2026-01-03", seeded(1))[0]).toMatchObject({
    verdict: "no verdict yet",
    sessionsOn: 12,
  });
  expect(dueLooks(trial, same, [1], "2026-01-08", seeded(1))[0]?.verdict).toBe("no useful effect");
  // A week with two sessions a group proves nothing either way.
  expect(dueLooks(trial, same.slice(0, 4), [], "2026-01-08", seeded(1))[0]).toMatchObject({
    look: 3,
    verdict: "can't tell",
  });
  expect(dueLooks(trial, rows, [1], "2026-01-03", seeded(1))).toEqual([]);
  expect(dueLooks(trial, rows, [1], "2026-01-08", seeded(1))[0]?.look).toBe(3);
});

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
