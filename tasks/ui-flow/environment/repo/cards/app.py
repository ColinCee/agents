"""A small WSGI app. Run it with `python -m cards.app` and open http://localhost:8000."""

import re
from urllib.parse import parse_qs
from wsgiref.simple_server import make_server

from cards import store, views


def app(environ, start_response):
    method, route = environ["REQUEST_METHOD"], environ.get("PATH_INFO", "/")
    if method == "POST" and (m := re.fullmatch(r"/card/(\d+)/status", route)):
        size = int(environ.get("CONTENT_LENGTH") or 0)
        form = parse_qs(environ["wsgi.input"].read(size).decode())
        store.set_status(int(m[1]), form["status"][0])
        start_response("303 See Other", [("Location", "/")])
        return [b""]
    if route == "/":
        html = views.open_cards()
    elif route == "/history":
        html = views.history()
    elif m := re.fullmatch(r"/card/(\d+)", route):
        html = views.card(int(m[1]))
    else:
        start_response("404 Not Found", [("Content-Type", "text/plain")])
        return [b"not found"]
    start_response("200 OK", [("Content-Type", "text/html; charset=utf-8")])
    return [html.encode()]


if __name__ == "__main__":
    print("http://localhost:8000")
    make_server("", 8000, app).serve_forever()
