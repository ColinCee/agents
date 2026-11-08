import { execFileSync } from "node:child_process";
import { existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
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
  const skill = join(home, ".claude", "skills", "shipping-prs", "SKILL.md");
  expect(readFileSync(skill, "utf8")).toBe(
    readFileSync(resolve(import.meta.dirname, "..", "skills", ".experimental", "shipping-prs", "SKILL.md"), "utf8"),
  );
  writeFileSync(skill, "a fix made in the installed copy\n");
  expect(() => install(home)).toThrow(); // exit 1: something differs
  install(home, "--apply");
  install(home);
});

test("adds the hook to settings.json and keeps every other setting and hook", () => {
  const home = mkdtempSync(join(tmpdir(), "install-home-"));
  mkdirSync(join(home, ".claude"));
  const other = { matcher: "Read", hooks: [{ type: "command", command: "node other.mjs" }] };
  writeFileSync(
    join(home, ".claude", "settings.json"),
    JSON.stringify({ model: "x", hooks: { PreToolUse: [other], Stop: [] } }),
  );
  install(home, "--apply");
  const settings = JSON.parse(readFileSync(join(home, ".claude", "settings.json"), "utf8"));
  expect(settings.model).toBe("x");
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
  expect(existsSync(join(home, ".claude", "skills", "homelab-network"))).toBe(false);
});
