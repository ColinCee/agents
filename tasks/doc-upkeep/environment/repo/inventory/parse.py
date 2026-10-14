from inventory.units import to_grams


def parse_line(line: str) -> dict:
    name, amount, unit = (part.strip() for part in line.split(","))
    if not name:
        raise ValueError("a line needs a name")
    return {"name": name, "grams": to_grams(float(amount), unit)}


def parse_lines(text: str) -> list[dict]:
    return [parse_line(line) for line in text.splitlines() if line.strip()]
