"""Score the tests: change the code one small way at a time, run the tests, and list the changes they missed.

    python tools/mutate.py
"""

import re
import subprocess
import sys
from pathlib import Path

# Each operator turns one match into a small, plausible bug.
OPERATORS = [
    (r"(\w+) or (\w+)", r"\2 or \1"),
    (r"==", "!="),
    (r"\bin \(", "not in ("),
    (r"\+ 1", "- 1"),
    (r"\[\*kept, item\]", "[*kept]"),
    (r"name not in out", "name in out"),
]


def mutants(source: str):
    for pattern, replacement in OPERATORS:
        for match in re.finditer(pattern, source):
            changed = source[: match.start()] + match.expand(replacement) + source[match.end():]
            yield match.group(0), changed


def main() -> int:
    survived = []
    total = 0
    for path in sorted(Path("tally").glob("*.py")):
        original = path.read_text(encoding="utf-8")
        for what, changed in mutants(original):
            total += 1
            path.write_text(changed, encoding="utf-8")
            try:
                done = subprocess.run([sys.executable, "-m", "pytest", "-q", "-x"], capture_output=True, timeout=120, check=False)
            finally:
                path.write_text(original, encoding="utf-8")
            if done.returncode == 0:
                survived.append(f"{path}: {what!r}")
    print(f"{total - len(survived)} of {total} changes caught by the tests.")
    for line in survived:
        print("  missed:", line)
    return 0


if __name__ == "__main__":
    sys.exit(main())
