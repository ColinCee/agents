import { defineConfig } from "vitest/config";

// mods/ holds Claude Code mods, whose tests run under `claude plugin test`, not here. .claude/ holds other sessions'
// worktrees of this repository, and jobs/ benchmark output: neither is this checkout's code.
export default defineConfig({ test: { exclude: ["mods/**", "node_modules/**", ".claude/**", "jobs/**"] } });
