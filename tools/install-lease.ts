/**
 * Install the lease command and its Claude Code band for this user. `npm run install-lease` builds it first.
 *
 *   ~/.leases/lease.mjs        the command, one file with no dependencies (state and log live beside it)
 *   ~/.local/bin/lease(.cmd)   `lease` on PATH
 *   the `lease` mod            the band in Claude Code, from mods/lease; only where the claude CLI is
 *
 * The lease itself needs only Node: other agents and apps call the command and never see the mod.
 *
 * Safe to run again: each step replaces what an earlier run wrote. Exit codes: 0 done, 1 a step failed.
 */

import { spawnSync } from "node:child_process";
import { copyFileSync, mkdirSync, writeFileSync } from "node:fs";
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
writeFileSync(
  shim,
  windows ? `@node "${command}" %*\r\n` : `#!/bin/sh\nexec node "${command}" "$@"\n`,
  windows ? "utf8" : { encoding: "utf8", mode: 0o755 },
);
console.log(`installed ${shim}`);

const claude = spawnSync(
  "claude",
  ["plugin", "install", "lease", "--marketplace", join(root, "mods", "lease"), "--scope", "user"],
  { encoding: "utf8", windowsHide: true },
);
const said = `${claude.stdout ?? ""}${claude.stderr ?? ""}`.trim();
if ((claude.error as NodeJS.ErrnoException | undefined)?.code === "ENOENT")
  console.log("no claude CLI here: skipped the Claude Code band; the lease works without it");
else if (claude.status === 0) console.log(said || "installed the lease mod");
else {
  console.error(`the lease mod was not installed (${said || claude.error?.message || `exit ${claude.status}`}).`);
  console.error(`By hand: claude plugin install lease --marketplace "${join(root, "mods", "lease")}" --scope user`);
  process.exitCode = 1;
}
