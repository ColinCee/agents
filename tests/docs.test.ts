import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, posix } from "node:path";
import { describe, expect, test } from "vitest";

// Docs go stale silently: this fails when one names a file, heading or task that is gone, and when docs/ grows.
// lychee (--offline --include-fragments) finds the same broken links and anchors, but `npm ci` does not install it;
// remark-validate-links does only that part too, and no tool checks the rest.

// Set at today's count; lower it when docs/ shrinks, never raise it.
const DOCS_WORD_CAP = 4_989;

type Repo = { files: Map<string, string>; tracked: Set<string>; tasks: Set<string> };

const isDoc = (path: string) => path === "README.md" || path === "AGENTS.md" || /^docs\/.*\.md$/.test(path);
const isCode = (path: string) => /\.(ts|mts|mjs|js)$/.test(path);

function withoutFences(markdown: string): string {
  return markdown.replace(/^(```|~~~)[\s\S]*?^\1/gm, "");
}

function firsts(text: string, pattern: RegExp): string[] {
  return [...text.matchAll(pattern)].map((match) => match[1] ?? "");
}

/** GitHub's heading anchors: lower case, punctuation dropped, spaces to hyphens, repeats numbered. */
function anchors(markdown: string): Set<string> {
  const seen = new Map<string, number>();
  const out = new Set<string>();
  for (const heading of firsts(withoutFences(markdown), /^#{1,6}\s+(.+?)\s*#*$/gm)) {
    const base = heading
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s_-]/gu, "")
      .replace(/\s/g, "-");
    const n = seen.get(base) ?? 0;
    seen.set(base, n + 1);
    out.add(n === 0 ? base : `${base}-${n}`);
  }
  return out;
}

function exists(repo: Repo, path: string): boolean {
  const clean = path.replace(/\/$/, "");
  if (clean === "" || clean === ".") return true;
  const pattern = clean.includes("*")
    ? new RegExp(`^${clean.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, "[^/]*")}(/|$)`)
    : null;
  return [...repo.tracked].some((file) =>
    pattern ? pattern.test(file) : file === clean || file.startsWith(`${clean}/`),
  );
}

/** A backticked path into this repository: one starting at a top folder of it. A bare name (`SKILL.md`), another
 * repository's path (`measures/`) or a placeholder (`<name>`, `NNNN`) names something elsewhere. */
function looksLikePath(repo: Repo, code: string): boolean {
  if (/[\s<>]|NNNN|\.\.\.|:\/\//.test(code) || !code.includes("/")) return false;
  const top = code.split("/")[0];
  return [...repo.tracked].some((file) => file.startsWith(`${top}/`));
}

function docProblems(repo: Repo, path: string, text: string): string[] {
  const found: string[] = [];
  const prose = withoutFences(text);
  for (const target of firsts(prose, /\]\(([^)\s]+)\)/g)) {
    if (/^[a-z]+:/i.test(target)) continue;
    const [file = "", anchor] = target.split("#");
    const resolved = file === "" ? path : posix.normalize(posix.join(dirname(path), decodeURI(file)));
    if (!exists(repo, resolved)) found.push(`${path}: link to ${target}, which is gone`);
    else if (anchor && resolved.endsWith(".md") && !anchors(repo.files.get(resolved) ?? "").has(anchor))
      found.push(`${path}: link to ${target}, a heading that is gone`);
  }
  for (const code of firsts(prose, /`([^`\n]+)`/g))
    if (looksLikePath(repo, code) && !exists(repo, code)) found.push(`${path}: \`${code}\` is gone`);
  for (const task of firsts(text, /npm run ([\w:-]+)/g))
    if (!repo.tasks.has(task)) found.push(`${path}: npm run ${task}, a task that is gone`);
  return found;
}

/** Docs and decision records named in a doc's text or in a code file's comments (not its strings). A record is named
 * by its area, never a number, so deleting one renumbers nothing and leaves no reference meaning another. */
function namedRecords(repo: Repo, path: string, text: string): string[] {
  const found: string[] = [];
  const where = isDoc(path) ? [text] : (text.match(/\/\/[^\n]*|\/\*[\s\S]*?\*\//g) ?? []);
  for (const part of where) {
    if (!isDoc(path))
      for (const [doc] of part.matchAll(/\bdocs\/[\w./-]+\.md\b/g))
        if (!repo.tracked.has(doc)) found.push(`${path}: names ${doc}, which is gone`);
    for (const [name] of part.matchAll(/\bADR[ -]?\d+\b/g))
      found.push(`${path}: names ${name}; name a decision record by its area, docs/adr/<area>.md`);
  }
  return found;
}

function problems(repo: Repo): string[] {
  const numbered = [...repo.tracked].filter((file) => /^docs\/adr\/\d/.test(file));
  return [
    ...numbered.map((file) => `${file}: a decision record named by number; name it docs/adr/<area>.md`),
    ...[...repo.files].flatMap(([path, text]) => [
      ...(isDoc(path) ? docProblems(repo, path, text) : []),
      ...namedRecords(repo, path, text),
    ]),
  ];
}

function docsWords(repo: Repo): number {
  let words = 0;
  for (const [path, text] of repo.files)
    if (path.startsWith("docs/") && path.endsWith(".md")) words += text.split(/\s+/).filter(Boolean).length;
  return words;
}

function thisRepo(): Repo {
  const root = `${import.meta.dirname}/..`;
  // git's list, not the disk: it is case-exact on every OS and leaves out other worktrees and node_modules.
  const listed = spawnSync("git", ["ls-files", "-z"], { cwd: root, encoding: "utf8", windowsHide: true });
  const tracked = new Set(listed.stdout.split("\0").filter(Boolean));
  const files = new Map<string, string>();
  for (const path of tracked)
    if ((isDoc(path) || isCode(path)) && path !== "tests/docs.test.ts")
      files.set(path, readFileSync(`${root}/${path}`, "utf8"));
  const tasks = new Set(Object.keys(JSON.parse(readFileSync(`${root}/package.json`, "utf8")).scripts));
  return { files, tracked, tasks };
}

describe("this repository's docs", () => {
  const repo = thisRepo();

  test("name only files, headings and tasks that exist", () => {
    expect(problems(repo)).toEqual([]);
  });

  test("stay under their word cap", () => {
    expect(docsWords(repo)).toBeLessThanOrEqual(DOCS_WORD_CAP);
  });
});

describe("the check fails on", () => {
  const repo = (files: Record<string, string>): Repo => ({
    files: new Map(Object.entries(files)),
    tracked: new Set([...Object.keys(files), "src/app.ts", "docs/adr/run-job.md"]),
    tasks: new Set(["check"]),
  });

  test("a link to a file that is gone", () => {
    expect(problems(repo({ "docs/a.md": "[x](gone.md) [y](../src/app.ts)" }))).toEqual([
      "docs/a.md: link to gone.md, which is gone",
    ]);
  });

  test("an anchor, in another doc or its own, that is gone", () => {
    const a = "# Top\n[x](b.md#old) [y](b.md#new-part) [z](#top) [w](#gone)";
    expect(problems(repo({ "docs/a.md": a, "docs/b.md": "## New part" }))).toEqual([
      "docs/a.md: link to b.md#old, a heading that is gone",
      "docs/a.md: link to #gone, a heading that is gone",
    ]);
  });

  test("a backticked path that is gone, but not a placeholder or a command", () => {
    const doc =
      "`src/app.ts` `src/gone.ts` `skills/<name>/` `docs/adr/NNNN-area.md` `npm run check` `src/*.ts` `evals/`";
    expect(problems(repo({ "README.md": doc }))).toEqual(["README.md: `src/gone.ts` is gone"]);
  });

  test("an npm task that is gone", () => {
    expect(problems(repo({ "AGENTS.md": "Run `npm run check`, then npm run gone." }))).toEqual([
      "AGENTS.md: npm run gone, a task that is gone",
    ]);
  });

  test("a code comment naming a doc that is gone, but not a string", () => {
    const code = '// see docs/gone.md and docs/adr/run-job.md\nconst s = "docs/also-gone.md";';
    expect(problems(repo({ "src/app.ts": code }))).toEqual(["src/app.ts: names docs/gone.md, which is gone"]);
  });

  test("a decision record named or referred to by number", () => {
    const files = { "docs/adr/0002-x.md": "# X", "README.md": "See ADR 0001.", "src/app.ts": "/* ADR-3 */" };
    expect(problems(repo(files))).toEqual([
      "docs/adr/0002-x.md: a decision record named by number; name it docs/adr/<area>.md",
      "README.md: names ADR 0001; name a decision record by its area, docs/adr/<area>.md",
      "src/app.ts: names ADR-3; name a decision record by its area, docs/adr/<area>.md",
    ]);
  });

  test("words counted in docs/ only", () => {
    expect(docsWords(repo({ "docs/a.md": "one two\r\nthree", "README.md": "not counted" }))).toBe(3);
  });
});
