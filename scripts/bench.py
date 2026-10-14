"""Run a skill's task with the skill and without it, and say whether the skill helped.

    python scripts/bench.py SKILL [--model ID] [--runs N] [--parallel N] [--replay] [--force] [--json]
    python scripts/bench.py SKILL --from JOB_WITHOUT JOB_WITH

SKILL       a folder name under skills/ or skills/.experimental/, with a task of the same name under tasks/
--model     the model the agent uses (default claude-haiku-5-5, the small fast one)
--runs      trials each way (default 5)
--parallel  trials at once in each of the two jobs (default 2)
--replay    never start an agent: score saved runs, or say what would have to be run
--force     run again even when nothing has changed
--from      score two Harbor job folders that already exist
--json      print JSON instead of text

A run starts agents, which costs tokens, and needs Harbor, Docker and a sign-in for the agent in the
environment. Saved runs are kept under a hash of the skill, the task, the model and the number of runs, so
a second call with nothing changed asks no model anything.

Exit codes: 0 done, 1 a run failed or --replay found nothing saved, 2 bad arguments.
Needs Python 3.11 or later. Uses only the standard library.
"""

import argparse
import hashlib
import json
import os
import statistics
import subprocess
import sys
import time
from datetime import date, datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
JOBS = ROOT / "jobs"  # Harbor's raw output; not kept in git
DEFAULT_MODEL = "claude-haiku-5-5"
DEFAULT_RUNS = 5  # the fewest that show a spread; three was called too few in published studies
DEFAULT_PARALLEL = 2  # two jobs of two trials is four 2 GB containers at most
BUDGET_SECONDS = 300  # AGENTS.md: the task step is to finish in under five minutes


def find(skill: str) -> tuple[Path, Path]:
    homes = [ROOT / "skills" / skill, ROOT / "skills" / ".experimental" / skill]
    folder = next((h for h in homes if (h / "SKILL.md").is_file()), None)
    task = ROOT / "tasks" / skill
    if folder is None:
        print(f"Error: no skill named {skill!r} under skills/ or skills/.experimental/.", file=sys.stderr)
        sys.exit(2)
    if not (task / "task.toml").is_file():
        print(f"Error: {skill} has no task. Expected {task.relative_to(ROOT).as_posix()}/task.toml.", file=sys.stderr)
        sys.exit(2)
    return folder, task


def key_of(folders: list[Path], model: str, runs: int) -> str:
    """A hash of everything that decides the result. Line endings are ignored so every platform agrees."""
    digest = hashlib.sha256(f"{model}\n{runs}\n".encode())
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


def read_job(job: Path) -> dict:
    trials = []
    for trial in sorted(p for p in job.iterdir() if p.is_dir() and (p / "result.json").is_file()):
        result = json.loads((trial / "result.json").read_text(encoding="utf-8"))
        usage = result.get("agent_result") or {}
        served = sorted((usage.get("model_usage") or {}).keys())
        checks_file = trial / "verifier" / "checks.txt"
        lines = (
            [line.split() for line in checks_file.read_text(encoding="utf-8").splitlines()]
            if checks_file.is_file()
            else []
        )
        checks = {parts[2]: parts[0] == "PASS" for parts in lines if len(parts) == 3}
        path = trial / "agent" / "trajectory.json"
        trajectory = path.read_text(encoding="utf-8") if path.is_file() else ""
        trials.append(
            {
                "trial": trial.name,
                "served_models": served,
                "checks": checks,
                "passed": sum(checks.values()),
                "input_tokens": usage.get("n_input_tokens"),
                "output_tokens": usage.get("n_output_tokens"),
                "agent_seconds": seconds(result.get("agent_execution")),
                "setup_seconds": (seconds(result.get("environment_setup")) or 0)
                + (seconds(result.get("agent_setup")) or 0),
                # Loaded through the agent's skill tool, or read as a file.
                "skill_read": '"Skill"' in trajectory or "SKILL.md" in trajectory,
                "failed_to_run": (trial / "exception.txt").is_file() or not checks,
            }
        )
    whole = json.loads((job / "result.json").read_text(encoding="utf-8")) if (job / "result.json").is_file() else {}
    return {"job": job.name, "trials": trials, "wall_seconds": seconds(whole)}


def complete(job: Path, runs: int) -> bool:
    if not (job / "result.json").is_file():
        return False
    trials = read_job(job)["trials"]
    return len(trials) >= runs and not any(t["failed_to_run"] for t in trials)


def mean(values: list) -> float | None:
    values = [v for v in values if v is not None]
    return statistics.mean(values) if values else None


def summarise(without: dict, with_skill: dict) -> dict:
    names = list(dict.fromkeys(name for side in (without, with_skill) for t in side["trials"] for name in t["checks"]))
    table = []
    for name in names:
        a = [t["checks"].get(name, False) for t in without["trials"]]
        b = [t["checks"].get(name, False) for t in with_skill["trials"]]
        table.append({"check": name, "without": sum(a), "with": sum(b), "tells_apart": sum(a) != sum(b)})
    sides = {}
    for label, side in (("without", without), ("with", with_skill)):
        trials = side["trials"]
        passed = [t["passed"] for t in trials]
        sides[label] = {
            "trials": len(trials),
            "checks_passed_mean": mean(passed),
            "checks_passed_range": [min(passed), max(passed)] if passed else None,
            "input_tokens_mean": mean([t["input_tokens"] for t in trials]),
            "output_tokens_mean": mean([t["output_tokens"] for t in trials]),
            "agent_seconds_mean": mean([t["agent_seconds"] for t in trials]),
            "setup_seconds_mean": mean([t["setup_seconds"] for t in trials]),
            "skill_read": sum(t["skill_read"] for t in trials),
            "wall_seconds": side["wall_seconds"],
            "served_models": sorted({m for t in trials for m in t["served_models"]}),
        }
    return {"checks_total": len(names), "sides": sides, "checks": table}


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
        "| | Without the skill | With the skill |",
        "|---|---|---|",
        f"| Runs | {a['trials']} | {b['trials']} |",
        f"| Checks passed, mean of {total} | {num(a['checks_passed_mean'], 1)} | {num(b['checks_passed_mean'], 1)} |",
        f"| Input tokens, mean | {num(a['input_tokens_mean'])} | {num(b['input_tokens_mean'])} |",
        f"| Output tokens, mean | {num(a['output_tokens_mean'])} | {num(b['output_tokens_mean'])} |",
        f"| Agent time, mean | {num(a['agent_seconds_mean'])} s | {num(b['agent_seconds_mean'])} s |",
        f"| Set-up time per run, mean | {num(a['setup_seconds_mean'])} s | {num(b['setup_seconds_mean'])} s |",
        f"| Skill read | | {b['skill_read']} of {b['trials']} |",
        f"| Model actually served | {', '.join(a['served_models']) or 'n/a'} | {', '.join(b['served_models']) or 'n/a'} |",
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
        lines += ["", f"The whole run took {took:.0f} s.{over}"]
    return "\n".join(lines) + "\n"


def harbor(task: Path, model: str, runs: int, parallel: int, name: str, skill: Path | None) -> subprocess.Popen:
    command = ["harbor", "run", "-p", str(task), "-a", "claude-code", "-m", model, "-k", str(runs), "-n", str(parallel)]
    command += ["-o", str(JOBS), "--job-name", name]
    if skill:
        command += ["--skill", str(skill)]
    log = (JOBS / f"{name}.log").open("w", encoding="utf-8")
    env = {**os.environ, "PYTHONUTF8": "1", "PYTHONIOENCODING": "utf-8"}
    return subprocess.Popen(command, stdout=log, stderr=subprocess.STDOUT, env=env, cwd=ROOT)


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Run a skill's task with the skill and without it, and say whether the skill helped.",
        epilog="A run starts agents and costs tokens. Exit codes: 0 done, 1 a run failed or --replay found nothing saved, 2 bad arguments.",
    )
    parser.add_argument("skill", help="a folder name under skills/ or skills/.experimental/")
    parser.add_argument("--model", default=DEFAULT_MODEL, help=f"the model the agent uses (default {DEFAULT_MODEL})")
    parser.add_argument("--runs", type=int, default=DEFAULT_RUNS, help=f"trials each way (default {DEFAULT_RUNS})")
    parser.add_argument(
        "--parallel",
        type=int,
        default=DEFAULT_PARALLEL,
        help=f"trials at once in each job (default {DEFAULT_PARALLEL})",
    )
    parser.add_argument(
        "--replay", action="store_true", help="never start an agent: score saved runs or say what is missing"
    )
    parser.add_argument("--force", action="store_true", help="run again even when nothing has changed")
    parser.add_argument(
        "--from",
        dest="existing",
        nargs=2,
        type=Path,
        metavar=("WITHOUT", "WITH"),
        help="score two existing Harbor job folders",
    )
    parser.add_argument("--json", action="store_true", help="print JSON instead of text")
    args = parser.parse_args()
    if args.runs < 1 or args.parallel < 1:
        parser.error("--runs and --parallel must be 1 or more")

    took = None
    if args.existing:
        for job in args.existing:
            if not job.is_dir():
                parser.error(f"{job} is not a folder")
        jobs = {"without": args.existing[0], "with": args.existing[1]}
        note = f"Scored from saved runs: `{jobs['without'].name}` and `{jobs['with'].name}`."
    else:
        folder, task = find(args.skill)
        # The run without the skill depends only on the task, so editing the skill does not repeat it.
        keys = {"without": key_of([task], args.model, args.runs), "with": key_of([folder, task], args.model, args.runs)}
        jobs = {side: JOBS / f"{args.skill}-{args.model}-{keys[side]}-{side}" for side in ("without", "with")}
        key = f"{keys['without']}/{keys['with']}"
        missing = [side for side, job in jobs.items() if args.force or not complete(job, args.runs)]
        note = f"Task `tasks/{args.skill}`, agent Claude Code, {args.runs} runs each way. Key `{key}`."
        if missing and args.replay:
            print(
                f"Nothing saved for key {key}: would run {args.runs} trials {' and '.join(missing)} the skill on {args.model}.",
                file=sys.stderr,
            )
            return 1
        if missing:
            JOBS.mkdir(exist_ok=True)
            print(f"Running {args.runs} trials {' and '.join(missing)} the skill on {args.model} ...", file=sys.stderr)
            started = time.monotonic()
            running = [
                harbor(task, args.model, args.runs, args.parallel, jobs[side].name, folder if side == "with" else None)
                for side in missing
            ]
            codes = [process.wait() for process in running]
            took = time.monotonic() - started
            bad = [side for side in missing if not complete(jobs[side], args.runs)]
            if any(codes) or bad:
                print(
                    f"Error: the run {' and '.join(bad or missing)} the skill did not finish cleanly. See {JOBS.name}/*.log and each trial's exception.txt.",
                    file=sys.stderr,
                )
                return 1
        else:
            print(f"Nothing has changed since key {key}: scoring the saved runs, no agent started.", file=sys.stderr)

    summary = summarise(read_job(jobs["without"]), read_job(jobs["with"]))
    summary["took_seconds"] = took
    if args.json:
        print(json.dumps(summary, indent=2))
    else:
        print(as_markdown(args.skill, args.model, summary, took, note))
    return 0


if __name__ == "__main__":
    sys.exit(main())
