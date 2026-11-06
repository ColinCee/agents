import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const HOOK = resolve(__dirname, "..", "home", "hooks", "require-skill.mjs");
const dir = mkdtempSync(join(tmpdir(), "require-skill-"));
// A home folder whose installer lock says shipping-prs came from the agents repo and asd-ste100 from elsewhere.
const fakeHome = join(dir, "home");
mkdirSync(join(fakeHome, ".agents"), { recursive: true });
writeFileSync(
  join(fakeHome, ".agents", ".skill-lock.json"),
  JSON.stringify({
    skills: { "shipping-prs": { source: "ColinCee/agents" }, "asd-ste100": { source: "someone/else" } },
  }),
);
// A session that has loaded no skill yet.
const empty = join(dir, "empty.jsonl");
writeFileSync(empty, '{"type":"user","message":{"content":"hi"}}\n');
const loaded = join(dir, "loaded.jsonl");
writeFileSync(
  loaded,
  ["shipping-prs", "deciding", "doc-upkeep"]
    .map((s) => `{"message":{"content":[{"type":"tool_use","name":"Skill","input":{"skill":"${s}"}}]}}`)
    .join("\n"),
);

function run(tool_name: string, tool_input: object, transcript = empty): number | null {
  const input = JSON.stringify({ tool_name, tool_input, transcript_path: transcript });
  return spawnSync("node", [HOOK], { input, env: { ...process.env, HOME: fakeHome, USERPROFILE: fakeHome } }).status;
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
    expect(run("Bash", { command: "git commit --no-edit" })).toBe(0);
    expect(run("Bash", { command: 'git commit -m "a -- b"' })).toBe(2);
    // A search pattern is data: this one blocked a reviewer's read on 5 Nov.
    expect(run("Bash", { command: 'git show HEAD:build.yml | grep -n "x | git commit -m y"' })).toBe(0);
    expect(run("Bash", { command: "rg 'gh pr create|git push -u' docs" })).toBe(0);
  });

  it("reads git's subcommand, not a word in a branch name", () => {
    expect(run("Bash", { command: "git checkout -b fix-commit" })).toBe(0);
    expect(run("Bash", { command: "git push -u origin fix-commit-paths" }, loaded)).toBe(0);
    expect(run("Bash", { command: 'git -C "my repo" -c user.name=x commit -m y' })).toBe(2);
  });

  it("refuses edits to installed copies, which the next install overwrites", () => {
    const home = (p: string) => join(fakeHome, p);
    expect(run("Edit", { file_path: home(".claude/skills/shipping-prs/SKILL.md") }, loaded)).toBe(2);
    expect(run("Edit", { file_path: home(".claude/skills/asd-ste100/SKILL.md") }, loaded)).toBe(0);
    expect(run("Write", { file_path: home(".claude/AGENTS.md") }, loaded)).toBe(2);
    expect(run("Edit", { file_path: home(".claude/hooks/require-skill.mjs") })).toBe(2);
    expect(run("Edit", { file_path: home(".claude/projects/p/memory/m.md") })).toBe(0);
    expect(run("Edit", { file_path: "D:\\repo\\.claude\\skills\\writing-posts\\SKILL.md" }, loaded)).toBe(0);
  });

  it("never traps an agent whose transcript can't be read", () => {
    expect(run("Bash", { command: "gh pr create --fill" }, join(dir, "missing.jsonl"))).toBe(0);
  });

  it("needs shipping-prs before a first push or a pull request", () => {
    expect(run("Bash", { command: "git push -u origin feature" })).toBe(2);
    expect(run("Bash", { command: "gh pr create --fill" })).toBe(2);
    expect(run("Bash", { command: "git push -u origin feature" }, loaded)).toBe(0);
    expect(run("Bash", { command: "git push origin main" })).toBe(0);
    expect(run("Bash", { command: "gh pr view 3" })).toBe(0);
  });

  it("needs deciding before a benchmark and doc-upkeep before a doc or code edit", () => {
    expect(run("PowerShell", { command: 'hyperfine "npm test"' })).toBe(2);
    expect(run("Edit", { file_path: "D:\\repo\\AGENTS.md" })).toBe(2);
    expect(run("Edit", { file_path: "D:\\repo\\AGENTS.md" }, loaded)).toBe(0);
    expect(run("Write", { file_path: "C:\\Users\\u\\.claude\\projects\\p\\memory\\m.md" })).toBe(0);
    expect(run("Write", { file_path: "D:\\repo\\src\\a.ts" })).toBe(2);
    expect(run("Write", { file_path: "D:\\repo\\src\\a.ts" }, loaded)).toBe(0);
    expect(run("Write", { file_path: "D:\\repo\\data.json" })).toBe(0);
    expect(run("Write", { file_path: "D:\\repo\\pnpm-lock.yaml" })).toBe(0);
  });
});
