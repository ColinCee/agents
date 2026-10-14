import { join } from "node:path";
import { expect, test } from "vitest";
import { keyOf, summarise, type Trial, verdict } from "../tools/bench.js";

const FIXTURE = join(import.meta.dirname, "fixtures", "key");

// Keys made by the Python bench before the port, for the same folders and salts. Saved runs are found by key, so a
// port that changed them would quietly start every run again. The fixture holds the awkward cases: a CRLF file, the
// canary line, an evals/ folder, names that differ only in case, and a/b against a-c (sorted by part, not by string).
test("keys match the ones the Python bench made", () => {
  expect(keyOf([join(FIXTURE, "one")], "salt-a")).toBe("3c729a1614bf");
  expect(keyOf([join(FIXTURE, "two"), join(FIXTURE, "one")], "salt-b\ntyped by name\n")).toBe("4764bb1983e3");
});

function trials(n: number, passing: Record<string, number>, tokens = 100): Trial[] {
  return Array.from({ length: n }, (_, i) => {
    const checks = Object.fromEntries(Object.entries(passing).map(([name, k]) => [name, i < k]));
    return {
      trial: `t${i}`,
      served_models: ["m"],
      checks,
      passed: Object.values(checks).filter(Boolean).length,
      input_tokens: tokens,
      output_tokens: 1,
      agent_seconds: 1,
      setup_seconds: 1,
      grading_seconds: 1,
      skill_read: true,
      failed_to_run: false,
    };
  });
}

test("a gap of four in ten with nothing behind promotes", () => {
  const s = summarise(trials(10, { a: 6, b: 10 }), trials(10, { a: 10, b: 10 }, 120));
  expect(s.verdict).toMatch(/^promote: a ahead by 40% of runs/);
});

test("three in ten is undecided, and a check behind by two in ten blocks promotion", () => {
  expect(summarise(trials(10, { a: 7 }), trials(10, { a: 10 })).verdict).toMatch(/^undecided: best gap 30% \(a\)/);
  const s = summarise(trials(10, { a: 6, b: 10 }), trials(10, { a: 10, b: 8 }));
  expect(verdict(s)).toMatch(/b is behind by 20%/);
});

test("cost over three times blocks promotion; twenty runs with no gap of three deletes", () => {
  expect(summarise(trials(10, { a: 0 }), trials(10, { a: 10 }, 400)).verdict).toMatch(
    /tokens x4\.00, the rule allows x3/,
  );
  expect(summarise(trials(20, { a: 10 }), trials(20, { a: 14 })).verdict).toMatch(/^delete:/);
});
