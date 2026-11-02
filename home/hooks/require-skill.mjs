// A Claude Code PreToolUse hook (Bash and PowerShell): refuse opening or merging a pull request until the session
// has loaded the shipping-prs skill, so its reviews happen every time rather than when an agent remembers.
import { readFileSync } from "node:fs";

const input = JSON.parse(readFileSync(0, "utf8"));
const command = String(input.tool_input?.command ?? "");
// gh in any spelling (gh, gh.exe, flags before `pr`), at the start of a command; or the merge API itself.
const prCommand = /(^|[;&|(\n]\s*)gh(\.exe)?\b[^;&|\n]*?\bpr\s+(create|merge)\b/;
const mergeApi = /(^|[;&|(\n]\s*)gh(\.exe)?\b[^;&|\n]*\bapi\b[^;&|\n]*\/pulls\/\d+\/merge\b/;
if (!prCommand.test(command) && !mergeApi.test(command)) process.exit(0);

let transcript = "";
try {
  transcript = readFileSync(input.transcript_path, "utf8");
} catch {}
// The Skill tool call itself, not any text that merely mentions the skill.
if (transcript.includes('"name":"Skill","input":{"skill":"shipping-prs"')) process.exit(0);

console.error("Load the shipping-prs skill (Skill tool) before opening or merging a pull request, and follow its review step.");
process.exit(2);
