import { expect, test } from "vitest";
import { decide, REASON, words } from "../tools/rule-growth.js";

test("words are counted across lines and runs of spaces", () => {
  expect(words("  One rule,\n\nthen   another.\n")).toBe(4);
});

test("rules that shrink or keep their size pass with any description", () => {
  expect(decide(500, 480, "")).toBeUndefined();
  expect(decide(500, 500, "")).toBeUndefined();
});

test("rules that grow pass only with a line giving the reason", () => {
  expect(decide(500, 512, "## Problem\nA rule was missing.")).toBe(
    `Rules and skills grew by 12 words (500 to 512). Reword, merge or move a line out, or add a line to the pull request description starting "${REASON}" saying why it could not stay the same size.`,
  );
  expect(decide(500, 512, `## Problem\r\n  ${REASON} a new hook needs its own line.`)).toBeUndefined();
  expect(decide(500, 512, `Not here: ${REASON} mid-line.`)).toBeDefined();
});
