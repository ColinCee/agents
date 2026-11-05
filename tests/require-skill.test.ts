import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const HOOK = resolve(__dirname, "..", "home", "hooks", "require-skill.mjs");
const dir = mkdtempSync(join(tmpdir(), "require-skill-"));
const empty = join(dir, "empty.jsonl");
writeFileSync(empty, "");
const loaded = join(dir, "loaded.jsonl");
writeFileSync(
  loaded,
  ["shipping-prs", "deciding", "doc-upkeep"]
    .map((s) => `{"message":{"content":[{"type":"tool_use","name":"Skill","input":{"skill":"${s}"}}]}}`)
    .join("\n"),
);

function run(tool_name: string, tool_input: object, transcript = empty): number | null {
  const input = JSON.stringify({ tool_name, tool_input, transcript_path: transcript });
  return spawnSync("node", [HOOK], { input }).status;
}

describe("require-skill hook", () => {
  it("refuses a commit that names no paths, as agents ran it in a shared checkout", () => {
    expect(run("Bash", { command: 'git add docs/a.md && git commit -m "Fix the doc"' })).toBe(2);
    expect(run("PowerShell", { command: 'git -C repo commit -qm "x"' })).toBe(2);
  });

  it("lets a commit with paths through, even after a quoted message holding ; or &&", () => {
    expect(run("Bash", { command: 'git commit -m "a; b && c" -- docs/a.md' })).toBe(0);
    expect(run("Bash", { command: "git commit --amend --no-edit" })).toBe(0);
    expect(run("Bash", { command: 'rg "git commit" docs' })).toBe(0);
  });

  it("needs shipping-prs before a first push or a pull request", () => {
    expect(run("Bash", { command: "git push -u origin feature" })).toBe(2);
    expect(run("Bash", { command: "gh pr create --fill" })).toBe(2);
    expect(run("Bash", { command: "git push -u origin feature" }, loaded)).toBe(0);
    expect(run("Bash", { command: "git push origin main" })).toBe(0);
    expect(run("Bash", { command: "gh pr view 3" })).toBe(0);
  });

  it("needs deciding before a benchmark and doc-upkeep before a doc edit", () => {
    expect(run("PowerShell", { command: 'hyperfine "npm test"' })).toBe(2);
    expect(run("Edit", { file_path: "D:\\repo\\AGENTS.md" })).toBe(2);
    expect(run("Edit", { file_path: "D:\\repo\\AGENTS.md" }, loaded)).toBe(0);
    expect(run("Write", { file_path: "C:\\Users\\u\\.claude\\projects\\p\\memory\\m.md" })).toBe(0);
    expect(run("Write", { file_path: "D:\\repo\\src\\a.ts" })).toBe(0);
  });
});
