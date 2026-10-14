"""Run a skill's task with the skill and without it, and say whether the skill helped.

    python scripts/bench.py SKILL [--task NAME] [--model ID] [--runs N] [--batch N] [--until-decided] [--replay] [--force] [--json]
    python scripts/bench.py SKILL --from JOB_WITHOUT JOB_WITH

SKILL            a folder name under skills/ or skills/.experimental/
--task           the task under tasks/ to run (default: the one named after SKILL); a checklist skill is scored
                 on its focused skills' tasks, one at a time, never averaged
--model          the model the agent uses (default claude-haiku-5-5, the small fast one)
--runs           the most trials each way (default 10)
--batch          trials each way per batch, all at once (default 5)
--until-decided  stop after the first batch at which the decision rule gives a verdict
--replay         never start an agent: score saved batches, or say what would have to be run
--force          run every batch again even when nothing has changed
--from           score two Harbor job folders that already exist
--json           print JSON instead of text

Each batch runs both arms at the same time, so they share load and versions. The verdict applies the
decision rule in AGENTS.md. Checks on what the agent did, not only what it left, are read from the
trajectories using tasks/<TASK>/trajectory_checks.json when it exists.

A run starts agents, which costs tokens, and needs Harbor, Docker and a sign-in for the agent in the
environment. Saved batches are kept under a hash of what decides their result, so a second call with
nothing changed asks no model anything, and the run without the skill is not repeated when only the
skill changes, nor for another skill scored on the same task.

Exit codes: 0 done, 1 a run failed or --replay found nothing saved, 2 bad arguments.
Needs Python 3.11 or later. Uses only the standard library.
"""

import argparse
import hashlib
import json
import math
import os
import re
import shutil
import statistics
import subprocess
import sys
import time
from datetime import date, datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
JOBS = ROOT / "jobs"  # Harbor's raw output; not kept in git
DEFAULT_MODEL = "claude-haiku-5-5"
DEFAULT_RUNS = 10  # AGENTS.md: the fewest runs each way at which a skill can be promoted
DEFAULT_BATCH = 5  # ten containers at once used 1.5 GB in all and met no refusal (14 October 2026)
RETRIES = 2  # Harbor retries only errors it treats as passing (not sign-in or usage-limit errors)
BUDGET_SECONDS = 300  # AGENTS.md: the task step is to finish in under five minutes
MIN_FREE_GB = 8.0  # a batch of ten used 1.5 GB at the peak; the rest is room for whatever else is running
# On Windows a program started from a background process opens its own console window, and Harbor's
# Docker calls each flash one up. Starting Harbor with no window gives them a hidden console to share.
NO_WINDOW = {"creationflags": subprocess.CREATE_NO_WINDOW} if sys.platform == "win32" else {}

# The decision rule in AGENTS.md, as shares of the runs each way.
PROMOTE_RUNS, PROMOTE_GAP, WORST_DROP, TOKEN_RATIO = 10, 0.4, 0.1, 3.0
DELETE_RUNS, DELETE_GAP = 20, 0.3


def free_memory_gb() -> float | None:
    """Free physical memory, or None where it cannot be read without a package."""
    if sys.platform == "win32":
        import ctypes

        class Status(ctypes.Structure):
            _fields_ = [("length", ctypes.c_ulong), ("load", ctypes.c_ulong)] + [
                (name, ctypes.c_ulonglong)
                for name in ("total", "free", "page_total", "page_free", "virtual_total", "virtual_free", "extended")
            ]

        status = Status()
        status.length = ctypes.sizeof(Status)
        ctypes.windll.kernel32.GlobalMemoryStatusEx(ctypes.byref(status))
        return status.free / 1024**3
    meminfo = Path("/proc/meminfo")
    if meminfo.is_file():
        for line in meminfo.read_text().splitlines():
            if line.startswith("MemAvailable:"):
                return int(line.split()[1]) / 1024**2
    return None


def find(skill: str, task_name: str) -> tuple[Path, Path]:
    homes = [ROOT / "skills" / skill, ROOT / "skills" / ".experimental" / skill]
    folder = next((h for h in homes if (h / "SKILL.md").is_file()), None)
    task = ROOT / "tasks" / task_name
    if folder is None:
        print(f"Error: no skill named {skill!r} under skills/ or skills/.experimental/.", file=sys.stderr)
        sys.exit(2)
    if not (task / "task.toml").is_file():
        print(
            f"Error: no task at {task.relative_to(ROOT).as_posix()}/task.toml. Pass --task with a folder name under tasks/.",
            file=sys.stderr,
        )
        sys.exit(2)
    return folder, task


def key_of(folders: list[Path], model: str) -> str:
    """A hash of everything that decides the result. Line endings are ignored so every platform agrees."""
    digest = hashlib.sha256(f"{model}\n".encode())
    for base in folders:
        for path in sorted(p for p in base.rglob("*") if p.is_file() and "__pycache__" not in p.parts):
            if "evals" in path.relative_to(base).parts:
                continue
            digest.update(path.relative_to(base).as_posix().encode())
            digest.update(path.read_bytes().replace(b"\r\n", b"\n"))
    return digest.hexdigest()[:12]


def seconds(span: dict | None) -> float | None:
    if not span or not span.get("started_at") or not span.get("finished_at"):
        return None
    return (datetime.fromisoformat(span["finished_at"]) - datetime.fromisoformat(span["started_at"])).total_seconds()


def load_trajectory_checks(task: Path | None) -> list[dict]:
    path = task / "trajectory_checks.json" if task else None
    if not path or not path.is_file():
        return []
    checks = json.loads(path.read_text(encoding="utf-8"))
    for check in checks:
        check["pattern"] = re.compile(check["forbid"])
    return checks


def commands_run(trajectory: str) -> list[str]:
    if not trajectory:
        return []
    steps = json.loads(trajectory).get("steps", [])
    return [
        str((call.get("arguments") or {}).get("command", ""))
        for step in steps
        for call in step.get("tool_calls") or []
        if (call.get("arguments") or {}).get("command")
    ]


def read_job(job: Path, trajectory_checks: list[dict]) -> dict:
    trials = []
    for trial in sorted(p for p in job.iterdir() if p.is_dir() and (p / "result.json").is_file()):
        result = json.loads((trial / "result.json").read_text(encoding="utf-8"))
        usage = result.get("agent_result") or {}
        checks_file = trial / "verifier" / "checks.txt"
        lines = (
            [line.split() for line in checks_file.read_text(encoding="utf-8").splitlines()]
            if checks_file.is_file()
            else []
        )
        checks = {parts[2]: parts[0] == "PASS" for parts in lines if len(parts) == 3}
        path = trial / "agent" / "trajectory.json"
        trajectory = path.read_text(encoding="utf-8") if path.is_file() else ""
        if checks:
            commands = commands_run(trajectory)
            for check in trajectory_checks:
                checks[f"did:{check['name']}"] = not any(check["pattern"].search(c) for c in commands)
        trials.append(
            {
                "trial": trial.name,
                "served_models": sorted((usage.get("model_usage") or {}).keys()),
                "checks": checks,
                "passed": sum(checks.values()),
                "input_tokens": usage.get("n_input_tokens"),
                "output_tokens": usage.get("n_output_tokens"),
                "agent_seconds": seconds(result.get("agent_execution")),
                "setup_seconds": (seconds(result.get("environment_setup")) or 0)
                + (seconds(result.get("agent_setup")) or 0),
                "grading_seconds": seconds(result.get("verifier")),
                # Loaded through the agent's skill tool, or read as a file.
                "skill_read": '"Skill"' in trajectory or "SKILL.md" in trajectory,
                "failed_to_run": (trial / "exception.txt").is_file() or not checks,
            }
        )
    return {"job": job.name, "trials": trials}


def complete(job: Path, runs: int) -> bool:
    if not (job / "result.json").is_file():
        return False
    trials = read_job(job, [])["trials"]
    return len(trials) >= runs and not any(t["failed_to_run"] for t in trials)


def mean(values: list) -> float | None:
    values = [v for v in values if v is not None]
    return statistics.mean(values) if values else None


def summarise(without: list[dict], with_skill: list[dict]) -> dict:
    names = list(dict.fromkeys(name for side in (without, with_skill) for t in side for name in t["checks"]))
    table = []
    for name in names:
        a = sum(t["checks"].get(name, False) for t in without)
        b = sum(t["checks"].get(name, False) for t in with_skill)
        table.append({"check": name, "without": a, "with": b, "tells_apart": a != b})
    sides = {}
    for label, trials in (("without", without), ("with", with_skill)):
        passed = [t["passed"] for t in trials]
        sides[label] = {
            "trials": len(trials),
            "checks_passed_mean": mean(passed),
            "input_tokens_mean": mean([t["input_tokens"] for t in trials]),
            "output_tokens_mean": mean([t["output_tokens"] for t in trials]),
            "agent_seconds_mean": mean([t["agent_seconds"] for t in trials]),
            "setup_seconds_mean": mean([t["setup_seconds"] for t in trials]),
            "grading_seconds_mean": mean([t["grading_seconds"] for t in trials]),
            "skill_read": sum(t["skill_read"] for t in trials),
            "served_models": sorted({m for t in trials for m in t["served_models"]}),
        }
    summary = {"checks_total": len(names), "sides": sides, "checks": table}
    summary["verdict"] = verdict(summary)
    return summary


def verdict(summary: dict) -> str:
    """The decision rule in AGENTS.md."""
    a, b = summary["sides"]["without"], summary["sides"]["with"]
    runs = min(a["trials"], b["trials"])
    if not runs or not summary["checks"]:
        return "no runs"
    gaps = [(c["with"] / b["trials"] - c["without"] / a["trials"], c["check"]) for c in summary["checks"]]
    best, best_check = max(gaps)
    worst, worst_check = min(gaps)
    ratio = (b["input_tokens_mean"] or 0) / (a["input_tokens_mean"] or 1)
    if runs >= PROMOTE_RUNS and best >= PROMOTE_GAP and worst >= -WORST_DROP and ratio <= TOKEN_RATIO:
        return f"promote: {best_check} ahead by {best:.0%} of runs, nothing behind by more than {WORST_DROP:.0%}, tokens x{ratio:.2f}"
    if runs >= DELETE_RUNS and best < DELETE_GAP:
        return (
            f"delete: after {runs} runs each way no check is ahead by {DELETE_GAP:.0%} (best {best_check}, {best:.0%})"
        )
    reasons = []
    if runs < PROMOTE_RUNS:
        reasons.append(f"{runs} runs each way, the rule needs {PROMOTE_RUNS}")
    if best < PROMOTE_GAP:
        reasons.append(f"best gap {best:.0%} ({best_check}), the rule needs {PROMOTE_GAP:.0%}")
    if worst < -WORST_DROP:
        reasons.append(f"{worst_check} is behind by {-worst:.0%}")
    if ratio > TOKEN_RATIO:
        reasons.append(f"tokens x{ratio:.2f}, the rule allows x{TOKEN_RATIO}")
    return "undecided: " + "; ".join(reasons)


def num(value: float | None, digits: int = 0) -> str:
    return "n/a" if value is None else f"{value:,.{digits}f}"


def as_markdown(skill: str, model: str, summary: dict, took: float | None, note: str) -> str:
    a, b = summary["sides"]["without"], summary["sides"]["with"]
    total = summary["checks_total"]
    lines = [
        f"# {skill} on {model}, {date.today().isoformat()}",
        "",
        note,
        "",
        f"**Verdict:** {summary['verdict']}",
        "",
        "| | Without the skill | With the skill |",
        "|---|---|---|",
        f"| Runs | {a['trials']} | {b['trials']} |",
        f"| Checks passed, mean of {total} | {num(a['checks_passed_mean'], 1)} | {num(b['checks_passed_mean'], 1)} |",
        f"| Input tokens, mean | {num(a['input_tokens_mean'])} | {num(b['input_tokens_mean'])} |",
        f"| Output tokens, mean | {num(a['output_tokens_mean'])} | {num(b['output_tokens_mean'])} |",
        f"| Agent time, mean | {num(a['agent_seconds_mean'])} s | {num(b['agent_seconds_mean'])} s |",
        f"| Set-up and grading per run, mean | {num(a['setup_seconds_mean'])} s and {num(a['grading_seconds_mean'])} s | {num(b['setup_seconds_mean'])} s and {num(b['grading_seconds_mean'])} s |",
        f"| Skill read | | {b['skill_read']} of {b['trials']} |",
        f"| Model actually served | {', '.join(a['served_models']) or 'n/a'} | {', '.join(b['served_models']) or 'n/a'} |",
        "",
        "Checks named `did:` are about what the agent did, read from its trajectory.",
        "",
        "| Check | Without | With | Tells them apart |",
        "|---|---|---|---|",
    ]
    lines += [
        f"| {c['check']} | {c['without']}/{a['trials']} | {c['with']}/{b['trials']} | {'yes' if c['tells_apart'] else 'no'} |"
        for c in summary["checks"]
    ]
    if took is not None:
        over = f" That is over the budget of {BUDGET_SECONDS} s." if took > BUDGET_SECONDS else ""
        lines += ["", f"The runs took {took:.0f} s.{over}"]
    return "\n".join(lines) + "\n"


def harbor_version() -> str:
    try:
        done = subprocess.run(
            ["harbor", "--version"], capture_output=True, text=True, timeout=30, check=False, **NO_WINDOW
        )
        return done.stdout.strip()
    except OSError:
        return "harbor not found"


def without_evals(skill: Path) -> Path:
    """A copy of the skill without evals/, whose prompts and expected outputs would hint at the task."""
    copy = JOBS / "skill-copies" / skill.name
    shutil.rmtree(copy, ignore_errors=True)
    shutil.copytree(skill, copy, ignore=shutil.ignore_patterns("evals", "__pycache__"))
    return copy


def harbor(task: Path, model: str, runs: int, name: str, skill: Path | None) -> subprocess.Popen:
    command = ["harbor", "run", "-p", str(task), "-a", "claude-code", "-m", model, "-k", str(runs), "-n", str(runs)]
    command += ["--max-retries", str(RETRIES), "-o", str(JOBS), "--job-name", name]
    # Web search and fetch run on Anthropic's side, past the task's network allowlist; a public repository
    # holds the grading scripts, so they are switched off.
    command += ["--ak", "disable_web_search=true"]
    if skill:
        command += ["--skill", str(without_evals(skill))]
    log = (JOBS / f"{name}.log").open("w", encoding="utf-8")
    env = {**os.environ, "PYTHONUTF8": "1", "PYTHONIOENCODING": "utf-8"}
    return subprocess.Popen(command, stdout=log, stderr=subprocess.STDOUT, env=env, cwd=ROOT, **NO_WINDOW)


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Run a skill's task with the skill and without it, and say whether the skill helped.",
        epilog="A run starts agents and costs tokens. Exit codes: 0 done, 1 a run failed or --replay found nothing saved, 2 bad arguments.",
    )
    parser.add_argument("skill", help="a folder name under skills/ or skills/.experimental/")
    parser.add_argument("--task", help="the task under tasks/ to run (default: the one named after the skill)")
    parser.add_argument("--model", default=DEFAULT_MODEL, help=f"the model the agent uses (default {DEFAULT_MODEL})")
    parser.add_argument(
        "--runs", type=int, default=DEFAULT_RUNS, help=f"the most trials each way (default {DEFAULT_RUNS})"
    )
    parser.add_argument(
        "--batch", type=int, default=DEFAULT_BATCH, help=f"trials each way per batch (default {DEFAULT_BATCH})"
    )
    parser.add_argument("--until-decided", action="store_true", help="stop at the first batch that gives a verdict")
    parser.add_argument("--replay", action="store_true", help="never start an agent: score saved batches")
    parser.add_argument("--force", action="store_true", help="run every batch again even when nothing has changed")
    parser.add_argument(
        "--from",
        dest="existing",
        nargs=2,
        type=Path,
        metavar=("WITHOUT", "WITH"),
        help="score two existing Harbor job folders",
    )
    parser.add_argument("--json", action="store_true", help="print JSON instead of text")
    parser.add_argument(
        "--min-free-gb",
        type=float,
        default=MIN_FREE_GB,
        help=f"refuse to start a batch with less free memory than this (default {MIN_FREE_GB})",
    )
    args = parser.parse_args()
    task_name = args.task or args.skill
    if args.runs < 1 or args.batch < 1:
        parser.error("--runs and --batch must be 1 or more")

    took = None
    if args.existing:
        for job in args.existing:
            if not job.is_dir():
                parser.error(f"{job} is not a folder")
        task = ROOT / "tasks" / task_name
        checks = load_trajectory_checks(task if task.is_dir() else None)
        sides = {
            "without": read_job(args.existing[0], checks)["trials"],
            "with": read_job(args.existing[1], checks)["trials"],
        }
        note = f"Scored from saved runs: `{args.existing[0].name}` and `{args.existing[1].name}`."
    else:
        folder, task = find(args.skill, task_name)
        checks = load_trajectory_checks(task)
        # The run without the skill depends only on the task, so editing the skill does not repeat it.
        # The harness version and the way the agent is run decide the result too.
        setup = f"{harbor_version()}\nweb search off\n"
        keys = {"without": key_of([task], args.model + setup), "with": key_of([folder, task], args.model + setup)}
        key = f"{keys['without']}/{keys['with']}"
        sides = {"without": [], "with": []}
        started = time.monotonic()
        ran = False
        for batch in range(math.ceil(args.runs / args.batch)):
            size = min(args.batch, args.runs - batch * args.batch)
            # The run without a skill is named after the task alone, so every skill scored on it shares it.
            owner = {
                "without": task_name,
                "with": args.skill if task_name == args.skill else f"{args.skill}-on-{task_name}",
            }
            jobs = {side: JOBS / f"{owner[side]}-{args.model}-{keys[side]}-{side}-b{batch}" for side in sides}
            missing = [side for side, job in jobs.items() if args.force or not complete(job, size)]
            if missing and args.replay:
                if batch == 0:
                    print(
                        f"Nothing saved for key {key}: would run {size} trials {' and '.join(missing)} the skill.",
                        file=sys.stderr,
                    )
                    return 1
                break
            if missing:
                free = free_memory_gb()
                if free is not None and free < args.min_free_gb:
                    print(
                        f"Error: {free:.1f} GB of memory is free and --min-free-gb is {args.min_free_gb}. Something else needs the machine; try later.",
                        file=sys.stderr,
                    )
                    return 1
                JOBS.mkdir(exist_ok=True)
                # Harbor resumes a job folder that exists, so a forced run would only read the old trials back.
                # They are set aside under a dated name, not deleted: they are the record of an earlier run.
                stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
                for side in missing:
                    if jobs[side].exists():
                        jobs[side].rename(jobs[side].with_name(f"{jobs[side].name}.set-aside-{stamp}"))
                print(
                    f"Batch {batch + 1}: running {size} trials {' and '.join(missing)} the skill on {args.model} ...",
                    file=sys.stderr,
                )
                running = [
                    harbor(task, args.model, size, jobs[side].name, folder if side == "with" else None)
                    for side in missing
                ]
                codes = [process.wait() for process in running]
                ran = True
                bad = [side for side in missing if not complete(jobs[side], size)]
                if any(codes) or bad:
                    print(
                        f"Error: batch {batch + 1} {' and '.join(bad or missing)} the skill did not finish cleanly. See {JOBS.name}/*.log and each trial's exception.txt.",
                        file=sys.stderr,
                    )
                    return 1
            for side, job in jobs.items():
                sides[side] += read_job(job, checks)["trials"]
            if args.until_decided and not summarise(sides["without"], sides["with"])["verdict"].startswith("undecided"):
                break
        took = time.monotonic() - started if ran else None
        if not ran:
            print(f"Nothing has changed since key {key}: scoring the saved runs, no agent started.", file=sys.stderr)
        note = f"Task `tasks/{task_name}`, agent Claude Code, batches of {args.batch} each way run side by side. Key `{key}`."

    summary = summarise(sides["without"], sides["with"])
    summary["took_seconds"] = took
    if args.json:
        print(json.dumps(summary, indent=2))
    else:
        print(as_markdown(args.skill, args.model, summary, took, note))
    return 0


if __name__ == "__main__":
    sys.exit(main())
