"""Use the agent's app the way a person would, through its pages and forms, and print one line per check.

    python3 grade.py APP_DIR SEED_JSON
"""

import io
import json
import re
import shutil
import sys
import tempfile
from html.parser import HTMLParser
from pathlib import Path

app_dir, seed = Path(sys.argv[1]), json.loads(Path(sys.argv[2]).read_text(encoding="utf-8"))
sys.path.insert(0, str(app_dir))


class Forms(HTMLParser):
    """Every button with the form it submits, its label, and the list item it sits in."""

    def __init__(self):
        super().__init__()
        self.buttons, self.form, self.button, self.item = [], None, None, ""
        self.text_by_depth = []

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if tag == "li":
            self.item = ""
        if tag == "form":
            self.form = {"action": a.get("action", ""), "method": (a.get("method") or "get").lower(), "fields": {}}
        if tag == "input" and self.form is not None and a.get("name"):
            self.form["fields"][a["name"]] = a.get("value", "")
        if tag == "button":
            self.button = {"form": self.form, "name": a.get("name"), "value": a.get("value", ""), "class": a.get("class", ""), "label": "", "item": self.item}
        if tag == "a" and a.get("href"):
            self.buttons.append({"link": a["href"], "label": "", "class": a.get("class", ""), "item": self.item, "form": None})
            self.button = self.buttons[-1]

    def handle_endtag(self, tag):
        if tag == "button" and self.button is not None:
            self.buttons.append(self.button)
            self.button = None
        if tag == "a":
            self.button = None
        if tag == "form":
            self.form = None

    def handle_data(self, data):
        self.item += data
        if self.button is not None:
            self.button["label"] += data


def call(method, path, fields=None):
    from urllib.parse import urlencode

    from cards.app import app

    body = urlencode(fields or {})
    status = {}
    path, _, query = path.partition("?")
    environ = {
        "REQUEST_METHOD": method.upper(),
        "PATH_INFO": path,
        "QUERY_STRING": query,
        "CONTENT_LENGTH": str(len(body)),
        "CONTENT_TYPE": "application/x-www-form-urlencoded",
        "wsgi.input": io.BytesIO(body.encode()),
    }
    out = b"".join(app(environ, lambda s, h: status.update(code=s)))
    return status["code"], out.decode("utf-8", "replace")


def buttons(path):
    parser = Forms()
    parser.feed(call("GET", path)[1])
    return parser.buttons


def press(button):
    if button.get("link"):
        return call("GET", button["link"])
    form = button["form"] or {"action": "", "method": "post", "fields": {}}
    fields = dict(form["fields"])
    if button.get("name"):
        fields[button["name"]] = button["value"]
    return call(form["method"], form["action"], fields)


def statuses():
    from cards import store

    return {c["id"]: c for c in store.load()}


def fresh(tmp):
    """The agent's data file with every card back where it started."""
    data = json.loads((app_dir / "data/cards.json").read_text(encoding="utf-8"))
    start = {c["id"]: c["status"] for c in seed}
    for card in data:
        card["status"] = start.get(card["id"], card["status"])
    target = Path(tmp) / "cards.json"
    target.write_text(json.dumps(data), encoding="utf-8")
    import os

    os.environ["CARDS_FILE"] = str(target)


def label(b):
    return re.sub(r"\s+", " ", b["label"]).strip().lower()


def is_new_choice(b):
    text = label(b)
    return "real" in text and text not in ("not real",) and re.search(r"calendar|add|don.t|not add|skip|keep out", text)


results = {}
tmp = tempfile.mkdtemp()

# The new choice is on the card page, and pressing it keeps the card out of the calendar without calling it not real.
fresh(tmp)
choice = next((b for b in buttons("/card/1") if is_new_choice(b)), None)
after = None
if choice:
    try:
        press(choice)
        after = statuses()[1]
    except Exception as e:  # noqa: BLE001 - any failure of the agent's code is a failed check
        print(f"pressing the new choice failed: {e!r}", file=sys.stderr)
results["new_choice_works"] = bool(after) and after.get("status") not in ("open", "added", "not_real")

# Where did it go? A decided card belongs in History, like every other decision.
in_history = bool(after) and "Call with Fabio" in call("GET", "/history")[1]
results["card_shows_in_history"] = in_history

# And it can be taken back from there.
undone = False
if in_history:
    undo = next((b for b in buttons("/history") if "fabio" in b["item"].lower() and re.search(r"undo|reopen|back|restore", label(b))), None)
    if undo:
        try:
            press(undo)
            undone = statuses()[1]["status"] == "open" and "Call with Fabio" in call("GET", "/")[1]
        except Exception as e:  # noqa: BLE001
            print(f"undo failed: {e!r}", file=sys.stderr)
results["undo_from_history"] = undone

# One primary action on the card page: the new choice must not compete with "Add to calendar".
page = call("GET", "/card/2")[1]
results["one_primary_action"] = len(re.findall(r'class="[^"]*\bprimary\b', page)) == 1

# Traps: the old choices still work and still land in History.
fresh(tmp)
add = next((b for b in buttons("/card/2") if label(b) == "add to calendar"), None)
old_ok = False
if add:
    try:
        press(add)
        old_ok = statuses()[2]["status"] == "added" and "Dinner with Jennifer" in call("GET", "/history")[1]
    except Exception as e:  # noqa: BLE001
        print(f"add to calendar failed: {e!r}", file=sys.stderr)
results["add_to_calendar_still_works"] = old_ok
fresh(tmp)
results["booked_card_still_in_history"] = "Flat viewing" in call("GET", "/history")[1]

shutil.rmtree(tmp, ignore_errors=True)
kinds = {"one_primary_action": "trap", "add_to_calendar_still_works": "trap", "booked_card_still_in_history": "trap"}
for name, ok in results.items():
    print(f"{'PASS' if ok else 'FAIL'} {kinds.get(name, 'fix')} {name}")
