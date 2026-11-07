import type { EngineInterface, Register } from "claude-code";

// When the main agent ends its turn, it gets one reminder to check whether the user is really needed; its own rules
// (AGENTS.md) and the whole conversation decide. Half the sessions get it and half do not, so the two halves differ
// only in the reminder (docs/keep-going.md).

const VERSION = "v3"; // the reminder's wording; logged with each one, so a reworded reminder is measured on its own
// Ending with no text keeps the agent's real last message (its summary or its question) as the last thing the user sees.
// v1 said "add nothing", and agents wrote a line saying so after about half the reminders (4 Nov: 37 of 69).
// v2 asked a question, and agents answered it ("Nothing needs you") after about a third (5 to 6 Nov: 90 of 275).
const REMINDER =
  "Keep-going check, for you only; do not reply to it: if your AGENTS.md rules let you take the next step " +
  "yourself, take it now; otherwise end your turn with an empty reply.";

/** The session's half of the trial: an even last hex digit of its id gets the reminder (as in stop-score.sql). */
const arm = (session: string): "on" | "off" => (Number.parseInt(session.slice(-1), 16) % 2 === 0 ? "on" : "off");

async function log($: EngineInterface, session: string): Promise<void> {
  const home = (await $.env.get("USERPROFILE")) ?? (await $.env.get("HOME")) ?? "";
  const at = new Date(await $.clock.now()).toISOString();
  // A file per session per day, so sessions never write the same file.
  const path = `${home}/.claude/keep-going/log/${at.slice(0, 10)}/${session}.jsonl`;
  const before = await $.fs.read(path).catch(() => "");
  await $.fs.write(path, `${before}${JSON.stringify({ at, version: VERSION, session, arm: arm(session) })}\n`);
}

export const register: Register = (on) => {
  on("classic.Stop", async ($, e, next) => {
    const result = await next(e);
    // The stop stands: the agent is answering a reminder already, another hook decided, work it started will wake it,
    // or a script ran it (`claude -p`, the SDK) and reads its last message as the result.
    const scripted = (await $.env.get("CLAUDE_CODE_ENTRYPOINT"))?.startsWith("sdk") ?? false;
    if (e.stop_hook_active || result.block || result.preventContinuation || e.background_tasks?.length || scripted)
      return result;
    // Logged in both halves, so each half counts the stops that could get a reminder the same way.
    await log($, e.session_id).catch(() => {}); // a lost log line must not cost the reminder
    return arm(e.session_id) === "on" ? { ...result, block: REMINDER } : result;
  });
};
