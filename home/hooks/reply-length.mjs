// A Claude Code UserPromptSubmit hook, on trial (home/trials/reply-length.md): when the user types, it counts the
// words of the closing reply he just read and, past the limit, tells the agent so before it writes the next one.
// Two wordings of a word cap did not shorten replies. A Stop hook could not help either: the long reply is already on
// his screen when the turn stops, so a rewrite would only add a second reply under it.
import { closeSync, openSync, readSync, statSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { trialOn } from "./trial-group.mjs";

// About what fits on his screen without scrolling; the long-replies measure in agent-experiments uses the same limit.
const LIMIT = 150;
// A turn's entries sit at the end of the transcript, so only its tail is read, however long the session.
const TAIL = 4 * 1024 * 1024;

function tail(path) {
  const size = statSync(path).size;
  const start = Math.max(0, size - TAIL);
  const buffer = Buffer.alloc(size - start);
  const fd = openSync(path, "r");
  try {
    readSync(fd, buffer, 0, buffer.length, start);
  } finally {
    closeSync(fd);
  }
  const lines = buffer.toString("utf8").split("\n");
  if (start > 0) lines.shift();
  return lines.flatMap((line) => {
    try {
      return [JSON.parse(line)];
    } catch {
      return [];
    }
  });
}

// What the user typed, as agent-experiments' sessions.sql counts it: a human turn, or a message queued while the
// agent worked; text starting with < is a harness note or another agent.
function typed(entry) {
  if (entry.isSidechain || entry.isMeta || entry.isCompactSummary) return false;
  if (entry.type === "attachment" && entry.attachment?.type === "queued_command") {
    return entry.attachment.commandMode === "prompt" && !String(entry.attachment.prompt ?? "").startsWith("<");
  }
  return entry.type === "user" && entry.turnOrigin === "human";
}

// Calls that show or track rather than work, often made after the reply: they do not end it.
const SHOWING = /wrap_up$|update_plan$|SendUserFile$|show_widget$|^Artifact$/;

/** Words the user read at the end of the last finished turn: its text after its last working tool call. */
export function closingWords(entries) {
  let end = entries.findLastIndex((e) => e.type === "assistant" && !e.isSidechain);
  if (end < 0) return 0;
  const start = entries.findLastIndex((e, i) => i < end && typed(e));
  const blocks = entries
    .slice(start + 1, end + 1)
    .filter((e) => e.type === "assistant" && !e.isSidechain)
    .flatMap((e) => (Array.isArray(e.message?.content) ? e.message.content : []));
  end = blocks.findLastIndex((b) => b.type === "tool_use" && !SHOWING.test(String(b.name)));
  return blocks
    .slice(end + 1)
    .filter((b) => b.type === "text")
    .reduce((sum, b) => sum + String(b.text).split(/\s+/).filter(Boolean).length, 0);
}

// Run as the hook, not when a test imports it.
if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  try {
    const input = JSON.parse(await new Response(process.stdin).text());
    if (trialOn("reply-length", input) && input.transcript_path) {
      const words = closingWords(tail(input.transcript_path));
      if (words > LIMIT) {
        const additionalContext = `Your last closing reply to the user was ${words} words, over the ${LIMIT} he reads without scrolling. Keep this one under ${LIMIT} words: leave out what he did not ask for.`;
        console.log(JSON.stringify({ hookSpecificOutput: { hookEventName: "UserPromptSubmit", additionalContext } }));
      }
    }
  } catch {
    // A failure here must never block what the user typed.
  }
}
