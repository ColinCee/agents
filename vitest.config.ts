import { defineConfig } from "vitest/config";

// mods/ holds Claude Code mods, whose tests run under `claude plugin test`, not here.
export default defineConfig({ test: { exclude: ["mods/**", "node_modules/**"] } });
