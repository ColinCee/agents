"""Check every skill in this repository against the rules in AGENTS.md. Reports only: it changes nothing.

    python scripts/validate.py [--root DIR] [--json]

--root   the repository to check (default: the one this script is in)
--json   print JSON instead of text

Exit codes: 0 no errors (warnings allowed), 1 errors found, 2 bad arguments.
Needs Python 3.11 or later. Uses only the standard library.
"""

import argparse
import ast
import json
import re
import subprocess
import sys
import tomllib
from pathlib import Path

# The limits below are the Agent Skills specification's: https://agentskills.io/specification
NAME_MAX = 64
DESCRIPTION_MAX = 1024
DESCRIPTION_AIM = 250  # longer ones were found to be picked less reliably (arXiv 2608.08453)
COMPATIBILITY_MAX = 500
BODY_LINES_MAX = 500
FIELDS = {"name", "description", "license", "compatibility", "metadata", "allowed-tools"}

PYTHON_FLOOR = 11  # 3.11: the oldest CPython that still gets security fixes
MIN_EVALS = 3  # the fewest tasks that show a pattern and not one lucky run
MIN_TRIGGERS_EACH = 8  # about twenty queries in all, half each way
HELP_TIMEOUT = 30  # seconds; --help only prints, so longer than this means it is waiting for input
CONTENTS_OVER = 100  # lines; an agent may read only the top of a longer reference file

NAME = re.compile(r"[a-z0-9]+(-[a-z0-9]+)*")
RESERVED = ("claude", "anthropic")  # refused in a name by Anthropic's own skill uploads
VAGUE = {"helper", "helpers", "utils", "tools", "misc", "stuff"}
FIRST_OR_SECOND_PERSON = re.compile(r"\b(I can|I will|I help|You can|You should)\b")
USE_WHEN = re.compile(r"\buse (this skill |it )?when\b", re.IGNORECASE)
LINK = re.compile(r"\]\(([^)\s#]+)")
NOT_FOR_THE_BODY = re.compile(
    r"(?im)^#+\s*(changelog|installation|install|license|licence|todo)\b|\b(pip|npm|brew|apt(-get)?) install\b|\bTODO\b"
)
BACKSLASH_PATH = re.compile(r"\b(scripts|references|assets|evals)\\\w")
OWN_PATH = re.compile(r"[A-Za-z]:[\\/]+Users[\\/]|/Users/\w|/home/\w")
AGENT_TOOLS = re.compile(
    r"\b(TodoWrite|AskUserQuestion|WebFetch|WebSearch|NotebookEdit|mcp__\w+|(Bash|Read|Edit|Write|Task|Grep|Glob) tool)\b"
)
INLINE_METADATA = re.compile(r"^# /// script\s*$(.*?)^# ///\s*$", re.MULTILINE | re.DOTALL)
PYTHON_VERSION = re.compile(r"Python 3\.(\d+)")


class Report:
    def __init__(self) -> None:
        self.found: list[dict] = []

    def error(self, where: str, what: str) -> None:
        self.found.append({"level": "error", "where": where, "what": what})

    def warn(self, where: str, what: str) -> None:
        self.found.append({"level": "warning", "where": where, "what": what})

    def count(self, level: str) -> int:
        return sum(1 for f in self.found if f["level"] == level)


def read(path: Path) -> str:
    return path.read_text(encoding="utf-8", errors="replace")


def frontmatter(text: str) -> tuple[dict, str, list[str]]:
    """The fields, the body and what was wrong. Reads one-line values and one level of nesting, as the rules ask."""
    lines = text.splitlines()
    if not lines or lines[0].strip() != "---":
        return {}, text, ["SKILL.md does not start with a --- line"]
    try:
        end = lines.index("---", 1)
    except ValueError:
        return {}, text, ["the frontmatter has no closing --- line"]
    fields: dict = {}
    wrong: list[str] = []
    parent = None
    for line in lines[1:end]:
        if not line.strip() or line.lstrip().startswith("#"):
            continue
        key, colon, value = line.strip().partition(":")
        if not colon:
            wrong.append(f"frontmatter line is not `key: value`: {line.strip()!r}")
            continue
        value = value.strip()
        if value[:1] in ("|", ">"):
            wrong.append(f"`{key}` is spread over lines; put the value on one line")
            continue
        if len(value) > 1 and value[0] == value[-1] and value[0] in "\"'":
            value = value[1:-1]
        if line[:1] in (" ", "\t"):
            if isinstance(fields.get(parent), dict):
                fields[parent][key] = value
            else:
                wrong.append(f"`{key}` is indented but is under no field")
        elif value:
            fields[key], parent = value, None
        else:
            fields[key], parent = {}, key
    return fields, "\n".join(lines[end + 1 :]), wrong


def check_frontmatter(skill: Path, fields: dict, report: Report) -> None:
    where = f"{skill.name}/SKILL.md"
    for key in sorted(set(fields) - FIELDS):
        report.error(where, f"`{key}` is not a field of the specification; allowed: {', '.join(sorted(FIELDS))}")

    name = fields.get("name", "")
    if not isinstance(name, str) or not name:
        report.error(where, "`name` is missing")
    else:
        if not NAME.fullmatch(name) or len(name) > NAME_MAX:
            report.error(
                where,
                f"`name` must be lowercase letters, digits and single hyphens, {NAME_MAX} characters at most; got {name!r}",
            )
        if name != skill.name:
            report.error(where, f"`name` is {name!r} but the folder is {skill.name!r}; they must be the same")
        if any(word in name for word in RESERVED):
            report.error(where, f"`name` must not contain {' or '.join(RESERVED)}")
        if set(name.split("-")) & VAGUE:
            report.warn(where, f"`name` {name!r} does not say what the skill does")

    description = fields.get("description", "")
    if not isinstance(description, str) or not description:
        report.error(where, "`description` is missing")
    else:
        if len(description) > DESCRIPTION_MAX:
            report.error(where, f"`description` is {len(description)} characters; the limit is {DESCRIPTION_MAX}")
        if "<" in description or ">" in description:
            report.error(where, "`description` must not contain < or >")
        if len(description) > DESCRIPTION_AIM:
            report.warn(where, f"`description` is {len(description)} characters; aim for {DESCRIPTION_AIM} or fewer")
        if not USE_WHEN.search(description):
            report.error(where, "`description` does not say when to use the skill; add a `Use when ...` sentence")
        if FIRST_OR_SECOND_PERSON.search(description):
            report.error(
                where, "`description` must be in the third person (`Tidies ...`, not `I can ...` or `You can ...`)"
            )

    if fields.get("license") != "MIT":
        report.error(where, "`license` must be MIT")
    compatibility = fields.get("compatibility", "")
    if isinstance(compatibility, str) and len(compatibility) > COMPATIBILITY_MAX:
        report.error(where, f"`compatibility` is {len(compatibility)} characters; the limit is {COMPATIBILITY_MAX}")
    if "metadata" in fields and not isinstance(fields["metadata"], dict):
        report.error(where, "`metadata` must be a map of keys to values")


def check_text(skill: Path, body: str, report: Report) -> None:
    where = f"{skill.name}/SKILL.md"
    lines = body.count("\n") + 1
    if lines > BODY_LINES_MAX:
        report.error(where, f"the body is {lines} lines; the limit is {BODY_LINES_MAX}. Move detail to references/")
    heading = re.search(r"(?m)^#\s+(.+)$", body)
    if heading and heading.group(1).strip().lower().replace(" ", "-") == skill.name:
        report.error(where, "the first heading repeats the name; start with what to do")
    if found := NOT_FOR_THE_BODY.search(body):
        report.error(
            where,
            f"holds install steps, a changelog, licence text or a to-do note ({found.group(0).strip()!r}); take it out",
        )
    for target in LINK.findall(body):
        if "://" in target or target.startswith("mailto:"):
            continue
        if not (skill / target).exists():
            report.error(where, f"links to {target}, which is not in the skill folder")

    for folder in ("scripts", "references", "assets"):
        for path in sorted((skill / folder).rglob("*")) if (skill / folder).is_dir() else []:
            if path.is_file() and "__pycache__" not in path.parts and path.relative_to(skill).as_posix() not in body:
                report.error(
                    where, f"does not name {path.relative_to(skill).as_posix()}; say what it is for and when to use it"
                )

    for path in sorted(skill.rglob("*")):
        if path.suffix not in (".md", ".py") or "evals" in path.relative_to(skill).parts:
            continue
        text = read(path)
        at = f"{skill.name}/{path.relative_to(skill).as_posix()}"
        if BACKSLASH_PATH.search(text):
            report.error(at, "a path uses a backslash; use forward slashes, which work on every system")
        if found := OWN_PATH.search(text):
            report.error(at, f"holds a path on one person's machine ({found.group(0)}...); take it as an argument")
        if path.suffix == ".md":
            if found := AGENT_TOOLS.search(text):
                report.error(at, f"names one agent's tool ({found.group(0)}); say what to do, not which tool does it")
            if path.parent.name == "references" and text.count("\n") > CONTENTS_OVER and "## Contents" not in text:
                report.warn(at, f"is over {CONTENTS_OVER} lines with no `## Contents` list at the top")


def declared_packages(source: str) -> list[str]:
    block = INLINE_METADATA.search(source)
    if not block:
        return []
    toml = "\n".join(line[2:] if line.startswith("# ") else line.lstrip("#") for line in block.group(1).splitlines())
    try:
        return list(tomllib.loads(toml).get("dependencies", []))
    except tomllib.TOMLDecodeError:
        return ["(unreadable)"]


def check_scripts(skill: Path, fields: dict, report: Report) -> None:
    folder = skill / "scripts"
    files = (
        sorted(p for p in folder.rglob("*") if p.is_file() and "__pycache__" not in p.parts) if folder.is_dir() else []
    )
    if not files:
        return
    compatibility = str(fields.get("compatibility", ""))
    version = PYTHON_VERSION.search(compatibility)
    if not version or int(version.group(1)) < PYTHON_FLOOR:
        report.error(
            f"{skill.name}/SKILL.md", f"has scripts, so `compatibility` must say `Python 3.{PYTHON_FLOOR} or later`"
        )

    local = {p.stem for p in files}
    for path in files:
        at = f"{skill.name}/{path.relative_to(skill).as_posix()}"
        if path.suffix != ".py":
            report.error(at, "scripts are Python only")
            continue
        source = read(path)
        try:
            tree = ast.parse(source)
        except SyntaxError as problem:
            report.error(at, f"does not parse: {problem.msg} (line {problem.lineno})")
            continue
        if not ast.get_docstring(tree):
            report.error(at, "has no docstring at the top saying what it does and how to run it")

        imported: set[str] = set()
        for node in ast.walk(tree):
            if isinstance(node, ast.Import):
                imported |= {alias.name.split(".")[0] for alias in node.names}
            elif isinstance(node, ast.ImportFrom) and node.level == 0 and node.module:
                imported.add(node.module.split(".")[0])
            elif isinstance(node, ast.Call) and isinstance(node.func, ast.Name) and node.func.id == "input":
                report.error(
                    at, f"waits for typed input (line {node.lineno}); an agent cannot answer. Take an argument"
                )
        if "argparse" not in imported:
            report.error(at, "does not use argparse, so it has no --help")

        packages = declared_packages(source)
        outside = sorted(imported - sys.stdlib_module_names - local)
        if packages:
            if "uv" not in compatibility.split() and "uv." not in compatibility.split():
                report.error(at, "declares packages, so `compatibility` must say it requires uv")
            for package in packages:
                if "==" not in package:
                    report.error(at, f"package {package!r} has no exact version; write it as name==1.2.3")
        elif outside:
            report.error(
                at,
                f"imports {', '.join(outside)}, which is not in the standard library; declare it with inline metadata or do without",
            )
        else:
            try:
                done = subprocess.run(
                    [sys.executable, str(path), "--help"],
                    capture_output=True,
                    text=True,
                    encoding="utf-8",
                    errors="replace",
                    timeout=HELP_TIMEOUT,
                    stdin=subprocess.DEVNULL,
                )
                if done.returncode != 0:
                    report.error(at, f"--help ended with exit code {done.returncode}")
            except subprocess.TimeoutExpired:
                report.error(at, f"--help did not finish in {HELP_TIMEOUT} seconds")


def load_json(path: Path, at: str, report: Report):
    try:
        return json.loads(read(path))
    except json.JSONDecodeError as problem:
        report.error(at, f"is not valid JSON: {problem.msg} (line {problem.lineno})")
        return None


def check_evals(skill: Path, report: Report) -> None:
    at = f"{skill.name}/evals/evals.json"
    if not (skill / "evals" / "evals.json").is_file():
        report.error(at, f"is missing; write at least {MIN_EVALS} real tasks with what a good result looks like")
    elif (data := load_json(skill / "evals" / "evals.json", at, report)) is not None:
        evals = data.get("evals", []) if isinstance(data, dict) else []
        good = [e for e in evals if isinstance(e, dict) and e.get("prompt") and e.get("expected_output")]
        if len(good) < MIN_EVALS or len(good) != len(evals):
            report.error(
                at,
                f"needs at least {MIN_EVALS} evals, each with `prompt` and `expected_output`; found {len(good)} complete of {len(evals)}",
            )

    at = f"{skill.name}/evals/triggers.json"
    if not (skill / "evals" / "triggers.json").is_file():
        report.warn(at, "is missing; the description has not been tested against what users type")
    elif (data := load_json(skill / "evals" / "triggers.json", at, report)) is not None:
        queries = [q for q in data if isinstance(q, dict) and q.get("query")] if isinstance(data, list) else []
        should = sum(1 for q in queries if q.get("should_trigger") is True)
        should_not = sum(1 for q in queries if q.get("should_trigger") is False)
        if should < MIN_TRIGGERS_EACH or should_not < MIN_TRIGGERS_EACH:
            report.warn(
                at,
                f"has {should} queries that should load the skill and {should_not} that should not; aim for {MIN_TRIGGERS_EACH} of each",
            )


def check(root: Path) -> Report:
    report = Report()
    home = root / "skills"
    skills = sorted(p for p in home.iterdir() if p.is_dir() and not p.name.startswith(".")) if home.is_dir() else []
    # Not yet measured: checked like the rest, but not listed in the README.
    drafts = (
        sorted(p for p in (home / ".experimental").iterdir() if p.is_dir()) if (home / ".experimental").is_dir() else []
    )
    skills += drafts
    if not skills:
        report.error("skills/", "no skill folders found")
    readme = read(root / "README.md") if (root / "README.md").is_file() else ""
    for skill in skills:
        if not (skill / "SKILL.md").is_file():
            report.error(f"{skill.name}/", "has no SKILL.md")
            continue
        fields, body, wrong = frontmatter(read(skill / "SKILL.md"))
        for what in wrong:
            report.error(f"{skill.name}/SKILL.md", what)
        check_frontmatter(skill, fields, report)
        check_text(skill, body, report)
        check_scripts(skill, fields, report)
        check_evals(skill, report)
        if skill not in drafts and f"skills/{skill.name}/SKILL.md" not in readme:
            report.error("README.md", f"does not list {skill.name}; add a row to the table of skills")
    return report


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Check every skill in this repository against the rules in AGENTS.md. Reports only.",
        epilog="Exit codes: 0 no errors (warnings allowed), 1 errors found, 2 bad arguments.",
    )
    parser.add_argument(
        "--root",
        type=Path,
        default=Path(__file__).resolve().parent.parent,
        help="the repository to check (default: the one this script is in)",
    )
    parser.add_argument("--json", action="store_true", help="print JSON instead of text")
    args = parser.parse_args()
    if not args.root.is_dir():
        parser.error(f"--root {args.root} is not a folder")

    report = check(args.root)
    errors, warnings = report.count("error"), report.count("warning")
    if args.json:
        print(json.dumps({"errors": errors, "warnings": warnings, "found": report.found}, indent=2))
    else:
        for f in report.found:
            print(f"{f['level'].upper():8}{f['where']}: {f['what']}")
        print(f"{errors} errors, {warnings} warnings")
    return 1 if errors else 0


if __name__ == "__main__":
    sys.exit(main())
