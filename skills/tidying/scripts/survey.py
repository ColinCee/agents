"""Survey a git repository before tidying it. Reports only: it changes and deletes nothing.

    python survey.py [repo] [--also DIR ...] [--days N] [--big MB] [--json]

repo     the repository to look at (default: the current folder)
--also   a folder outside the repository to size up as well (a data or cache folder); may be given more than once
--days   what counts as old, in days (default 14)
--big    what counts as a big file, in MB (default 5)
--json   print JSON instead of text

Needs Python 3.11 or later and git. Uses only the standard library.
"""

import argparse
import json
import os
import subprocess
import sys
import time
from pathlib import Path

SKIP = {
    ".git",
    "node_modules",
    ".venv",
    "venv",
    "__pycache__",
    ".mypy_cache",
    ".ruff_cache",
    ".pytest_cache",
    "dist",
    "build",
    "target",
}


def git(repo: Path, *args: str) -> list[str]:
    """The lines git prints, or none when it fails (not a repository, no remote, an old git)."""
    try:
        done = subprocess.run(
            ["git", "-C", str(repo), *args],
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
            timeout=60,
        )
    except (OSError, subprocess.TimeoutExpired):
        return []
    return [line for line in done.stdout.splitlines() if line.strip()] if done.returncode == 0 else []


def default_branch(repo: Path) -> str:
    head = git(repo, "symbolic-ref", "--short", "refs/remotes/origin/HEAD")
    if head:
        return head[0].split("/", 1)[-1]
    names = {line.strip("* ").strip() for line in git(repo, "branch", "--format=%(refname:short)")}
    return next((n for n in ("main", "master") if n in names), "")


def size_of(folder: Path) -> tuple[int, int]:
    """Bytes and files under a folder, without following links."""
    total = count = 0
    for root, _dirs, files in os.walk(folder, onerror=lambda _e: None):
        for name in files:
            try:
                total += os.lstat(os.path.join(root, name)).st_size
                count += 1
            except OSError:
                pass
    return total, count


def mb(size: int) -> float:
    return round(size / 1_048_576, 1)


def repo_facts(repo: Path, days: int, big_mb: int) -> dict:
    now = time.time()
    main = default_branch(repo)
    status = git(repo, "status", "--porcelain")
    branches = []
    for line in git(
        repo, "for-each-ref", "refs/heads", "--format=%(refname:short)\t%(committerdate:unix)\t%(upstream:track)"
    ):
        name, when, track = (line.split("\t") + ["", ""])[:3]
        if name == main:
            continue
        ahead = git(repo, "rev-list", "--count", f"{main}..{name}") if main else []
        branches.append(
            {
                "name": name,
                "days_old": int((now - int(when or 0)) / 86400),
                "commits_not_in_default": int(ahead[0]) if ahead else None,
                "upstream_gone": "gone" in track,
            }
        )
    worktrees = [
        line.split(" ", 1)[1] for line in git(repo, "worktree", "list", "--porcelain") if line.startswith("worktree ")
    ][1:]
    big = []
    for line in git(repo, "ls-files", "-z"):
        for name in line.split("\0"):
            try:
                size = (repo / name).stat().st_size if name else 0
            except OSError:
                continue
            if size >= big_mb * 1_048_576:
                big.append({"file": name, "mb": mb(size)})
    ignored = []
    for line in git(repo, "status", "--porcelain", "--ignored"):
        if line.startswith("!! "):
            path = repo / line[3:].strip('"')
            if path.name.rstrip("/") in SKIP:
                continue
            size, count = size_of(path) if path.is_dir() else (path.stat().st_size if path.exists() else 0, 1)
            if size >= big_mb * 1_048_576:
                ignored.append({"path": line[3:], "mb": mb(size), "files": count})
    last = git(repo, "log", "-1", "--format=%ct")
    return {
        "repo": str(repo),
        "default_branch": main,
        "days_since_last_commit": int((now - int(last[0])) / 86400) if last else None,
        "uncommitted": [s for s in status if not s.startswith("??")],
        "untracked": [s[3:] for s in status if s.startswith("??")],
        "stashes": len(git(repo, "stash", "list")),
        "unpushed_commits": len(git(repo, "log", "--oneline", "@{upstream}..HEAD")),
        "other_branches": branches,
        "other_worktrees": worktrees,
        "big_tracked_files": sorted(big, key=lambda b: -b["mb"]),
        "big_ignored_paths": sorted(ignored, key=lambda b: -b["mb"]),
        "old_means_days": days,
    }


def folder_facts(folder: Path, days: int) -> dict:
    """What is in a folder outside the repository: each entry's size, and how long since anything in it changed."""
    now, rows = time.time(), []
    if not folder.is_dir():
        return {"folder": str(folder), "error": "not a folder"}
    for entry in sorted(folder.iterdir()):
        try:
            if entry.is_dir() and not entry.is_symlink():
                size, count = size_of(entry)
                newest = max(
                    (os.lstat(os.path.join(r, f)).st_mtime for r, _d, fs in os.walk(entry) for f in fs),
                    default=entry.stat().st_mtime,
                )
            else:
                size, count, newest = entry.lstat().st_size, 1, entry.lstat().st_mtime
        except OSError:
            continue
        age = int((now - newest) / 86400)
        rows.append(
            {
                "name": entry.name + ("/" if entry.is_dir() else ""),
                "mb": mb(size),
                "files": count,
                "days_untouched": age,
                "old": age >= days,
            }
        )
    return {
        "folder": str(folder),
        "total_mb": round(sum(r["mb"] for r in rows), 1),
        "entries": sorted(rows, key=lambda r: -r["mb"]),
    }


def as_text(out: dict) -> str:
    r, lines = out["repo"], []
    lines.append(
        f"Repository: {r['repo']} (default branch: {r['default_branch'] or 'unknown'}, last commit {r['days_since_last_commit']} days ago)"
    )
    lines.append(
        f"Uncommitted changes: {len(r['uncommitted'])}   Untracked: {len(r['untracked'])}   Stashes: {r['stashes']}   Commits not pushed: {r['unpushed_commits']}"
    )
    for name in r["untracked"][:20]:
        lines.append(f"  untracked: {name}")
    for b in r["other_branches"]:
        notes = [f"{b['days_old']} days old"]
        if b["commits_not_in_default"] == 0:
            notes.append("nothing the default branch lacks")
        elif b["commits_not_in_default"]:
            notes.append(f"{b['commits_not_in_default']} commits not in the default branch")
        if b["upstream_gone"]:
            notes.append("its remote branch is gone")
        lines.append(f"  branch {b['name']}: {', '.join(notes)}")
    for w in r["other_worktrees"]:
        lines.append(f"  worktree: {w}")
    for f in r["big_tracked_files"][:20]:
        lines.append(f"  big file in git: {f['file']} ({f['mb']} MB)")
    for f in r["big_ignored_paths"][:20]:
        lines.append(f"  big and ignored by git: {f['path']} ({f['mb']} MB, {f['files']} files)")
    for folder in out["also"]:
        if "error" in folder:
            lines.append(f"\n{folder['folder']}: {folder['error']}")
            continue
        lines.append(f"\n{folder['folder']}: {folder['total_mb']} MB")
        for e in folder["entries"][:40]:
            lines.append(
                f"  {e['mb']:>10} MB  {e['days_untouched']:>4} days untouched  {e['name']}"
                + ("  (old)" if e["old"] else "")
            )
    lines.append("\nNothing was changed. This is a report.")
    return "\n".join(lines)


def main() -> int:
    ap = argparse.ArgumentParser(description="Survey a git repository before tidying it. Reports only.")
    ap.add_argument("repo", nargs="?", default=".")
    ap.add_argument("--also", action="append", default=[], metavar="DIR")
    ap.add_argument("--days", type=int, default=14)
    ap.add_argument("--big", type=int, default=5, metavar="MB")
    ap.add_argument("--json", action="store_true")
    args = ap.parse_args()
    repo = Path(args.repo).expanduser().resolve()
    top = git(repo, "rev-parse", "--show-toplevel")
    if not top:
        print(f"{repo} is not a git repository (or git is not installed)", file=sys.stderr)
        return 2
    out = {
        "repo": repo_facts(Path(top[0]), args.days, args.big),
        "also": [folder_facts(Path(d).expanduser(), args.days) for d in args.also],
    }
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    print(json.dumps(out, indent=2) if args.json else as_text(out))
    return 0


if __name__ == "__main__":
    sys.exit(main())
