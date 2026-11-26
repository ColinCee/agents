import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { expect, test } from "vitest";
// @ts-expect-error: a plain .mjs hook, as installed, with no types
import { closingWords } from "../home/hooks/reply-length.mjs";

const said = (text: string) => ({ type: "user", turnOrigin: "human", message: { content: text } });
const wrote = (...content: object[]) => ({ type: "assistant", message: { content } });
const text = (words: number) => ({ type: "text", text: Array(words).fill("word").join(" ") });
const call = (name: string) => ({ type: "tool_use", name, input: {} });

test("counts the reply after the turn's last working call, past tool results and calls that only show or track", () => {
  const turn = [
    said("old question"),
    wrote(text(400)),
    said("fix it"),
    wrote(text(30)),
    wrote(call("Bash")),
    { type: "user", message: { content: [{ type: "tool_result", content: "ok" }] } },
    wrote(text(120)),
    wrote(call("mcp__ccd_turn__update_plan")),
    wrote(text(60)),
    wrote(call("mcp__ccd_session__wrap_up")),
  ];
  expect(closingWords(turn)).toBe(180);
  expect(closingWords([...turn.slice(0, -1), wrote(call("Bash")), wrote(text(10))])).toBe(10);
  expect(closingWords([said("hi")])).toBe(0);
});

test("tells an agent in the trial's On half that its last reply ran long, and says nothing otherwise", () => {
  const dir = mkdtempSync(join(tmpdir(), "reply-length-"));
  const transcript = join(dir, "t.jsonl");
  const run = (words: number, session: string) => {
    writeFileSync(transcript, [said("q"), wrote(text(words))].map((e) => JSON.stringify(e)).join("\n"));
    const input = { hook_event_name: "UserPromptSubmit", session_id: session, cwd: dir, transcript_path: transcript };
    return spawnSync("node", [resolve(import.meta.dirname, "..", "home", "hooks", "reply-length.mjs")], {
      input: JSON.stringify(input),
      encoding: "utf8",
    }).stdout;
  };
  expect(JSON.parse(run(200, "s1")).hookSpecificOutput.additionalContext).toContain("200 words");
  expect(run(140, "s1")).toBe("");
});
