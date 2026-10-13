import json
from pathlib import Path

DEFAULT_PATH = Path("var/pantry.json")


def load(path: Path = DEFAULT_PATH) -> list[dict]:
    if not path.exists():
        return []
    return json.loads(path.read_text(encoding="utf-8"))


def save(items: list[dict], path: Path = DEFAULT_PATH) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(items, indent=2) + "\n", encoding="utf-8")


def add(items: list[dict], name: str, have: int, want: int) -> list[dict]:
    kept = [item for item in items if item["name"] != name]
    return [*kept, {"name": name, "have": have, "want": want}]
