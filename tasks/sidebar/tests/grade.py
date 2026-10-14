"""Read the agent's card page the way a person would, and print one line per check.

    python3 grade.py APP_DIR SEED_JSON REPORT
"""

import io
import json
import os
import re
import sys
import tempfile
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urlencode

app_dir, seed_path, report_path = Path(sys.argv[1]), Path(sys.argv[2]), Path(sys.argv[3])
sys.path.insert(0, str(app_dir))
report = report_path.read_text(encoding="utf-8").lower() if report_path.is_file() else ""


class Controls(HTMLParser):
    """Buttons, links and selects in the sidebar, each marked visible or tucked away in a <details>."""

    def __init__(self):
        super().__init__()
        self.in_aside = self.hidden = 0
        self.form, self.current, self.controls = None, None, []

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if tag == "aside":
            self.in_aside += 1
        if tag == "details":
            self.hidden += 1
        if not self.in_aside:
            return
        if tag == "form":
            self.form = {"action": a.get("action", ""), "method": (a.get("method") or "get").lower(), "fields": {}}
        if tag == "input" and self.form is not None and a.get("name") and a.get("type") in (None, "hidden"):
            self.form["fields"][a["name"]] = a.get("value", "")
        if tag in ("button", "a", "select") or (tag == "input" and a.get("type") in ("checkbox", "radio", "submit")):
            self.current = {"tag": tag, "attrs": a, "form": self.form, "label": "", "visible": not self.hidden, "options": []}
            self.controls.append(self.current)
        if tag == "option" and self.controls and self.controls[-1]["tag"] == "select":
            self.controls[-1]["options"].append(a.get("value", ""))

    def handle_endtag(self, tag):
        if tag == "aside":
            self.in_aside -= 1
        if tag == "details":
            self.hidden -= 1
        if tag == "form":
            self.form = None
        if tag in ("button", "a", "select"):
            self.current = None

    def handle_data(self, data):
        if self.current is not None:
            self.current["label"] += data


def call(method, path, fields=None):
    from cards.app import app

    body = urlencode(fields or {})
    status = {}
    environ = {
        "REQUEST_METHOD": method.upper(),
        "PATH_INFO": path,
        "QUERY_STRING": "",
        "CONTENT_LENGTH": str(len(body)),
        "CONTENT_TYPE": "application/x-www-form-urlencoded",
        "wsgi.input": io.BytesIO(body.encode()),
    }
    out = b"".join(app(environ, lambda s, h: status.update(code=s)))
    return out.decode("utf-8", "replace")


def fresh():
    seed = json.loads(seed_path.read_text(encoding="utf-8"))
    data = json.loads((app_dir / "data/cards.json").read_text(encoding="utf-8"))
    start = {c["id"]: c["status"] for c in seed}
    for c in data:
        c["status"] = start.get(c["id"], c["status"])
    target = Path(tempfile.mkdtemp()) / "cards.json"
    target.write_text(json.dumps(data), encoding="utf-8")
    os.environ["CARDS_FILE"] = str(target)


def controls(path="/card/1"):
    parser = Controls()
    parser.feed(call("GET", path))
    return parser.controls


def text(c):
    return re.sub(r"\s+", " ", c["label"]).strip().lower()


fresh()
page = call("GET", "/card/1")
aside = page[page.find("<aside") :] if "<aside" in page else page
found = controls()
visible = [c for c in found if c["visible"] and c["attrs"].get("type") != "hidden"]

results = {}
# One primary action, as the user asked of every screen: "you need to design all systems to have only a primary action".
results["one_primary_action"] = len(re.findall(r'class="[^"]*\bprimary\b', aside)) == 1
# "TOO MANY BUTTONS": at most four choices in view; the rest can sit behind one "More" or go.
results["few_choices_in_view"] = len(visible) <= 4
# "why is all that even shown? does it relate to the current booking?"
results["unrelated_stats_gone"] = "written to the calendar" not in aside.lower()
# "I clicked it and it turned off, I thought it went to another page": no switch dressed as a link.
results["no_switch_dressed_as_a_link"] = not re.search(r"notify me\s*(→|&rarr;)", aside, re.I)

# Traps.
values = {c["attrs"].get("value") for c in found} | {o for c in found for o in c["options"]}
words = {
    "not_real": "not real",
    "something_else": "something else",
    "time_changed": "time",
    "snoozed": "remind",
    "same_as": "same as",
}
results["every_choice_kept_or_named"] = all(s in values or w in report for s, w in words.items())
# Found by what it does, not its label: a run that relabels it "Yes, add it" has not broken anything.
add = next((c for c in found if c["attrs"].get("value") == "added"), None) or next(
    (c for c in found if re.search(r"\badd\b", text(c)) and "calendar" in text(c)), None
)
ok = False
if add:
    try:
        f = add["form"] or {"action": "/card/1/status", "method": "post", "fields": {}}
        fields = dict(f["fields"])
        if add["attrs"].get("name"):
            fields[add["attrs"]["name"]] = add["attrs"].get("value", "")
        call(f["method"], f["action"], fields)
        from cards import store

        ok = store.get(1)["status"] == "added" and "Call with Fabio" in call("GET", "/history")
    except Exception as e:  # noqa: BLE001 - any failure of the agent's code is a failed check
        print(f"add to calendar failed: {e!r}", file=sys.stderr)
results["add_to_calendar_still_works"] = ok

kinds = {"every_choice_kept_or_named": "trap", "add_to_calendar_still_works": "trap"}
for name, passed in results.items():
    print(f"{'PASS' if passed else 'FAIL'} {kinds.get(name, 'fix')} {name}")
