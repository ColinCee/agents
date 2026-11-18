/**
 * Install the lease command and its Claude Code band for this user. `npm run install-lease` builds it first.
 *
 *   ~/.leases/lease.mjs        the command, one file with no dependencies (state and log live beside it)
 *   ~/.local/bin/lease(.cmd)   `lease` on PATH
 *   ~/.leases/mod              the `lease` mod, the band in Claude Code, copied from mods/lease; only where the claude CLI is
 *
 * The lease itself needs only Node: other agents and apps call the command and never see the mod.
 *
 * Safe to run again: each step replaces what an earlier run wrote. Exit codes: 0 done, 1 a step failed.
 */

import { spawnSync } from "node:child_process";
import { copyFileSync, cpSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const leases = process.env.LEASES_HOME ?? join(homedir(), ".leases");
const bin = join(homedir(), ".local", "bin");
const windows = process.platform === "win32";

mkdirSync(leases, { recursive: true });
const command = join(leases, "lease.mjs");
copyFileSync(join(root, "dist", "lease", "lease.mjs"), command);
console.log(`installed ${command}`);

mkdirSync(bin, { recursive: true });
const shim = join(bin, windows ? "lease.cmd" : "lease");
// The real node, not a version manager's launcher (Volta's adds its own cmd.exe and node.exe), so the shim's cmd.exe is
// the only layer between the caller and lease, the one `caller()` steps over.
writeFileSync(
  shim,
  windows ? `@"${process.execPath}" "${command}" %*\r\n` : `#!/bin/sh\nexec node "${command}" "$@"\n`,
  windows ? "utf8" : { encoding: "utf8", mode: 0o755 },
);
console.log(`installed ${shim}`);

// Claude Code loads a folder marketplace from its folder on every start, so it is registered from a copy beside the
// command, never from this checkout: a worktree's folder is deleted with it, and the band then fails to load.
const mod = join(leases, "mod");
rmSync(mod, { recursive: true, force: true });
for (const part of [".claude-plugin", "hooks", "types"])
  cpSync(join(root, "mods", "lease", part), join(mod, part), { recursive: true });
// Re-adding is what replaces a marketplace from another folder (one from before this copy) and refreshes the plugin's
// cached files at an unchanged version; removing it also uninstalls the plugin. It fails harmlessly when absent.
const run = (args: string[]) => spawnSync("claude", ["plugin", ...args], { encoding: "utf8", windowsHide: true });
const removed = run(["marketplace", "remove", "lease-local"]);
const claude =
  (removed.error as NodeJS.ErrnoException | undefined)?.code === "ENOENT"
    ? removed
    : run(["install", "lease", "--marketplace", mod, "--scope", "user"]);
const said = `${claude.stdout ?? ""}${claude.stderr ?? ""}`.trim();
if ((claude.error as NodeJS.ErrnoException | undefined)?.code === "ENOENT")
  console.log("no claude CLI here: skipped the Claude Code band; the lease works without it");
else if (claude.status === 0) console.log(said || "installed the lease mod");
else {
  console.error(`the lease mod was not installed (${said || claude.error?.message || `exit ${claude.status}`}).`);
  console.error(`By hand: claude plugin install lease --marketplace "${mod}" --scope user`);
  process.exitCode = 1;
}
