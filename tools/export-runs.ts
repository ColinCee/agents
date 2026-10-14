// Copy what each benchmark run says into the private agents-bench repository, filed by test, side and date.
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, statSync } from "node:fs";
import { basename, dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";

const HELP = `File benchmark runs into the private agents-bench repository by test, side and date.

  npm run export-runs -- [--to DIR] [--apply]

Reads Harbor's job folders in jobs/ and files each trial as

  skills/<skill>/runs/<side>/<date>-<time>-<trial>/

mirroring skills/, where <skill> is the one whose test it ran and <side> is no-skill, the skill's name,
reference-solution or do-nothing. Only what a run says is kept (checks.txt, reward.txt, result.json, trajectory.json,
agent.txt, exception.txt), not the copies of the test project it left. Without --apply it prints what it would copy.
Safe to run twice: a trial already filed is skipped.

--to     the agents-bench repository (default ../agents-bench)
--apply  copy; without it, only say what would be copied

Exit codes: 0 done, 2 bad arguments.`;

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const JOBS = join(ROOT, "jobs");
// Tests renamed when agents-bench came to mirror skills/: where runs made under the old names belong.
const RENAMED: Record<string, string> = {
  sidebar: "ui-decluttering",
  choosing: "deciding",
  typing: "archive/strict-types-whole-project",
  "strict-types": "archive/strict-types-one-field",
  "experiment-design": "archive/experiment-design",
  "ui-flow": "archive/ui-flow",
};
// Tests archived after agents-bench came to mirror skills/: their runs follow them.
const ARCHIVED: Record<string, string> = {
  "strict-types": "archive/strict-types-whole-project",
  safeguarding: "archive/safeguarding",
  cleaning: "archive/cleaning",
  tidying: "archive/tidying",
};
// What a trial says, under the name it is filed as.
const KEEP: [string, string][] = [
  ["verifier/checks.txt", "checks.txt"],
  ["verifier/reward.txt", "reward.txt"],
  ["result.json", "result.json"],
  ["agent/trajectory.json", "trajectory.json"],
  ["agent/claude-code.txt", "agent.txt"],
  ["agent/oracle.txt", "agent.txt"],
  ["exception.txt", "exception.txt"],
];
const SIDES: Record<string, string> = { oracle: "reference-solution", nop: "do-nothing" };

const isFile = (path: string): boolean => existsSync(path) && statSync(path).isFile();
const readJson = (path: string): Record<string, unknown> => JSON.parse(readFileSync(path, "utf8"));
const lastPart = (path: string): string => basename(path.replaceAll("\\", "/"));

/** From the trial's own record: Harbor leaves the agent out when it is the default, the reference solution. */
function sideOf(trial: string): string {
  const agent = (readJson(join(trial, "config.json")).agent ?? { name: "oracle" }) as {
    name?: string;
    skills?: string[];
  };
  if (agent.name && agent.name in SIDES) return SIDES[agent.name] as string;
  const skill = agent.skills?.[0];
  return skill ? lastPart(skill) : "no-skill";
}

/** Which test a job ran: <skill>/task, a command's copy named <skill>-on-<test>, or an older tasks/<name>. */
function testOf(taskPath: string): string {
  const parts = taskPath.replaceAll("\\", "/").split("/");
  let name = parts.at(-1) ?? "unknown";
  let parent = parts.at(-2) ?? "";
  if (parent === "task-copies") {
    parent = name.split("-on-").slice(1).join("-on-") || name;
    name = "task";
  }
  const test = name === "task" ? (ARCHIVED[parent] ?? parent) : (RENAMED[name] ?? ARCHIVED[name] ?? name);
  return test.startsWith("archive/") ? test : `skills/${test}`;
}

function main(): number {
  let to: string;
  let apply: boolean;
  try {
    const { values } = parseArgs({
      options: {
        to: { type: "string", default: join(ROOT, "..", "agents-bench") },
        apply: { type: "boolean", default: false },
        help: { type: "boolean", short: "h", default: false },
      },
    });
    if (values.help) {
      console.log(HELP);
      return 0;
    }
    to = resolve(String(values.to));
    apply = Boolean(values.apply);
  } catch (e) {
    console.error(`${(e as Error).message}\n\n${HELP}`);
    return 2;
  }
  if (!existsSync(JOBS)) {
    console.error(`No jobs/ folder at ${JOBS}: nothing has been run here.`);
    return 2;
  }
  let copied = 0;
  let skipped = 0;
  for (const jobName of readdirSync(JOBS).sort()) {
    const job = join(JOBS, jobName);
    if (!isFile(join(job, "config.json"))) continue;
    const tasks = (readJson(join(job, "config.json")).tasks ?? [{}]) as { path?: string }[];
    const test = testOf(tasks[0]?.path ?? "unknown");
    if (!existsSync(join(to, test, "task"))) continue; // smoke tests and probes that were never benchmark tasks
    for (const trialName of readdirSync(job).sort()) {
      const trial = join(job, trialName);
      if (!isFile(join(trial, "result.json")) || !isFile(join(trial, "config.json"))) continue;
      const started = String(readJson(join(trial, "result.json")).started_at ?? "0000-00-00T00:00");
      const stamp = `${started.slice(0, 10)}-${started.slice(11, 16).replace(":", "")}`;
      const target = join(to, test, "runs", sideOf(trial), `${stamp}-${trialName.split("__").at(-1)}`);
      if (existsSync(target)) {
        skipped += 1;
        continue;
      }
      copied += 1;
      if (!apply) {
        console.log(relative(to, target).split(sep).join("/"));
        continue;
      }
      mkdirSync(target, { recursive: true });
      for (const [source, name] of KEEP)
        if (isFile(join(trial, source))) copyFileSync(join(trial, source), join(target, name));
    }
  }
  console.error(`${apply ? "Copied" : "Would copy"} ${copied} trials; ${skipped} already filed.`);
  return 0;
}

process.exitCode = main();
