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
const sentences = (line: string) =>
  line
    .replace(/^[-*]\s+/, "")
    .split(/(?<=[.!?])\s+(?=[A-Z`"(])/)
    .filter(Boolean);
const status = (trial: string) => /^status:\s*(\S+)/m.exec(trial)?.[1]?.toLowerCase();
const section = (trial: string, name: string) =>
  trial
    .split(new RegExp(`^## ${name}\\s*$`, "m"))[1]
    ?.split(/^## /m)[0]
    ?.trim() ?? "";
const measured = (trial: string) => /^measures:\s*\S/m.test(trial);

/**
 * The failure message, or nothing when every new or reworded rule line is on trial. While on trial a line lives only
 * in its trial file, so a line new to home/*.md fails, unless each of its sentences was already a rule elsewhere: moved between
 * files, out of a settled trial, or restored from a trial's Off; a testing trial's On line does not count, since
 * moving it out would settle it untested. A testing trial needs a measure, and a settled one may hold only lines that
 * were already tested. Deleting a line needs no trial. A rule that may not go on trial, such as one guarding money,
 * says why in the description.
 */
export function untried(before: Files, after: Files, body: string): string | undefined {
  if (hasLine(body, NOT_ON_TRIAL)) return undefined;
  const tested = Object.entries(before).flatMap(([path, text]) =>
    !TRIAL.test(path)
      ? lines(text)
      : status(text) === "settled"
        ? lines(section(text, "On"))
        : lines(section(text, "Off")),
  );
  // Sentences, not lines: a trial then holds only the sentences that change, not a whole long line twice.
  const old = new Set(tested.flatMap(sentences));
  const isNew = (line: string) => !line.startsWith("#") && !sentences(line).every((s) => old.has(s));
  const trials = Object.entries(after).filter(([path]) => TRIAL.test(path));
  const problems = [
    ...Object.entries(after)
      .filter(([path, text]) => HOME.test(path) && lines(text).some(isNew))
      .map(([path]) => `new or reworded lines in ${path}`),
    ...trials
      .filter(([, text]) => status(text) === "settled" && lines(section(text, "On")).some(isNew))
      .filter(
        ([path, text]) =>
          section(text, "On") !== section(before[path] ?? "", "On") || status(before[path] ?? "") === "settled",
      )
      .map(([path]) => `settled without testing: ${path}`),
    ...trials
      .filter(([, text]) => status(text) !== "settled" && !measured(text))
      .map(([path]) => `no measure: ${path}`),
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
