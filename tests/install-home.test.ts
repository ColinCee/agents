import { execFileSync } from "node:child_process";
import { lstatSync, mkdirSync, mkdtempSync, readFileSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { beforeAll, expect, test } from "vitest";

const TOOL = resolve(import.meta.dirname, "..", "tools", "install-home.ts");
const RULES = readFileSync(resolve(import.meta.dirname, "..", "home", "AGENTS.md"), "utf8");

// install-home copies the built session review; npm run install-home builds it first.
beforeAll(() => {
  execFileSync(
    process.execPath,
    [resolve(import.meta.dirname, "..", "node_modules", "typescript", "bin", "tsc"), "-p", "tsconfig.home.json"],
    {
      cwd: resolve(import.meta.dirname, ".."),
      windowsHide: true,
    },
  );
});

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

test("adds the session review as SessionEnd and SessionStart hooks and keeps every other setting", () => {
  const home = mkdtempSync(join(tmpdir(), "install-home-"));
  mkdirSync(join(home, ".claude"));
  const other = { type: "command", command: "other-tool", args: ["hook"], timeout: 10 };
  const before = { model: "x", hooks: { SessionEnd: [{ hooks: [other] }], Stop: [{ hooks: [other] }] } };
  writeFileSync(join(home, ".claude", "settings.json"), JSON.stringify(before));
  install(home, "--apply");
  install(home, "--apply"); // twice: one hook, not two
  const after = JSON.parse(readFileSync(join(home, ".claude", "settings.json"), "utf8"));
  const script = join(home, ".claude", "session-reviews", "review-on-archive.mjs");
  expect(after.model).toBe("x");
  expect(after.hooks.Stop).toEqual(before.hooks.Stop);
  expect(after.hooks.SessionStart).toEqual([
    { hooks: [{ type: "command", command: "node", args: [script, "kick"], timeout: 10 }] },
  ]);
  expect(after.hooks.SessionEnd).toEqual([
    { hooks: [other] },
    { hooks: [{ type: "command", command: "node", args: [script], timeout: 10 }] },
  ]);
  expect(lstatSync(script).isFile()).toBe(true);
  install(home);
});
