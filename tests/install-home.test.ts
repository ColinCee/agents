import { execFileSync } from "node:child_process";
import { lstatSync, mkdirSync, mkdtempSync, readFileSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { expect, test } from "vitest";

const TOOL = resolve(import.meta.dirname, "..", "tools", "install-home.ts");
const RULES = readFileSync(resolve(import.meta.dirname, "..", "home", "AGENTS.md"), "utf8");

// homedir() reads HOME on macOS and Linux and USERPROFILE on Windows; set both to an empty folder.
function install(home: string, ...args: string[]): void {
  execFileSync(process.execPath, ["--import", "tsx", TOOL, ...args], {
    env: { ...process.env, HOME: home, USERPROFILE: home },
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
