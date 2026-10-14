"""Copy what each benchmark run says into the private agents-bench repository, filed by test, date and side.

    python scripts/export_runs.py [--to DIR] [--apply]

Reads Harbor's job folders in jobs/ and files each trial, by test then side, as

    runs/<test>/<side>/<date>/<time>-<trial>/

where <side> is no-skill, the skill's name, reference-solution or do-nothing. Only what a run says is kept
(checks.txt, reward.txt, result.json, trajectory.json, agent.txt, exception.txt), not the copies of the test
project it left. Without --apply it prints what it would copy. Safe to run twice: a trial already filed is skipped.
Exit codes: 0 done, 2 bad arguments.
"""

import argparse
import json
import shutil
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
JOBS = ROOT / "jobs"
KEEP = {  # what a trial says, under the name it is filed as
    "verifier/checks.txt": "checks.txt",
    "verifier/reward.txt": "reward.txt",
    "result.json": "result.json",
    "agent/trajectory.json": "trajectory.json",
    "agent/claude-code.txt": "agent.txt",
    "agent/oracle.txt": "agent.txt",
    "exception.txt": "exception.txt",
}
SIDES = {"oracle": "reference-solution", "nop": "do-nothing"}


def side_of(trial: Path) -> str:
    """From the trial's own record: Harbor leaves the agent out when it is the default, the reference solution."""
    agent = json.loads((trial / "config.json").read_text(encoding="utf-8")).get("agent") or {"name": "oracle"}
    if agent.get("name") in SIDES:
        return SIDES[agent["name"]]
    skills = agent.get("skills") or []
    return Path(str(skills[0]).replace("\\", "/")).name if skills else "no-skill"


def main() -> int:
    parser = argparse.ArgumentParser(
        description="File benchmark runs into the private agents-bench repository by test, side and date."
    )
    parser.add_argument(
        "--to",
        type=Path,
        default=ROOT.parent / "agents-bench" / "runs",
        help="where runs go (default ../agents-bench/runs)",
    )
    parser.add_argument("--apply", action="store_true", help="copy; without it, only say what would be copied")
    args = parser.parse_args()
    if not JOBS.is_dir():
        parser.error(f"no jobs/ folder at {JOBS}")

    copied = skipped = 0
    for config_file in sorted(JOBS.glob("*/config.json")):
        job = config_file.parent
        config = json.loads(config_file.read_text(encoding="utf-8"))
        tasks = config.get("tasks") or [{}]
        test = Path(str(tasks[0].get("path", "unknown")).replace("\\", "/")).name
        if not (args.to.parent / "tasks" / test).is_dir():
            continue  # smoke tests and probes that were never benchmark tasks
        for trial in sorted(
            p for p in job.iterdir() if (p / "result.json").is_file() and (p / "config.json").is_file()
        ):
            side = side_of(trial)
            started = (
                json.loads((trial / "result.json").read_text(encoding="utf-8")).get("started_at") or "0000-00-00T00:00"
            )
            day, clock = started[:10], started[11:16].replace(":", "")
            target = args.to / test / side / day / f"{clock}-{trial.name.split('__')[-1]}"
            if target.exists():
                skipped += 1
                continue
            copied += 1
            if not args.apply:
                print(target.relative_to(args.to).as_posix())
                continue
            target.mkdir(parents=True)
            for source, name in KEEP.items():
                if (trial / source).is_file():
                    shutil.copy2(trial / source, target / name)
    verb = "Copied" if args.apply else "Would copy"
    print(f"{verb} {copied} trials; {skipped} already filed.", file=sys.stderr)
    return 0


if __name__ == "__main__":
    sys.exit(main())
