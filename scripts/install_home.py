"""Install home/AGENTS.md as the user-level instructions of the coding agents on this machine.

    python scripts/install_home.py            # report only: what would change
    python scripts/install_home.py --apply    # write it

home/AGENTS.md is the author's own instructions. Read it before installing it as yours.

With --apply, copies home/AGENTS.md to ~/.claude/AGENTS.md (Claude Code) and ~/.codex/AGENTS.md (Codex),
and moves aside a ~/.claude/CLAUDE.md, which Claude Code would read instead. Any file it replaces or
moves is first kept as <name>.<date-time>.bak beside it. Copies, not links: Windows without Developer
Mode cannot make links.

Exit codes: 0 everything matches or was installed, 1 something differs (report only), 2 home/AGENTS.md
is missing. Needs Python 3.11 or later. Uses only the standard library.
"""

import argparse
import shutil
import sys
from datetime import datetime
from pathlib import Path

SOURCE = Path(__file__).resolve().parent.parent / "home" / "AGENTS.md"
TARGETS = [Path.home() / ".claude" / "AGENTS.md", Path.home() / ".codex" / "AGENTS.md"]
SHADOW = Path.home() / ".claude" / "CLAUDE.md"


def keep(path: Path) -> Path:
    backup = path.with_name(f"{path.name}.{datetime.now():%Y%m%d-%H%M%S}.bak")
    shutil.copy2(path, backup)
    return backup


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Install home/AGENTS.md as every agent's user-level instructions. Reports only unless --apply.",
        epilog="Exit codes: 0 all match or installed, 1 something differs (report only), 2 home/AGENTS.md missing.",
    )
    parser.add_argument(
        "--apply", action="store_true", help="write the copies, keeping a dated backup of anything replaced"
    )
    args = parser.parse_args()
    if not SOURCE.is_file():
        print(f"Error: {SOURCE} is missing.", file=sys.stderr)
        return 2
    text = SOURCE.read_bytes()
    stale = [t for t in TARGETS if not t.is_file() or t.read_bytes() != text]

    if not args.apply:
        for target in TARGETS:
            print(f"{'would replace' if target in stale else 'matches'}: {target}")
        if SHADOW.is_file():
            print(f"would move aside, because Claude Code reads it instead: {SHADOW}")
        if stale or SHADOW.is_file():
            print("Run with --apply to install.")
            return 1
        return 0

    for target in stale:
        target.parent.mkdir(parents=True, exist_ok=True)
        if target.is_file():
            print(f"kept {keep(target)}")
        target.write_bytes(text)
        print(f"installed {target}")
    if SHADOW.is_file():
        print(f"kept {keep(SHADOW)}")
        SHADOW.unlink()
        print(f"moved aside {SHADOW}")
    if not stale and not SHADOW.is_file():
        print("Everything already matches.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
