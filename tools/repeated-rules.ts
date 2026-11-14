// CI step: a project's AGENTS.md must not repeat a sentence of home/core.md or home/desktop.md, which every agent
// already reads. One home per rule: the project keeps only what is true of it alone.
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const HOME_RULES = ["core.md", "desktop.md"].map((f) => join(ROOT, "home", f));
// The author's projects with an AGENTS.md, besides this repository's own.
const PROJECTS: Record<string, string> = {
  homelab: "https://raw.githubusercontent.com/ColinCee/homelab/main/AGENTS.md",
};
// Shorter runs ("Checks: `npm run check`.") recur by chance and say too little to count as a copied rule.
const MIN_WORDS = 6;

/** Each sentence of a Markdown text, lower-cased with its marks gone, keeping those of at least MIN_WORDS words. */
export function sentences(text: string): Set<string> {
  const found = new Set<string>();
  for (const piece of text.split(/(?<=[.!?;])\s+|\n\s*\n|\n\s*[-*|]\s*|\|/)) {
    const words = piece
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s/._-]/gu, " ")
      .replace(/[._-]+(\s|$)/g, " ")
      .split(/\s+/)
      .filter(Boolean);
    if (words.length >= MIN_WORDS) found.add(words.join(" "));
  }
  return found;
}

/** The sentences of `project` that the home rules already hold. */
export function repeated(home: string, project: string): string[] {
  const held = sentences(home);
  return [...sentences(project)].filter((s) => held.has(s));
}

async function main(): Promise<number> {
  const home = HOME_RULES.map((p) => readFileSync(p, "utf8")).join("\n\n");
  const projects: [string, string][] = [["agents", readFileSync(join(ROOT, "AGENTS.md"), "utf8")]];
  for (const [name, url] of Object.entries(PROJECTS)) {
    const res = await fetch(url, { signal: AbortSignal.timeout(15_000) });
    if (!res.ok) {
      console.error(`${name}: ${url} answered ${res.status}`);
      return 1;
    }
    projects.push([name, await res.text()]);
  }
  let failed = 0;
  for (const [name, text] of projects) {
    for (const s of repeated(home, text)) {
      console.error(`${name}'s AGENTS.md repeats home/core.md or home/desktop.md: "${s}". Keep it in one place.`);
      failed = 1;
    }
  }
  return failed;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) process.exitCode = await main();
