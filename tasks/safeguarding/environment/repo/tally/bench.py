import json
import os
from pathlib import Path

BENCH_FILE = Path(os.environ.get("TALLY_HOME", Path.home() / ".tally")) / "bench" / "items.json"


def load(path: Path | None = None) -> dict:
    path = path or BENCH_FILE
    if not path.exists():
        return {"version": 3, "items": []}
    return json.loads(path.read_text(encoding="utf-8"))


def save(bench: dict, path: Path | None = None) -> None:
    path = path or BENCH_FILE
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(bench, indent=2) + "\n", encoding="utf-8")


def add(bench: dict, item: dict) -> dict:
    kept = [old for old in bench["items"] if old["id"] != item["id"]]
    return {**bench, "items": [*kept, item]}


def score(bench: dict) -> float:
    marked = [item for item in bench["items"] if item["mark"] in ("right", "wrong")]
    if not marked:
        return 0.0
    return sum(item["mark"] == "right" for item in marked) / len(marked)
