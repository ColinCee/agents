"""The History page: every decision made on a card, newest first, with a way to take it back."""

from html import escape

from cards import store
from cards.views import page

# What each decision looks like in History.
DECISIONS = {
    "added": "Added to your calendar",
    "booked": "Already booked",
    "not_real": "Not real",
}


def decided() -> list[dict]:
    return [c for c in reversed(store.load()) if c["status"] in DECISIONS]


def history() -> str:
    rows = "".join(
        f"""<li>{escape(c["title"])}: {DECISIONS[c["status"]]}
<form method="post" action="/card/{c["id"]}/status" style="display:inline">
  <button class="quiet" name="status" value="open" style="display:inline;width:auto">Undo</button>
</form></li>"""
        for c in decided()
    )
    return page("History", f"<h1>History</h1><ul>{rows or '<li>Nothing yet.</li>'}</ul>")
