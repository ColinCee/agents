// CI step: a pull request that adds words to the every-turn rules or the skills must say why in its description, as
// the shipping-prs skill asks, so rules do not grow one fix at a time.
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

// Trials count too, so a rule cannot leave the count by moving into one.
const RULES = /^(home\/(trials\/)?[^/]+\.md|skills\/[^/]+\/SKILL\.md)$/;
export const REASON = "Why it grows:";

export const words = (text: string) => text.split(/\s+/).filter(Boolean).length;

/** The failure message, or nothing when the size held or the description gives the reason. */
export function decide(before: number, after: number, body: string): string | undefined {
  if (after <= before) return undefined;
  if (
    body.split(/\r?\n/).some((line) =>
      line
        .trim()
        .replace(/^[-*]\s+/, "")
        .startsWith(REASON),
    )
  )
    return undefined;
  return `Rules and skills grew by ${after - before} words (${before} to ${after}). Reword, merge or move a line out, or add a line to the pull request description starting "${REASON}" saying why it could not stay the same size.`;
}

function ruleWords(ref: string): number {
  const git = (...args: string[]) => execFileSync("git", args, { encoding: "utf8", windowsHide: true });
  return git("ls-tree", "-r", "--name-only", ref, "--", "home", "skills")
    .split("\n")
    .filter((path) => RULES.test(path))
    .reduce((sum, path) => sum + words(git("show", `${ref}:${path}`)), 0);
}

function main(): number {
  const event = JSON.parse(readFileSync(process.env.GITHUB_EVENT_PATH ?? "", "utf8"));
  const pr = event.pull_request;
  if (!pr) return 0;
  // CI checks out the pull request merged into the base branch; its first parent is the base as merged, which the
  // event's base.sha can lag behind.
  const failure = decide(ruleWords("HEAD^1"), ruleWords("HEAD"), pr.body ?? "");
  if (!failure) return 0;
  console.error(failure);
  return 1;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) process.exitCode = main();
