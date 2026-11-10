import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const HOOK = resolve(__dirname, "..", "home", "hooks", "require-skill.mjs");
// The real path: macOS's temp folder is a link, and a process in it reports the path the link points to.
const dir = realpathSync(mkdtempSync(join(tmpdir(), "require-skill-")));
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
// A session that has loaded these skills.
function loading(...skills: string[]): string {
  const path = join(dir, `${skills.join("+")}.jsonl`);
  writeFileSync(
    path,
    skills
      .map((s) => `{"message":{"content":[{"type":"tool_use","name":"Skill","input":{"skill":"${s}"}}]}}`)
      .join("\n"),
  );
  return path;
}
const ALL = ["shipping-prs", "comparing-options", "updating-docs", "writing-comments", "recording-learnings"];
const loaded = loading(...ALL);

// A stand-in for gh: `pr checks` exits as CHECKS says ("pass" 0, "fail" 1 with a failing line, "none": no checks),
// `pr list` prints the pull request PR names (empty: none).
const fakeGh = join(dir, "gh.mjs");
writeFileSync(
  fakeGh,
  `const [a, b] = process.argv.slice(2);
if (a === "pr" && b === "checks") {
  // IN names the folder gh must run in: elsewhere it finds no pull request, as real gh does.
  if (process.env.IN && process.cwd().replaceAll("\\\\", "/").toLowerCase() !== process.env.IN.toLowerCase()) {
    console.error("no pull requests found for branch main"); process.exit(1);
  }
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

function hook(tool_name: string, tool_input: object, transcript = empty, env: object = {}) {
  const input = JSON.stringify({ tool_name, tool_input, transcript_path: transcript, cwd: resolve(__dirname, "..") });
  return spawnSync("node", [HOOK], {
    input,
    encoding: "utf8",
    env: { ...process.env, HOME: fakeHome, USERPROFILE: fakeHome, REQUIRE_SKILL_GH: fakeGh, ...env },
  });
}
const run = (...args: Parameters<typeof hook>): number | null => hook(...args).status;
// Why a session with no skill loaded is refused: the message names the skill to load.
function refusal(tool_name: string, tool_input: object): string {
  const done = hook(tool_name, tool_input);
  expect(done.status).toBe(2);
  return done.stderr;
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

  it("counts a subagent's own Skill calls, kept beside the session's transcript", () => {
    const session = join(dir, "session.jsonl");
    writeFileSync(session, '{"type":"user","message":{"content":"hi"}}\n');
    mkdirSync(join(dir, "session", "subagents"), { recursive: true });
    writeFileSync(join(dir, "session", "subagents", "agent-a1.jsonl"), readFileSync(loaded, "utf8"));
    const push = (agent_id?: string) =>
      spawnSync("node", [HOOK], {
        input: JSON.stringify({
          tool_name: "Bash",
          tool_input: { command: "git push -u origin x" },
          transcript_path: session,
          agent_id,
        }),
        env: { ...process.env, HOME: fakeHome, USERPROFILE: fakeHome, REQUIRE_SKILL_GH: fakeGh },
      }).status;
    expect(push("a1")).toBe(0);
    expect(push()).toBe(2);
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

  it("asks gh in the folder the command moves to, as merges after cd were refused on 8 and 9 Nov", () => {
    const merge = (tool: string, command: string, env: object) => run(tool, { command }, loaded, env);
    const spaced = join(dir, "a repo");
    mkdirSync(spaced, { recursive: true });
    const IN = spaced.replaceAll("\\", "/");
    expect(merge("Bash", `cd "${IN}" && gh pr merge 5 --squash`, { CHECKS: "pass", IN })).toBe(0);
    expect(merge("PowerShell", `Set-Location '${IN}'; gh pr merge 5`, { CHECKS: "pass", IN })).toBe(0);
    expect(
      merge("Bash", `cd "${dir.replaceAll("\\", "/")}" && cd "a repo" && gh pr merge 5`, { CHECKS: "pass", IN }),
    ).toBe(0);
    expect(merge("Bash", `cd "${IN}" && gh pr merge 5`, { CHECKS: "fail", IN })).toBe(2);
    // Git Bash spells D:\x as /d/x.
    if (process.platform === "win32") {
      const bash = IN.replace(/^([A-Za-z]):/, (_m, d: string) => `/${d.toLowerCase()}`);
      expect(merge("Bash", `cd "${bash}" && gh pr merge 5`, { CHECKS: "pass", IN })).toBe(0);
    }
  });

  it("reads a quoted search or a help request as data, not a merge (blocked a grep on 9 Nov)", () => {
    const check = (command: string) => run("Bash", { command }, loaded, { CHECKS: "broken" });
    expect(check('grep -n "gh pr merge" hooks/require-skill.mjs')).toBe(0);
    expect(check("rg 'x | gh pr merge 5' docs")).toBe(0);
    expect(check("gh pr merge --help")).toBe(0);
    // Code inside a shell's -c or -Command, behind an escaped quote, or in a subshell is still a merge.
    expect(check('pwsh -NoProfile -Command "cd x; gh pr merge 5"')).toBe(2);
    expect(check("bash -c 'true && gh pr merge 5'")).toBe(2);
    expect(check('echo \\"; gh pr merge 5; echo \\"')).toBe(2);
    expect(check("(gh pr merge 5)")).toBe(2);
    expect(check('bash -c "gh pr merge 5"')).toBe(2);
    expect(check('bash -lc "cd x; gh pr merge 5"')).toBe(2);
    expect(check("cd 'x\\'; gh pr merge 5 --body 'ok'")).toBe(2);
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
    expect(push("git -c a=b push origin HEAD:main", { PR: "", CHECKS: "pass" })).toBe(2);
    expect(push("git push -u origin feature-main", { PR: "", CHECKS: "pass" })).toBe(0);
  });

  it("needs comparing-options before a benchmark", () => {
    expect(refusal("PowerShell", { command: 'hyperfine "npm test"' })).toMatch(/comparing-options/);
    expect(run("PowerShell", { command: 'hyperfine "npm test"' }, loaded)).toBe(0);
  });

  it("routes each edit to the one skill it needs: a doc, code, or agent rules", () => {
    const routes: [string, string][] = [
      ["D:\\repo\\README.md", "updating-docs"],
      ["D:\\repo\\docs\\plan.md", "updating-docs"],
      ["D:\\repo\\src\\a.ts", "writing-comments"],
      ["D:\\repo\\deploy.yml", "writing-comments"],
      ["/home/u/repo/src/a.py", "writing-comments"],
      ["/home/u/repo/notes.md", "updating-docs"],
      ["D:\\repo\\AGENTS.md", "recording-learnings"],
      ["D:\\repo\\CLAUDE.md", "recording-learnings"],
      ["D:\\repo\\.claude\\skills\\x\\SKILL.md", "recording-learnings"],
      ["D:\\repo\\docs\\adr\\0001-x.md", "recording-learnings"],
      ["D:\\agents\\home\\core.md", "recording-learnings"],
      ["D:\\agents\\home\\hooks\\require-skill.mjs", "recording-learnings"],
    ];
    for (const [file_path, skill] of routes) {
      expect(refusal("Edit", { file_path }), file_path).toMatch(new RegExp(`Load the ${skill} skill`));
      expect(run("Edit", { file_path }, loading(skill)), file_path).toBe(0);
      expect(run("Edit", { file_path }, loading(...ALL.filter((s) => s !== skill))), file_path).toBe(2);
    }
  });

  it("asks for no skill before editing data, lock files or the app's memory", () => {
    expect(run("Write", { file_path: "C:\\Users\\u\\.claude\\projects\\p\\memory\\m.md" })).toBe(0);
    expect(run("Write", { file_path: "D:\\repo\\data.json" })).toBe(0);
    expect(run("Write", { file_path: "D:\\repo\\pnpm-lock.yaml" })).toBe(0);
  });
});
