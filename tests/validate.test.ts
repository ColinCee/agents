import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, expect, test } from "vitest";
import { check } from "../tools/validate.js";

let root: string;

const SKILL = `---
name: sample
description: Samples things. Use when asked to sample.
license: MIT
compatibility: Requires Node 22 or later.
---

Run \`node scripts/run.mjs\` to sample.
`;
const EVALS = JSON.stringify({
  evals: [1, 2, 3].map((i) => ({ prompt: `p${i}`, expected_output: `e${i}` })),
});
const SCRIPT = `#!/usr/bin/env node
// Samples things.
import { argv } from "node:process";
if (argv.includes("--help")) console.log("help");
`;

function write(path: string, text: string): void {
  mkdirSync(join(path, ".."), { recursive: true });
  writeFileSync(path, text);
}

function errors(): string[] {
  return check(root)
    .found.filter((f) => f.level === "error")
    .map((f) => `${f.where}: ${f.what}`);
}

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "validate-"));
  process.env.AGENTS_BENCH = join(root, "no-bench");
  write(join(root, "README.md"), "| [sample](skills/sample/SKILL.md) |");
  write(join(root, "skills/sample/SKILL.md"), SKILL);
  write(join(root, "skills/sample/evals/evals.json"), EVALS);
  write(join(root, "skills/sample/scripts/run.mjs"), SCRIPT);
  write(join(root, "src/skills/sample/scripts/run.mts"), SCRIPT);
});
afterEach(() => rmSync(root, { recursive: true, force: true }));

test("a skill that keeps the rules passes", () => {
  expect(errors()).toEqual([]);
});

test("a Python script is refused", () => {
  write(join(root, "skills/sample/scripts/old.py"), "print('hi')\n");
  expect(errors().join("\n")).toMatch(/compiled from TypeScript/);
});

test("a shipped script needs its source in src/", () => {
  rmSync(join(root, "src"), { recursive: true });
  expect(errors().join("\n")).toMatch(/has no source at src\/skills\/sample\/scripts\/run\.mts/);
});

test("a script that imports a package is refused", () => {
  const withPackage = SCRIPT.replace('import { argv } from "node:process";', 'import { argv } from "yargs";');
  write(join(root, "skills/sample/scripts/run.mjs"), withPackage);
  expect(errors().join("\n")).toMatch(/imports yargs/);
});

test("scripts need Node in compatibility", () => {
  write(
    join(root, "skills/sample/SKILL.md"),
    SKILL.replace("Requires Node 22 or later.", "Requires Python 3.11 or later."),
  );
  expect(errors().join("\n")).toMatch(/must say `Node 22 or later`/);
});

test("a skill missing from the README is reported", () => {
  write(join(root, "README.md"), "nothing here");
  expect(errors().join("\n")).toMatch(/does not list sample/);
});
