"""Work in progress: suggest what to reorder when stock runs low."""

from inventory.units import to_grams

LOW = {"widget": 2000, "nail": 500}


def to_reorder(records: list[dict]) -> list[str]:
    return [r["name"] for r in records if r["grams"] < LOW.get(r["name"], 0)]


def grams_of(line: str) -> float:
    _name, amount, unit = line.split(",")
    return to_grams(float(amount), unit)
