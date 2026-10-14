"""Install home/AGENTS.md as the user-level instructions of every coding agent on this machine.

    python scripts/install_home.py [--check]

Copies home/AGENTS.md to ~/.claude/AGENTS.md (Claude Code) and ~/.codex/AGENTS.md (Codex), and moves
aside a ~/.claude/CLAUDE.md, which Claude Code would read instead. Copies, not links: Windows without
Developer Mode cannot make links.

--check   change nothing; say whether every copy matches, and exit 1 if one does not

Exit codes: 0 done or all match, 1 a copy differs (--check), 2 home/AGENTS.md is missing.
Needs Python 3.11 or later. Uses only the standard library.
"""

import argparse
import shutil
import sys
from pathlib import Path

SOURCE = Path(__file__).resolve().parent.parent / "home" / "AGENTS.md"
TARGETS = [Path.home() / ".claude" / "AGENTS.md", Path.home() / ".codex" / "AGENTS.md"]
SHADOW = Path.home() / ".claude" / "CLAUDE.md"


def main() -> int:
    parser = argparse.ArgumentParser(description="Install home/AGENTS.md as every agent's user-level instructions.")
    parser.add_argument("--check", action="store_true", help="change nothing; report whether the copies match")
    args = parser.parse_args()
    if not SOURCE.is_file():
        print(f"Error: {SOURCE} is missing.", file=sys.stderr)
        return 2
    text = SOURCE.read_bytes()
    stale = [t for t in TARGETS if not t.is_file() or t.read_bytes() != text]
    if args.check:
        for target in TARGETS:
            print(f"{'differs' if target in stale else 'matches'}: {target}")
        if SHADOW.is_file():
            print(f"shadows them: {SHADOW}")
        return 1 if stale or SHADOW.is_file() else 0
    for target in TARGETS:
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(text)
        print(f"installed {target}")
    if SHADOW.is_file():
        moved = SHADOW.with_name("CLAUDE.md.bak")
        shutil.move(SHADOW, moved)
        print(f"moved {SHADOW} to {moved}, because Claude Code would read it instead")
    return 0


if __name__ == "__main__":
    sys.exit(main())
