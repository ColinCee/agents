import { execFileSync } from "node:child_process";
import {
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { expect, test } from "vitest";

const TOOL = resolve(import.meta.dirname, "..", "tools", "install-home.ts");
const HOME = resolve(import.meta.dirname, "..", "home");
const RULES = ["core.md", "desktop.md"].map((f) => readFileSync(join(HOME, f), "utf8")).join("");
// Every turn reads them, and Anthropic advises keeping such files under about 200 lines. Growth below that is the
// reviewers' to question (shipping-prs, review-angles.md), not this test's.
const RULES_MAX_LINES = 200;

test("the rules stay under the line limit", () => {
  expect(RULES.split("\n").length).toBeLessThanOrEqual(RULES_MAX_LINES);
});

// homedir() reads HOME on macOS and Linux and USERPROFILE on Windows; set both to an empty folder. CI is set so no
// test fetches the skills other repos hold.
function install(home: string, ...args: string[]): void {
  execFileSync(process.execPath, ["--import", "tsx", TOOL, ...args], {
    env: { ...process.env, HOME: home, USERPROFILE: home, CI: "true" },
    stdio: "pipe",
    windowsHide: true,
  });
}

test("installs the rules and a CLAUDE.md that imports them", () => {
  const home = mkdtempSync(join(tmpdir(), "install-home-"));
  install(home, "--apply");
  expect(readFileSync(join(home, ".claude", "AGENTS.md"), "utf8")).toBe(RULES);
  expect(readFileSync(join(home, ".codex", "AGENTS.md"), "utf8")).toBe(RULES);
  expect(readFileSync(join(home, ".claude", "CLAUDE.md"), "utf8")).toBe("@AGENTS.md\n");
  install(home); // exits 0 only when everything matches
});

test("installs every skill, and reports an installed copy that was edited by hand", () => {
  const home = mkdtempSync(join(tmpdir(), "install-home-"));
  install(home, "--apply");
  const repoSkills = resolve(import.meta.dirname, "..", "skills");
  expect(readdirSync(join(home, ".claude", "skills")).sort()).toEqual(readdirSync(repoSkills).sort());
  const skill = join(home, ".claude", "skills", "shipping-prs", "SKILL.md");
  expect(readFileSync(skill, "utf8")).toBe(
    readFileSync(resolve(import.meta.dirname, "..", "skills", "shipping-prs", "SKILL.md"), "utf8"),
  );
  writeFileSync(skill, "a fix made in the installed copy\n");
  expect(() => install(home)).toThrow(); // exit 1: something differs
  install(home, "--apply");
  install(home);
});

test("removes a skill it installed that has left the repo, keeping a copy, and leaves other skills alone", () => {
  const home = mkdtempSync(join(tmpdir(), "install-home-"));
  const skills = join(home, ".claude", "skills");
  for (const name of ["old-listed", "old-locked", "someone-elses"]) {
    mkdirSync(join(skills, name), { recursive: true });
    writeFileSync(join(skills, name, "SKILL.md"), `${name}\n`);
  }
  mkdirSync(join(home, ".claude", "hooks"), { recursive: true });
  writeFileSync(join(home, ".claude", "hooks", "installed-skills.json"), '["old-listed"]');
  mkdirSync(join(home, ".agents"));
  writeFileSync(
    join(home, ".agents", ".skill-lock.json"),
    JSON.stringify({ skills: { "old-locked": { source: "ColinCee/agents" }, "someone-elses": { source: "x/y" } } }),
  );
  expect(() => install(home)).toThrow(); // exit 1: two would be removed
  expect(existsSync(join(skills, "old-listed"))).toBe(true);
  install(home, "--apply");
  expect(existsSync(join(skills, "old-listed"))).toBe(false);
  expect(existsSync(join(skills, "old-locked"))).toBe(false);
  expect(existsSync(join(skills, "someone-elses"))).toBe(true);
  const kept = readdirSync(join(home, ".claude", "skills-replaced"));
  expect(kept.filter((f) => f.startsWith("old-")).length).toBe(2);
  const listed = JSON.parse(readFileSync(join(home, ".claude", "hooks", "installed-skills.json"), "utf8"));
  expect(listed).toContain("shipping-prs");
  expect(listed).not.toContain("old-listed");
  install(home);
});

test("adds the hook to settings.json, turns app memory off and keeps every other setting and hook", () => {
  const home = mkdtempSync(join(tmpdir(), "install-home-"));
  mkdirSync(join(home, ".claude"));
  const other = { matcher: "Read", hooks: [{ type: "command", command: "node other.mjs" }] };
  writeFileSync(
    join(home, ".claude", "settings.json"),
    JSON.stringify({ autoMemoryEnabled: true, model: "x", hooks: { PreToolUse: [other], Stop: [] } }),
  );
  install(home, "--apply");
  const settings = JSON.parse(readFileSync(join(home, ".claude", "settings.json"), "utf8"));
  expect(settings.model).toBe("x");
  expect(settings.autoMemoryEnabled).toBe(false);
  expect(settings.hooks.Stop).toEqual([]);
  expect(settings.hooks.PreToolUse[0]).toEqual(other);
  expect(settings.hooks.PreToolUse[1].hooks[0].command).toContain("require-skill.mjs");
  install(home); // a second install finds it already there
  install(home, "--apply");
  expect(JSON.parse(readFileSync(join(home, ".claude", "settings.json"), "utf8")).hooks.PreToolUse).toHaveLength(2);
});

// Windows without Developer Mode cannot make links; CI on macOS and Linux covers it.
test.skipIf(process.platform === "win32")("replaces a CLAUDE.md link without writing through it", () => {
  const home = mkdtempSync(join(tmpdir(), "install-home-"));
  mkdirSync(join(home, ".claude"));
  writeFileSync(join(home, ".claude", "AGENTS.md"), RULES);
  symlinkSync("AGENTS.md", join(home, ".claude", "CLAUDE.md"));
  install(home, "--apply");
  expect(readFileSync(join(home, ".claude", "AGENTS.md"), "utf8")).toBe(RULES);
  expect(lstatSync(join(home, ".claude", "CLAUDE.md")).isSymbolicLink()).toBe(false);
  expect(readFileSync(join(home, ".claude", "CLAUDE.md"), "utf8")).toBe("@AGENTS.md\n");
});

test("leaves out other repos' skills in CI, where Kaizen's runners install", () => {
  const home = mkdtempSync(join(tmpdir(), "install-home-"));
  install(home, "--apply");
  expect(existsSync(join(home, ".claude", "skills", "reaching-homelab-devices"))).toBe(false);
});

// --import takes a URL; a bare Windows path (C:\\...) does not load.
const FAKE_FETCH = pathToFileURL(resolve(import.meta.dirname, "fixtures", "fake-fetch.mjs")).href;
// Like install(), outside CI, with fetch answered by fake-fetch.mjs; returns the exit code.
function installOther(home: string, skill: string | undefined, ...args: string[]): number {
  try {
    execFileSync(process.execPath, ["--import", "tsx", "--import", FAKE_FETCH, TOOL, ...args], {
      env: { ...process.env, HOME: home, USERPROFILE: home, CI: "", FAKE_SKILL: skill ?? "" },
      stdio: "pipe",
      windowsHide: true,
    });
    return 0;
  } catch (e) {
    return (e as { status: number }).status;
  }
}

test("installs another repo's skill, and a failed or wrong download fails the run", () => {
  const home = mkdtempSync(join(tmpdir(), "install-home-"));
  const skill = join(home, ".claude", "skills", "reaching-homelab-devices", "SKILL.md");
  expect(installOther(home, undefined, "--apply")).toBe(1);
  expect(existsSync(skill)).toBe(false);
  expect(installOther(home, "<html>sign in</html>", "--apply")).toBe(1);
  expect(existsSync(skill)).toBe(false);
  const good = "---\nname: reaching-homelab-devices\n---\nbody\n";
  expect(installOther(home, good, "--apply")).toBe(0);
  expect(readFileSync(skill, "utf8")).toBe(good);
  expect(installOther(home, good)).toBe(0);
});

// Windows without Developer Mode cannot make links; CI on macOS and Linux covers it.
test.skipIf(process.platform === "win32")("replaces a linked skill folder without writing through it", () => {
  const home = mkdtempSync(join(tmpdir(), "install-home-"));
  const store = join(home, ".agents", "skills", "reaching-homelab-devices");
  mkdirSync(store, { recursive: true });
  writeFileSync(join(store, "SKILL.md"), "the other installer's copy\n");
  mkdirSync(join(home, ".claude", "skills"), { recursive: true });
  symlinkSync(store, join(home, ".claude", "skills", "reaching-homelab-devices"));
  const good = "---\nname: reaching-homelab-devices\n---\nbody\n";
  expect(installOther(home, good, "--apply")).toBe(0);
  expect(readFileSync(join(store, "SKILL.md"), "utf8")).toBe("the other installer's copy\n");
  expect(lstatSync(join(home, ".claude", "skills", "reaching-homelab-devices")).isSymbolicLink()).toBe(false);
  expect(readFileSync(join(home, ".claude", "skills", "reaching-homelab-devices", "SKILL.md"), "utf8")).toBe(good);
});
