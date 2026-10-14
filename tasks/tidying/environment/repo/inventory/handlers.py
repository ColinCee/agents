from inventory.parse import parse_lines


def handle_import(text: str) -> list[dict]:
    return parse_lines(text)


def handle_export(records: list[dict]) -> str:
    return "\n".join(f"{r['name']},{r['grams']:g},g" for r in records)


def handle_report(records: list[dict]) -> str:
    """The stock-check summary for the August audit."""
    total = sum(r["grams"] for r in records)
    return f"{len(records)} lines, {total / 1000:g} kg in all"
