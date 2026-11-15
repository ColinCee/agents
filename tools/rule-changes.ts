// CI step on a pull request. A change that adds words to the every-turn rules or the skills must say why in its
// description, so rules do not grow one fix at a time. A new or reworded line in the author's own rules must go on
// trial, so its effect is measured rather than guessed (docs/keep-going.md).
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

// Trials count too, so a rule cannot leave the count by moving into one.
const RULES = /^(home\/(trials\/)?[^/]+\.md|skills\/[^/]+\/SKILL\.md)$/;
const HOME = /^home\/[^/]+\.md$/;
const TRIAL = /^home\/trials\/[^/]+\.md$/;
export const REASON = "Why it grows:";
export const NOT_ON_TRIAL = "Not on trial:";

export const words = (text: string) => text.split(/\s+/).filter(Boolean).length;

const hasLine = (body: string, start: string) =>
  body.split(/\r?\n/).some((line) =>
    line
      .trim()
      .replace(/^[-*]\s+/, "")
      .startsWith(start),
  );

/** The failure message, or nothing when the size held or the description gives the reason. */
export function decide(before: number, after: number, body: string): string | undefined {
  if (after <= before) return undefined;
  if (hasLine(body, REASON)) return undefined;
  return `Rules and skills grew by ${after - before} words (${before} to ${after}). Reword, merge or move a line out, or add a line to the pull request description starting "${REASON}" saying why it could not stay the same size.`;
}

export type Files = Record<string, string>;

const lines = (text: string) =>
  text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
const status = (trial: string) => /^status:\s*(\S+)/m.exec(trial)?.[1];
const onText = (trial: string) => trial.split(/^## On\s*$/m)[1]?.trim() ?? "";

/**
 * The failure message, or nothing when every new or reworded rule line is on trial. A line moved between rule files
 * or out of a trial is not new, nor is one moved into a settled trial; deleting a line needs no trial. A trial that
 * skips testing (a new line made settled, or a settled line reworded) fails too. A rule that may not go on trial,
 * such as one guarding money, says why in the description.
 */
export function untried(before: Files, after: Files, body: string): string | undefined {
  if (hasLine(body, NOT_ON_TRIAL)) return undefined;
  const old = new Set(Object.values(before).flatMap(lines));
  const added = Object.entries(after)
    .filter(([path, text]) => HOME.test(path) && lines(text).some((line) => !old.has(line) && !line.startsWith("#")))
    .map(([path]) => path);
  const trials = Object.entries(after).filter(([path]) => TRIAL.test(path));
  const changed = (path: string, text: string) => before[path] === undefined || onText(text) !== onText(before[path]);
  const testing = trials.some(([path, text]) => status(text) === "testing" && changed(path, text));
  const skipped = trials
    .filter(
      ([path, text]) =>
        status(text) === "settled" && changed(path, text) && !lines(onText(text)).every((line) => old.has(line)),
    )
    .map(([path]) => path);
  const problems = [
    ...(added.length > 0 && !testing ? [`new or reworded lines in ${added.join(", ")}`] : []),
    ...(skipped.length > 0 ? [`settled without testing: ${skipped.join(", ")}`] : []),
  ];
  if (problems.length === 0) return undefined;
  return `A rule change must go on trial (docs/keep-going.md, Testing a rule): ${problems.join("; ")}. Move the line into a home/trials file with status: testing and a measure, or add a line to the pull request description starting "${NOT_ON_TRIAL}" saying why it cannot be.`;
}

const git = (...args: string[]) => execFileSync("git", args, { encoding: "utf8", windowsHide: true });

function files(ref: string): Files {
  return Object.fromEntries(
    git("ls-tree", "-r", "--name-only", ref, "--", "home", "skills")
      .split("\n")
      .filter((path) => RULES.test(path))
      .map((path) => [path, git("show", `${ref}:${path}`)]),
  );
}

const ruleWords = (all: Files) => Object.values(all).reduce((sum, text) => sum + words(text), 0);
const home = (all: Files): Files =>
  Object.fromEntries(Object.entries(all).filter(([path]) => path.startsWith("home/")));

function main(): number {
  const event = JSON.parse(readFileSync(process.env.GITHUB_EVENT_PATH ?? "", "utf8"));
  const pr = event.pull_request;
  if (!pr) return 0;
  // CI checks out the pull request merged into the base branch; its first parent is the base as merged, which the
  // event's base.sha can lag behind.
  const before = files("HEAD^1");
  const after = files("HEAD");
  const failures = [
    decide(ruleWords(before), ruleWords(after), pr.body ?? ""),
    untried(home(before), home(after), pr.body ?? ""),
  ].filter(Boolean);
  for (const failure of failures) console.error(failure);
  return failures.length > 0 ? 1 : 0;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) process.exitCode = main();
