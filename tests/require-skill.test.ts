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

// A stand-in for gh: `pr checks` exits as CHECKS says ("pass" 0, "fail" 1 with a failing line, "none": no checks),
// `pr list` prints the pull request PR names (empty: none).
const fakeGh = join(dir, "gh.mjs");
writeFileSync(
  fakeGh,
  `const [a, b] = process.argv.slice(2);
if (a === "pr" && b === "checks") {
  const c = process.env.CHECKS;
  if (c === "none") { console.error("no checks reported on the 'x' branch"); process.exit(1); }
  if (c === "fail") { console.log("check\\tfail\\t1m\\thttps://x"); process.exit(1); }
  if (c === "pending") { console.log("check\\tpending\\t0\\thttps://x"); process.exit(8); }
  if (c === "broken") { console.error("gh: To get started with GitHub CLI, please run: gh auth login"); process.exit(4); }
  process.exit(0);
}
if (a === "pr" && b === "list") { console.log(process.env.PR ?? ""); process.exit(0); }
process.exit(0);`,
);

function run(tool_name: string, tool_input: object, transcript = empty, env: object = {}): number | null {
  const input = JSON.stringify({ tool_name, tool_input, transcript_path: transcript, cwd: resolve(__dirname, "..") });
  return spawnSync("node", [HOOK], {
    input,
    env: { ...process.env, HOME: fakeHome, USERPROFILE: fakeHome, REQUIRE_SKILL_GH: fakeGh, ...env },
  }).status;
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
    expect(run("Bash", { command: "gh pr view 3" })).toBe(0);
  });

  it("merges only once the checks pass, as a required check would (auto-kaizen#664 merged red)", () => {
    const merge = (command: string, env: object) => run("Bash", { command }, loaded, env);
    expect(merge("gh pr merge 664 --squash -R o/r", { CHECKS: "fail" })).toBe(2);
    expect(merge("gh pr merge 664 --squash -R o/r", { CHECKS: "pass" })).toBe(0);
    expect(merge("gh pr merge 7 --squash", { CHECKS: "none" })).toBe(0);
    expect(merge("gh api -X PUT repos/o/r/pulls/9/merge", { CHECKS: "fail" })).toBe(2);
    expect(merge("gh pr view 664", { CHECKS: "fail" })).toBe(0);
    // The number after flags, in quotes, or with an env prefix; every merge in the command.
    expect(merge('gh pr merge --squash "664" -R "o/r"', { CHECKS: "fail" })).toBe(2);
    expect(merge("GH_TOKEN=x gh pr merge 664", { CHECKS: "fail" })).toBe(2);
    expect(merge("gh pr view 1 && gh pr merge 664", { CHECKS: "fail" })).toBe(2);
    // --auto waits for the checks itself: pending is fine, a failure is not.
    expect(merge("gh pr merge 664 --auto", { CHECKS: "pending" })).toBe(0);
    expect(merge("gh pr merge 664", { CHECKS: "pending" })).toBe(2);
    expect(merge("gh pr merge 664 --auto", { CHECKS: "fail" })).toBe(2);
    // gh that cannot answer merges nothing.
    expect(merge("gh pr merge 664", { CHECKS: "broken" })).toBe(2);
    expect(merge('gh api graphql -f query="mutation{mergePullRequest(input:{})}"', { CHECKS: "pass" })).toBe(2);
  });

  it("pushes to main only a passing pull request's head", () => {
    const push = (command: string, env: object) => run("Bash", { command }, loaded, env);
    expect(push("git push origin HEAD:main", { PR: "", CHECKS: "pass" })).toBe(2);
    expect(push("git push origin HEAD:main", { PR: "12", CHECKS: "fail" })).toBe(2);
    expect(push("git push origin HEAD:main", { PR: "12", CHECKS: "pass" })).toBe(0);
    expect(push("git push origin main-docs", { PR: "", CHECKS: "fail" })).toBe(0);
    expect(push("git push origin feature:refs/heads/main", { PR: "", CHECKS: "pass" })).toBe(2);
    expect(push("git push origin 'HEAD:main'", { PR: "", CHECKS: "pass" })).toBe(2);
    expect(push("git push --force origin +HEAD:main", { PR: "", CHECKS: "pass" })).toBe(2);
    expect(push("git push --mirror origin", { PR: "", CHECKS: "pass" })).toBe(2);
    expect(push("git push -u origin feature-main", { PR: "", CHECKS: "pass" })).toBe(0);
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
