"""Run a command with no console window, writing its output to a file. For Windows desktops, where a program
started without a console gets a terminal window of its own; start this with `pythonw` so it has none either.

    pythonw scripts/run_hidden.py OUT -- COMMAND [ARGS ...]

OUT gets the command's output, then a last line `exit N`. Exit codes: the command's own, 2 bad arguments.
"""

import os
import subprocess
import sys


def main() -> int:
    if "--" not in sys.argv or sys.argv.index("--") != 2 or len(sys.argv) < 4:
        print(__doc__, file=sys.stderr)
        return 2
    out, command = sys.argv[1], sys.argv[3:]
    flags = subprocess.CREATE_NO_WINDOW if sys.platform == "win32" else 0
    env = {**os.environ, "PYTHONUTF8": "1", "PYTHONIOENCODING": "utf-8"}
    with open(out, "w", encoding="utf-8") as f:
        code = subprocess.run(
            command, stdout=f, stderr=subprocess.STDOUT, creationflags=flags, env=env, check=False
        ).returncode
    with open(out, "a", encoding="utf-8") as f:
        f.write(f"\nexit {code}\n")
    return code


if __name__ == "__main__":
    sys.exit(main())
