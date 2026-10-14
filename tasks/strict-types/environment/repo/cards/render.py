from datetime import date


def render(card: dict) -> str:
    """One line of the calendar: day, start time, title."""
    day = date.fromisoformat(card["date"]).strftime("%a %d %b")
    start = card["start"]
    if start:
        return f"{day} {start[:5]}  {card['title']}"
    return f"{day}  {card['title']}"
