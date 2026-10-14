"""List what the user typed in past coding-agent sessions, each with the end of the agent's reply before it.

    python prompts.py [ROOT ...] [--since YYYY-MM-DD] [--context N] [--limit N] [--json]

ROOT        folders of session transcripts (.jsonl). Default: ~/.claude/projects and ~/.codex/sessions,
            where they exist.
--since     only prompts on or after this date (default: 14 days ago)
--context   characters of the agent's reply kept before each prompt (default 200)
--limit     the most prompts printed (default 3000); the rest are counted
--json      one JSON object per line in place of text

Reads only; writes nothing. Anything that looks like a key or token is replaced with [secret removed],
so it cannot be copied on into a report.
Exit codes: 0 done, 1 no transcripts found, 2 bad arguments.
"""

import argparse
import json
import re
import sys
from datetime import date, timedelta
from pathlib import Path

DEFAULT_DAYS = 14  # two weeks: long enough for a correction to come back, short enough to read in one pass
DEFAULT_CONTEXT = 200  # enough of the agent's last reply to see what was being corrected
DEFAULT_LIMIT = 3000  # about two weeks of heavy use; more is cut with a count
PROMPT_CHARS = 600  # long pastes are cut; the start says what was asked

SECRETS = re.compile(
    r"gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|sk-[A-Za-z0-9_-]{20,}|xox[abprs]-[A-Za-z0-9-]{10,}"
    r"|AKIA[0-9A-Z]{16}|AIza[0-9A-Za-z_-]{30,}|-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----"
    r"|\b[A-Za-z0-9+/_-]{40,}\b"
)


def clean(text: str) -> str:
    text = re.sub(r"<system-reminder>[\s\S]*?</system-reminder>", "", text)
    text = SECRETS.sub("[secret removed]", text)
    return re.sub(r"\s+", " ", text).strip()


def text_of(content) -> str:
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        return " ".join(
            part.get("text", "")
            for part in content
            if isinstance(part, dict) and part.get("type") in ("text", "input_text", "output_text")
        )
    return ""


def turns(path: Path):
    """(role, timestamp, cwd, text) for each message in one transcript, in Claude Code's or Codex's format."""
    for line in path.open(encoding="utf-8", errors="replace"):
        try:
            e = json.loads(line)
        except json.JSONDecodeError:
            continue
        if not isinstance(e, dict) or e.get("isSidechain"):
            continue
        payload = e.get("payload") if isinstance(e.get("payload"), dict) else {}
        if e.get("type") in ("user", "assistant"):
            message = e.get("message") or {}
            role, content = e["type"], message.get("content")
            if (
                role == "user"
                and isinstance(content, list)
                and any(isinstance(p, dict) and p.get("type") == "tool_result" for p in content)
            ):
                continue
        elif payload.get("type") == "message" and payload.get("role") in ("user", "assistant"):
            role, content = payload["role"], payload.get("content")
        else:
            continue
        text = text_of(content)
        if text.strip():
            yield role, str(e.get("timestamp", "")), str(e.get("cwd") or payload.get("cwd") or ""), text


def main() -> int:
    parser = argparse.ArgumentParser(
        description="List what the user typed in past coding-agent sessions.",
        epilog="Reads only. Exit codes: 0 done, 1 no transcripts found, 2 bad arguments.",
    )
    parser.add_argument("roots", nargs="*", type=Path, help="folders of .jsonl transcripts")
    parser.add_argument("--since", help="YYYY-MM-DD (default: 14 days ago)")
    parser.add_argument(
        "--context",
        type=int,
        default=DEFAULT_CONTEXT,
        help=f"characters of the reply before each prompt (default {DEFAULT_CONTEXT})",
    )
    parser.add_argument(
        "--limit", type=int, default=DEFAULT_LIMIT, help=f"the most prompts printed (default {DEFAULT_LIMIT})"
    )
    parser.add_argument("--json", action="store_true", help="one JSON object per line")
    args = parser.parse_args()
    try:
        since = date.fromisoformat(args.since) if args.since else date.today() - timedelta(days=DEFAULT_DAYS)
    except ValueError:
        parser.error(f"--since {args.since!r} is not a date like 2026-10-01")

    roots = args.roots or [
        p for p in (Path.home() / ".claude" / "projects", Path.home() / ".codex" / "sessions") if p.is_dir()
    ]
    files = sorted(f for root in roots for f in root.rglob("*.jsonl"))
    if not files:
        print(
            f"No .jsonl transcripts under {', '.join(map(str, roots)) or 'the default folders'}. Pass the folder your agent keeps sessions in.",
            file=sys.stderr,
        )
        return 1

    rows = []
    for f in files:
        before = ""
        for role, ts, cwd, text in turns(f):
            if role == "assistant":
                before = text
                continue
            if text.lstrip().startswith("<") or ts[:10] < since.isoformat():
                continue
            prompt = clean(text)
            if prompt:
                rows.append(
                    {
                        "session": f.stem,
                        "project": Path(cwd).name if cwd else f.parent.name,
                        "date": ts[:10],
                        "prompt": prompt[:PROMPT_CHARS],
                        "before": clean(before)[-args.context :] if args.context else "",
                    }
                )
    rows.sort(key=lambda r: (r["date"], r["session"]))
    sessions = {r["session"] for r in rows}
    projects = {r["project"] for r in rows}
    print(f"{len(rows)} prompts in {len(sessions)} sessions, {len(projects)} projects, since {since}", file=sys.stderr)
    for r in rows[: args.limit]:
        if args.json:
            print(json.dumps(r, ensure_ascii=False))
        else:
            print(
                f"{r['date']} {r['project']}/{r['session']} | {r['prompt']}"
                + (f"  || before: {r['before']}" if r["before"] else "")
            )
    if len(rows) > args.limit:
        print(f"... {len(rows) - args.limit} more not shown; narrow --since or raise --limit", file=sys.stderr)
    return 0


if __name__ == "__main__":
    sys.exit(main())
