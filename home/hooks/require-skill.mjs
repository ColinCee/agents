// A Claude Code PreToolUse hook: refuse `gh pr create` and `gh pr merge` until the session has loaded the
// shipping-prs skill, so its reviews happen every time rather than when an agent remembers.
import { readFileSync } from "node:fs";

const input = JSON.parse(readFileSync(0, "utf8"));
const command = String(input.tool_input?.command ?? "");
if (!/\bgh\s+pr\s+(create|merge)\b/.test(command)) process.exit(0);

let transcript = "";
try {
  transcript = readFileSync(input.transcript_path, "utf8");
} catch {}
if (/"skill"\s*:\s*"shipping-prs"|Launching skill: shipping-prs/.test(transcript)) process.exit(0);

console.error("Load the shipping-prs skill (Skill tool) before opening or merging a pull request, and follow its review step.");
process.exit(2);
