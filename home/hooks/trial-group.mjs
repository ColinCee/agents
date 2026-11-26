// Which half of a rule trial a task is in (docs/keep-going.md). rule-groups.mjs gives a session its trial rules from
// this, and a hook on trial asks it whether to act, so both always agree.
import { createHash } from "node:crypto";

/** The task a hook's input belongs to: the desktop app's worktree, whose name outlives the session id, else the session. */
export const taskOf = (input) =>
  /[\\/]\.claude[\\/]worktrees[\\/]([^\\/]+)/.exec(String(input.cwd ?? ""))?.[1] ?? String(input.session_id ?? "");

/** A number in [0, 1) fixed by the key and the task, so each trial splits the same tasks independently. */
export const share = (key, task) => createHash("sha256").update(`${key}:${task}`).digest().readUInt32BE(0) / 2 ** 32;

/** Whether a task is in the On half of the testing trial home/trials/<name>.md. */
export const trialOn = (name, input) => share(`${name}.md`, taskOf(input)) < 0.5;
