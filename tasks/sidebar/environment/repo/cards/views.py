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
.link { background: none; border: 0; color: #1a56db; text-align: left; }
.stats { color: #777; font-size: .8rem; }
</style>"""

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
    n = store.counts()
    others = "".join(
        f'<option value="{o["id"]}">{escape(o["title"])}</option>' for o in store.load() if o["id"] != c["id"]
    )
    notify = "on" if c.get("notify") else "off"
    aside = f"""<aside>
<p class="stats">Feed · History {n["added"] + n["booked"] + n["not_real"]} · Written to the calendar {n["added"]} · Numbers · Missed {n["snoozed"]}</p>
<form method="post" action="/card/{c["id"]}/status">
  <button class="primary" name="status" value="added">Add to calendar</button>
  <button class="primary" name="status" value="booked">Already booked</button>
  <p>Not right?</p>
  <button class="quiet" name="status" value="not_real">Not real</button>
  <button class="quiet" name="status" value="something_else">It's something else</button>
  <button class="quiet" name="status" value="time_changed">The time changed</button>
  <button class="quiet" name="status" value="snoozed">Remind me later</button>
  <select name="same_as"><option value="">Same as…</option>{others}</select>
  <button class="quiet" name="status" value="same_as">Same as</button>
</form>
<form method="post" action="/card/{c["id"]}/notify">
  <button class="link" name="notify" value="{'off' if notify == 'on' else 'on'}">Notify me →</button>
</form>
</aside>"""
    body = f'<h1>{escape(c["title"])}</h1><p>{escape(c["when"])}</p><blockquote>{escape(c["quote"])}</blockquote>'
    return page(c["title"], body).replace("</main>", "</main>" + aside)
