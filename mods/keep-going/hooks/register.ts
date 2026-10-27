import type { EngineInterface, Register } from "claude-code";

// When the main agent ends its turn, it gets one reminder to check whether the user is really needed; its own rules
// (AGENTS.md) and the whole conversation decide. Each reminder is logged, so their number a day is known; whether
// they help is measured against past sessions, which had no reminder.

const VERSION = "v1"; // the reminder's wording; logged with each one, so a reworded reminder is measured on its own
// "Add nothing" keeps the agent's real last message (its summary or its question) as the last thing the user sees.
const REMINDER =
  "Keep-going check: by your AGENTS.md rules, does your next step really need the user? If not, do it now. " +
  "If it does, stop again and add nothing.";

async function log($: EngineInterface, session: string): Promise<void> {
  const home = (await $.env.get("USERPROFILE")) ?? (await $.env.get("HOME")) ?? "";
  const at = new Date(await $.clock.now()).toISOString();
  // A file per session per day, so sessions never write the same file.
  const path = `${home}/.claude/keep-going/log/${at.slice(0, 10)}/${session}.jsonl`;
  const before = await $.fs.read(path).catch(() => "");
  await $.fs.write(path, `${before}${JSON.stringify({ at, version: VERSION, session })}\n`);
}

export const register: Register = (on) => {
  on("classic.Stop", async ($, e, next) => {
    const result = await next(e);
    // The stop stands: the agent is answering a reminder already, another hook decided, work it started will wake it,
    // or a script ran it (`claude -p`, the SDK) and reads its last message as the result.
    const scripted = (await $.env.get("CLAUDE_CODE_ENTRYPOINT"))?.startsWith("sdk") ?? false;
    if (e.stop_hook_active || result.block || result.preventContinuation || e.background_tasks?.length || scripted)
      return result;
    await log($, e.session_id).catch(() => {}); // a lost log line must not cost the reminder
    return { ...result, block: REMINDER };
  });
};
