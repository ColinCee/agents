from inventory.parse import parse_lines


def handle_import(text: str) -> list[dict]:
    return parse_lines(text)
