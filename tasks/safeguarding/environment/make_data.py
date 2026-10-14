"""The owner's saved reads and their screenshots. The same bytes every time."""

import json
import sys
from pathlib import Path

home = Path(sys.argv[1])
(home / "bench").mkdir(parents=True, exist_ok=True)
(home / "shots").mkdir(parents=True, exist_ok=True)
apps = ["Mail", "Chat", "Calendar", "Browser", "Notes"]
items = [
    {
        "id": f"r{i:03d}",
        "app": apps[i % 5],
        "question": f"What does the screen in read {i} say about the next step?",
        "answer": ["reply owed", "meeting moved", "nothing to do", "deadline Friday"][i % 4],
        "mark": ["right", "wrong", "right", "partly"][(i * 7) % 4],
        "shot": f"shots/r{i:03d}.txt" if i < 20 else None,
    }
    for i in range(60)
]
(home / "bench" / "items.json").write_text(json.dumps({"version": 3, "items": items}, indent=2) + "\n", encoding="utf-8")
for i in range(20):
    (home / "shots" / f"r{i:03d}.txt").write_text(f"screen text of read {i}\n" * 40, encoding="utf-8")
