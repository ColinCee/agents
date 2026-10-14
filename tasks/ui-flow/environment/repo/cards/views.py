"""The three pages: open cards, one card with its sidebar, and history."""

from html import escape

from cards import store

STYLE = """<style>
body { font-family: system-ui, sans-serif; margin: 0; display: flex; }
nav { width: 12rem; padding: 1rem; background: #f3f3f3; min-height: 100vh; }
main { padding: 1rem 2rem; flex: 1; }
aside { width: 18rem; padding: 1rem; border-left: 1px solid #ddd; }
button { display: block; width: 100%; margin: .4rem 0; padding: .5rem; }
.primary { background: #1a56db; color: white; border: 0; }
.quiet { background: none; border: 1px solid #ccc; }
</style>"""

SHOWN_IN_HISTORY = ("added", "booked", "not_real")
LABEL = {"added": "Added to your calendar", "booked": "Already booked", "not_real": "Not real"}


def page(title: str, body: str) -> str:
    nav = '<nav><a href="/">Open cards</a><br><a href="/history">History</a></nav>'
    return f"<!doctype html><title>{escape(title)}</title>{STYLE}{nav}<main>{body}</main>"


def open_cards() -> str:
    rows = "".join(
        f'<li><a href="/card/{c["id"]}">{escape(c["title"])}</a> <small>{escape(c["when"])}</small></li>'
        for c in store.load()
        if c["status"] == "open"
    )
    return page("Open cards", f"<h1>Open cards</h1><ul>{rows or '<li>Nothing waiting.</li>'}</ul>")


def card(card_id: int) -> str:
    c = store.get(card_id)
    aside = f"""<aside>
<form method="post" action="/card/{c["id"]}/status">
  <button class="primary" name="status" value="added">Add to calendar</button>
  <button class="quiet" name="status" value="booked">Already booked</button>
  <button class="quiet" name="status" value="not_real">Not real</button>
</form>
</aside>"""
    body = f'<h1>{escape(c["title"])}</h1><p>{escape(c["when"])}</p><blockquote>{escape(c["quote"])}</blockquote>'
    return page(c["title"], body).replace("</main>", "</main>" + aside)


def history() -> str:
    rows = "".join(
        f"""<li>{escape(c["title"])}: {LABEL[c["status"]]}
<form method="post" action="/card/{c["id"]}/status" style="display:inline">
  <button class="quiet" name="status" value="open" style="display:inline;width:auto">Undo</button>
</form></li>"""
        for c in store.load()
        if c["status"] in SHOWN_IN_HISTORY
    )
    return page("History", f"<h1>History</h1><ul>{rows or '<li>Nothing yet.</li>'}</ul>")
