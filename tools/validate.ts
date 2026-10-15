// Check every skill in this repository against the rules in AGENTS.md. Reports only: it changes nothing.
import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";

const HELP = `Check every skill in this repository against the rules in AGENTS.md. Reports only.

  npm run validate -- [--root DIR] [--json]

--root   the repository to check (default: the one this file is in)
--json   print JSON instead of text

Exit codes: 0 no errors (warnings allowed), 1 errors found, 2 bad arguments.`;

// The limits below are the Agent Skills specification's: https://agentskills.io/specification
const NAME_MAX = 64;
const DESCRIPTION_MAX = 1024;
const DESCRIPTION_AIM = 250; // longer ones were found to be picked less reliably (arXiv 2608.08453)
const COMPATIBILITY_MAX = 500;
const BODY_LINES_MAX = 500;
// disable-model-invocation is not in the specification, but it is the one way to make a skill load only when the
// user names it: Claude Code reads it, and an agent that does not know it is expected to skip it.
const FIELDS = new Set([
  "name",
  "description",
  "license",
  "compatibility",
  "metadata",
  "allowed-tools",
  "disable-model-invocation",
]);
const NODE_FLOOR = 22; // the oldest Node release line still given security fixes
const MIN_EVALS = 3; // the fewest tasks that show a pattern and not one lucky run
const MIN_TRIGGERS_EACH = 8; // about twenty queries in all, half each way
const HELP_TIMEOUT_MS = 30_000; // --help only prints, so longer than this means it is waiting for input
const CONTENTS_OVER = 100; // lines; an agent may read only the top of a longer reference file

const NAME = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const RESERVED = ["claude", "anthropic"]; // refused in a name by Anthropic's own skill uploads
const VAGUE = new Set(["helper", "helpers", "utils", "tools", "misc", "stuff"]);
const FIRST_OR_SECOND_PERSON = /\b(I can|I will|I help|You can|You should)\b/;
const USE_WHEN = /\buse (this skill |it )?when\b/i;
const LINK = /\]\(([^)\s#]+)/g;
const NOT_FOR_THE_BODY =
  /^#+\s*(changelog|installation|install|license|licence|todo)\b|\b(pip|npm|brew|apt(-get)?) install\b|\bTODO\b/im;
const BACKSLASH_PATH = /\b(scripts|references|assets|evals)\\\w/;
const OWN_PATH = /[A-Za-z]:[\\/]+Users[\\/]|\/Users\/\w|\/home\/\w/;
const AGENT_TOOLS =
  /\b(TodoWrite|AskUserQuestion|WebFetch|WebSearch|NotebookEdit|mcp__\w+|(Bash|Read|Edit|Write|Task|Grep|Glob) tool)\b/;
const NODE_VERSION = /Node (\d+)/;
const IMPORTS = /(?:^|\n)\s*(?:import|export)[^"'`;]*?from\s*["']([^"']+)["']|\bimport\(\s*["']([^"']+)["']\s*\)/g;
const CACHES = new Set(["__pycache__", ".ruff_cache", ".pytest_cache", "node_modules"]);

type Level = "error" | "warning";
interface Found {
  level: Level;
  where: string;
  what: string;
}
type Fields = Record<string, string | Record<string, string>>;

class Report {
  found: Found[] = [];
  error(where: string, what: string): void {
    this.found.push({ level: "error", where, what });
  }
  warn(where: string, what: string): void {
    this.found.push({ level: "warning", where, what });
  }
  count(level: Level): number {
    return this.found.filter((f) => f.level === level).length;
  }
}

const read = (path: string): string => readFileSync(path, "utf8");
const posix = (path: string): string => path.split(sep).join("/");
const isDir = (path: string): boolean => existsSync(path) && statSync(path).isDirectory();

/** Every file under a folder, skipping caches, in a stable order. */
function files(folder: string): string[] {
  if (!isDir(folder)) return [];
  const out: string[] = [];
  for (const name of readdirSync(folder).sort()) {
    if (CACHES.has(name)) continue;
    const path = join(folder, name);
    if (isDir(path)) out.push(...files(path));
    else out.push(path);
  }
  return out;
}

/** The fields, the body and what was wrong. Reads one-line values and one level of nesting, as the rules ask. */
function frontmatter(text: string): { fields: Fields; body: string; wrong: string[] } {
  const lines = text.split(/\r?\n/);
  if (lines[0]?.trim() !== "---") return { fields: {}, body: text, wrong: ["SKILL.md does not start with a --- line"] };
  const end = lines.indexOf("---", 1);
  if (end < 0) return { fields: {}, body: text, wrong: ["the frontmatter has no closing --- line"] };
  const fields: Fields = {};
  const wrong: string[] = [];
  let parent: string | null = null;
  for (const line of lines.slice(1, end)) {
    if (!line.trim() || line.trimStart().startsWith("#")) continue;
    const colon = line.indexOf(":");
    if (colon < 0) {
      wrong.push(`frontmatter line is not \`key: value\`: ${JSON.stringify(line.trim())}`);
      continue;
    }
    const key = line.slice(0, colon).trim();
    let value = line.slice(colon + 1).trim();
    if (value.startsWith("|") || value.startsWith(">")) {
      wrong.push(`\`${key}\` is spread over lines; put the value on one line`);
      continue;
    }
    const quoted = value.length > 1 && value[0] === value.at(-1) && (value[0] === '"' || value[0] === "'");
    // A YAML parser reads `a: b` inside an unquoted value as a second mapping and refuses the file: the skills
    // installer skipped four of five skills for this. Our own reading is looser, so check for it here.
    if (!quoted && (/:\s/.test(value) || / #/.test(value) || /^[[{&*!%@`]/.test(value)))
      wrong.push(`\`${key}\` holds ": ", " #" or starts with a YAML symbol; a YAML parser will refuse it. Rephrase it`);
    if (quoted) value = value.slice(1, -1);
    if (line.startsWith(" ") || line.startsWith("\t")) {
      const holder = parent === null ? undefined : fields[parent];
      if (typeof holder === "object") holder[key] = value;
      else wrong.push(`\`${key}\` is indented but is under no field`);
    } else if (value) {
      fields[key] = value;
      parent = null;
    } else {
      fields[key] = {};
      parent = key;
    }
  }
  return { fields, body: lines.slice(end + 1).join("\n"), wrong };
}

function checkFrontmatter(skill: string, fields: Fields, report: Report): void {
  const name0 = skill.split(/[\\/]/).at(-1) ?? "";
  const where = `${name0}/SKILL.md`;
  for (const key of Object.keys(fields).sort())
    if (!FIELDS.has(key))
      report.error(where, `\`${key}\` is not a field of the specification; allowed: ${[...FIELDS].sort().join(", ")}`);

  const name = fields.name;
  if (typeof name !== "string" || !name) report.error(where, "`name` is missing");
  else {
    if (!NAME.test(name) || name.length > NAME_MAX)
      report.error(
        where,
        `\`name\` must be lowercase letters, digits and single hyphens, ${NAME_MAX} characters at most; got ${JSON.stringify(name)}`,
      );
    if (name !== name0)
      report.error(where, `\`name\` is "${name}" but the folder is "${name0}"; they must be the same`);
    if (RESERVED.some((w) => name.includes(w)))
      report.error(where, `\`name\` must not contain ${RESERVED.join(" or ")}`);
    if (name.split("-").some((w) => VAGUE.has(w)))
      report.warn(where, `\`name\` "${name}" does not say what the skill does`);
  }

  const description = fields.description;
  if (typeof description !== "string" || !description) report.error(where, "`description` is missing");
  else {
    if (description.length > DESCRIPTION_MAX)
      report.error(where, `\`description\` is ${description.length} characters; the limit is ${DESCRIPTION_MAX}`);
    if (/[<>]/.test(description)) report.error(where, "`description` must not contain < or >");
    if (description.length > DESCRIPTION_AIM)
      report.warn(where, `\`description\` is ${description.length} characters; aim for ${DESCRIPTION_AIM} or fewer`);
    if (!USE_WHEN.test(description))
      report.error(where, "`description` does not say when to use the skill; add a `Use when ...` sentence");
    if (FIRST_OR_SECOND_PERSON.test(description))
      report.error(where, "`description` must be in the third person (`Tidies ...`, not `I can ...` or `You can ...`)");
  }
  if (fields.license !== "MIT") report.error(where, "`license` must be MIT");
  const compatibility = fields.compatibility;
  if (typeof compatibility === "string" && compatibility.length > COMPATIBILITY_MAX)
    report.error(where, `\`compatibility\` is ${compatibility.length} characters; the limit is ${COMPATIBILITY_MAX}`);
  if ("metadata" in fields && typeof fields.metadata !== "object")
    report.error(where, "`metadata` must be a map of keys to values");
  const invocation = fields["disable-model-invocation"];
  if (invocation !== undefined && invocation !== "true")
    report.error(where, "`disable-model-invocation` is only ever `true`, on a command; otherwise leave it out");
}

function checkText(skill: string, body: string, report: Report): void {
  const name = skill.split(/[\\/]/).at(-1) ?? "";
  const where = `${name}/SKILL.md`;
  const lines = body.split("\n").length;
  if (lines > BODY_LINES_MAX)
    report.error(where, `the body is ${lines} lines; the limit is ${BODY_LINES_MAX}. Move detail to references/`);
  const heading = /^#\s+(.+)$/m.exec(body)?.[1];
  if (heading && heading.trim().toLowerCase().replaceAll(" ", "-") === name)
    report.error(where, "the first heading repeats the name; start with what to do");
  const banned = NOT_FOR_THE_BODY.exec(body);
  if (banned)
    report.error(
      where,
      `holds install steps, a changelog, licence text or a to-do note (${JSON.stringify(banned[0].trim())}); take it out`,
    );
  for (const [, target] of body.matchAll(LINK)) {
    if (!target || target.includes("://") || target.startsWith("mailto:")) continue;
    if (!existsSync(join(skill, target))) report.error(where, `links to ${target}, which is not in the skill folder`);
  }
  for (const folder of ["scripts", "references", "assets"])
    for (const path of files(join(skill, folder))) {
      const rel = posix(relative(skill, path));
      if (!body.includes(rel)) report.error(where, `does not name ${rel}; say what it is for and when to use it`);
    }
  for (const path of files(skill)) {
    const rel = posix(relative(skill, path));
    if (!/\.(md|mjs)$/.test(path) || rel.startsWith("evals/")) continue;
    const text = read(path);
    const at = `${name}/${rel}`;
    if (BACKSLASH_PATH.test(text))
      report.error(at, "a path uses a backslash; use forward slashes, which work on every system");
    const own = OWN_PATH.exec(text);
    if (own) report.error(at, `holds a path on one person's machine (${own[0]}...); take it as an argument`);
    if (path.endsWith(".md")) {
      const tool = AGENT_TOOLS.exec(text);
      if (tool) report.error(at, `names one agent's tool (${tool[0]}); say what to do, not which tool does it`);
      if (rel.startsWith("references/") && text.split("\n").length > CONTENTS_OVER && !text.includes("## Contents"))
        report.warn(at, `is over ${CONTENTS_OVER} lines with no \`## Contents\` list at the top`);
    }
  }
}

/** A script ships compiled from src/: Node builtins only, a header saying what it does, and a working --help. */
function checkScripts(root: string, skill: string, fields: Fields, report: Report): void {
  const name = skill.split(/[\\/]/).at(-1) ?? "";
  const shipped = files(join(skill, "scripts"));
  if (!shipped.length) return;
  const compatibility = String(fields.compatibility ?? "");
  const version = NODE_VERSION.exec(compatibility)?.[1];
  if (!version || Number(version) < NODE_FLOOR)
    report.error(`${name}/SKILL.md`, `has scripts, so \`compatibility\` must say \`Node ${NODE_FLOOR} or later\``);
  for (const path of shipped) {
    const rel = posix(relative(skill, path));
    const at = `${name}/${rel}`;
    if (!path.endsWith(".mjs")) {
      report.error(at, "scripts are JavaScript compiled from TypeScript in src/skills/ (.mts to .mjs)");
      continue;
    }
    const source = join(
      root,
      "src",
      posix(relative(join(root), skill)).replace(/^skills\//, "skills/"),
      rel.replace(/\.mjs$/, ".mts"),
    );
    if (!existsSync(source))
      report.error(at, `has no source at ${posix(relative(root, source))}; write the .mts there and build`);
    const text = read(path);
    const firstLine = text.split("\n").find((l) => l.trim() && !l.startsWith("#!"));
    if (!firstLine?.startsWith("//")) report.error(at, "has no comment at the top saying what it does");
    for (const match of text.matchAll(IMPORTS)) {
      const spec = match[1] ?? match[2] ?? "";
      if (spec.startsWith("node:")) continue;
      if (spec.startsWith(".") && existsSync(resolve(dirname(path), spec))) continue;
      report.error(
        at,
        `imports ${spec}; scripts ship without node_modules, so use Node's built-in modules only (node:...)`,
      );
    }
    if (/\bprocess\.stdin\b|\bnode:readline\b/.test(text))
      report.error(at, "reads typed input; an agent cannot answer. Take an argument");
    const done = spawnSync(process.execPath, [path, "--help"], {
      encoding: "utf8",
      timeout: HELP_TIMEOUT_MS,
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    });
    if (done.error) report.error(at, `--help did not finish in ${HELP_TIMEOUT_MS / 1000} seconds`);
    else if (done.status !== 0) report.error(at, `--help ended with exit code ${done.status}`);
  }
}

function loadJson(path: string, at: string, report: Report): unknown {
  try {
    return JSON.parse(read(path));
  } catch (e) {
    report.error(at, `is not valid JSON: ${(e as Error).message}`);
    return null;
  }
}

function checkEvals(skill: string, report: Report): void {
  const name = skill.split(/[\\/]/).at(-1) ?? "";
  let at = `${name}/evals/evals.json`;
  const evalsPath = join(skill, "evals", "evals.json");
  if (!existsSync(evalsPath))
    report.error(at, `is missing; write at least ${MIN_EVALS} real tasks with what a good result looks like`);
  else {
    const data = loadJson(evalsPath, at, report) as { evals?: unknown } | null;
    if (data !== null) {
      const evals = Array.isArray(data?.evals) ? (data.evals as Record<string, unknown>[]) : [];
      const good = evals.filter((e) => e && e.prompt && e.expected_output);
      if (good.length < MIN_EVALS || good.length !== evals.length)
        report.error(
          at,
          `needs at least ${MIN_EVALS} evals, each with \`prompt\` and \`expected_output\`; found ${good.length} complete of ${evals.length}`,
        );
    }
  }
  at = `${name}/evals/triggers.json`;
  const triggersPath = join(skill, "evals", "triggers.json");
  if (!existsSync(triggersPath))
    report.warn(at, "is missing; the description has not been tested against what users type");
  else {
    const data = loadJson(triggersPath, at, report);
    if (data !== null) {
      const queries = Array.isArray(data) ? (data as Record<string, unknown>[]).filter((q) => q?.query) : [];
      const should = queries.filter((q) => q.should_trigger === true).length;
      const shouldNot = queries.filter((q) => q.should_trigger === false).length;
      if (should < MIN_TRIGGERS_EACH || shouldNot < MIN_TRIGGERS_EACH)
        report.warn(
          at,
          `has ${should} queries that should load the skill and ${shouldNot} that should not; aim for ${MIN_TRIGGERS_EACH} of each`,
        );
    }
  }
}

export function check(root: string): Report {
  const report = new Report();
  const home = join(root, "skills");
  const listed = isDir(home) ? readdirSync(home).sort() : [];
  const skills = listed.filter((n) => !n.startsWith(".") && isDir(join(home, n))).map((n) => join(home, n));
  // Not yet measured: checked like the rest, but not listed in the README.
  const draftsHome = join(home, ".experimental");
  const drafts = isDir(draftsHome)
    ? readdirSync(draftsHome)
        .sort()
        .filter((n) => isDir(join(draftsHome, n)))
        .map((n) => join(draftsHome, n))
    : [];
  if (!skills.length && !drafts.length) report.error("skills/", "no skill folders found");
  const readme = existsSync(join(root, "README.md")) ? read(join(root, "README.md")) : "";
  for (const skill of [...skills, ...drafts]) {
    const name = skill.split(/[\\/]/).at(-1) ?? "";
    if (!existsSync(join(skill, "SKILL.md"))) {
      report.error(`${name}/`, "has no SKILL.md");
      continue;
    }
    const { fields, body, wrong } = frontmatter(read(join(skill, "SKILL.md")));
    for (const what of wrong) report.error(`${name}/SKILL.md`, what);
    checkFrontmatter(skill, fields, report);
    checkText(skill, body, report);
    checkScripts(root, skill, fields, report);
    checkEvals(skill, report);
    if (!drafts.includes(skill) && !readme.includes(`skills/${name}/SKILL.md`))
      report.error("README.md", `does not list ${name}; add a row to the table of skills`);
  }
  // Harbor copies a task from the working folder, not from git, so a file saved with Windows line endings reaches
  // the container as is: `import os\r` matches no sed pattern and a shell script fails. The tests are in the private
  // agents-bench repository, when it is checked out beside this one.
  const bench = process.env.AGENTS_BENCH ?? join(root, "..", "agents-bench");
  for (const group of ["skills", "archive"]) {
    const base = join(bench, group);
    for (const test of isDir(base) ? readdirSync(base).sort() : []) {
      for (const path of files(join(base, test, "task"))) {
        if (readFileSync(path).includes("\r\n"))
          report.error(
            `agents-bench/${posix(relative(bench, path))}`,
            "has Windows line endings (CRLF); save it with LF, as a container reads it",
          );
      }
    }
  }
  return report;
}

function main(): number {
  let args: ReturnType<typeof parseArgs>;
  try {
    args = parseArgs({
      options: {
        root: { type: "string", default: resolve(dirname(fileURLToPath(import.meta.url)), "..") },
        json: { type: "boolean", default: false },
        help: { type: "boolean", short: "h", default: false },
      },
    });
  } catch (e) {
    console.error(`${(e as Error).message}\n\n${HELP}`);
    return 2;
  }
  if (args.values.help) {
    console.log(HELP);
    return 0;
  }
  const root = resolve(String(args.values.root));
  if (!isDir(root)) {
    console.error(`--root ${root} is not a folder`);
    return 2;
  }
  const report = check(root);
  const errors = report.count("error");
  const warnings = report.count("warning");
  if (args.values.json) console.log(JSON.stringify({ errors, warnings, found: report.found }, null, 2));
  else {
    for (const f of report.found) console.log(`${f.level.toUpperCase().padEnd(8)}${f.where}: ${f.what}`);
    console.log(`${errors} errors, ${warnings} warnings`);
  }
  return errors ? 1 : 0;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) process.exitCode = main();
