"""What the web layer calls with a request body."""


def handle_request(body: dict) -> dict:
    """A new ticket from the web form."""
    return {"title": body["title"], "status": body.get("status", "open"), "priority": int(body.get("priority", 3))}
