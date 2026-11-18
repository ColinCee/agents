import { expect, test } from "vitest";
import { decide, NOT_ON_TRIAL, REASON, untried, words } from "../tools/rule-changes.js";

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
  expect(decide(500, 512, `- ${REASON} a bullet works.`)).toBeUndefined();
  expect(decide(500, 512, `*  ${REASON} so does this one.`)).toBeUndefined();
  expect(decide(500, 512, `Not here: ${REASON} mid-line.`)).toBeDefined();
});

const core = "# Rules\n\n- Keep replies short.\n- Commit only your paths.\n";
const trial = (state: string, on: string) =>
  `---\nstatus: ${state}\nmeasures: m\nstarted: 2026-11-16\n---\n## Off\n\n## On\n${on}\n`;

test("deleting or moving a rule line needs no trial", () => {
  expect(
    untried({ "home/core.md": core }, { "home/core.md": "# Rules\n\n- Keep replies short.\n" }, ""),
  ).toBeUndefined();
  expect(
    untried(
      { "home/core.md": core, "home/present.md": "" },
      { "home/core.md": "# Rules\n\n- Keep replies short.\n", "home/present.md": "- Commit only your paths.\n" },
      "",
    ),
  ).toBeUndefined();
});

test("a new or reworded rule line fails unless it moves into a trial", () => {
  const reworded = { "home/core.md": "# Rules\n\n- Keep replies under 75 words.\n- Commit only your paths.\n" };
  const onTrial = trial("testing", "- Keep replies under 75 words.");
  expect(untried({ "home/core.md": core }, reworded, "")).toContain("new or reworded lines in home/core.md");
  expect(untried({ "home/core.md": core }, { ...reworded, "home/trials/short.md": onTrial }, "")).toContain(
    "new or reworded lines in home/core.md",
  );
  expect(
    untried(
      { "home/core.md": core },
      { "home/core.md": "- Commit only your paths.\n", "home/trials/short.md": onTrial },
      "",
    ),
  ).toBeUndefined();
  expect(
    untried({ "home/core.md": core }, reworded, `- ${NOT_ON_TRIAL} it guards money; a hook enforces it.`),
  ).toBeUndefined();
});

test("a testing trial's line cannot leave for the rules untested, and a trial needs a measure", () => {
  const before = {
    "home/core.md": "- Commit only your paths.\n",
    "home/trials/short.md": trial("testing", "- Keep replies short."),
  };
  expect(untried(before, { "home/core.md": "- Commit only your paths.\n- Keep replies short.\n" }, "")).toContain(
    "new or reworded lines",
  );
  expect(untried({}, { "home/trials/y.md": "---\nstatus: testing\n---\n## Off\n\n## On\nA line.\n" }, "")).toContain(
    "no measure: home/trials/y.md",
  );
});

test("a trial that skips testing fails", () => {
  expect(untried({}, { "home/trials/x.md": trial("settled", "A line.") }, "")).toContain(
    "settled without testing: home/trials/x.md",
  );
  const settled = { "home/trials/x.md": trial("settled", "A line.") };
  expect(untried(settled, { "home/trials/x.md": trial("settled", "A reworded line.") }, "")).toContain(
    "settled without testing",
  );
  expect(untried({ "home/trials/x.md": trial("testing", "A line.") }, settled, "")).toBeUndefined();
});

test("an existing rule line moved into a settled trial is not new", () => {
  expect(
    untried(
      { "home/core.md": core },
      {
        "home/core.md": "# Rules\n\n- Keep replies short.\n",
        "home/trials/c.md": trial("settled", "- Commit only your paths."),
      },
      "",
    ),
  ).toBeUndefined();
});

test("a line split out of a longer one is not new, so only the reworded sentences go on trial", () => {
  const long = "- Keep replies short. Use plain words. Commit only your paths.\n";
  const split = "- Keep replies short. Commit only your paths.\n";
  expect(untried({ "home/core.md": long }, { "home/core.md": split }, "")).toBeUndefined();
  expect(
    untried({ "home/core.md": long }, { "home/core.md": "- Keep replies short. Use short words.\n" }, ""),
  ).toContain("new or reworded lines in home/core.md");
});
