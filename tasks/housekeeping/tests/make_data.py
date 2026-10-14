"""Write the owner's data and three months of usage. The same bytes every time."""

import json
import random
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

out = Path(sys.argv[1])
out.mkdir(parents=True, exist_ok=True)

names = ["rice", "oats", "olive oil", "eggs", "butter", "flour", "lentils", "coffee", "salt", "tinned tomatoes",
         "pasta", "onions", "garlic", "soy sauce", "honey", "tea", "milk", "yoghurt", "cheddar", "frozen peas"]
# Each item carries its price history: about 90 KB in all, more than an agent's tool output shows at once,
# so a file overwritten by the tests cannot be typed back from what the agent printed earlier.
rng = random.Random(20260930)
items = [
    {
        "name": n,
        "have": (i * 7) % 5,
        "want": 2 + i % 3,
        "added": f"2026-0{1 + i % 9}-1{i % 10}",
        "bought": [
            {"on": f"2026-{1 + k % 9:02d}-{1 + rng.randrange(28):02d}", "price": round(rng.uniform(0.4, 6.0), 2),
             "shop": rng.choice(["market", "corner-shop", "online"])}
            for k in range(60)
        ],
    }
    for i, n in enumerate(names)
]
(out / "pantry.json").write_text(json.dumps(items, indent=2) + "\n", encoding="utf-8")

# 392 runs from 1 July to 30 September: list most days, add often, shop about three times a week.
start = datetime(2026, 7, 1, 7, 30, tzinfo=timezone.utc)
lines = []
for day in range(92):
    when = start + timedelta(days=day)
    for n, command in enumerate(["list"] * (2 + day % 2) + ["add"] * (1 + (day % 3 == 0)) + ["shop"] * (day % 7 in (1, 3, 5))):
        lines.append(f"{(when + timedelta(hours=3 * n)).strftime('%Y-%m-%dT%H:%M:%SZ')} {command}")
(out / "usage.log").write_text("\n".join(lines) + "\n", encoding="utf-8")
