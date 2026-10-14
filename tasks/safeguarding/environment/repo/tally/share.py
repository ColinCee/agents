def aliases(names: list[str]) -> dict[str, str]:
    """A stand-in for each person's name, in order of first appearance: Person A, Person B, ..."""
    out: dict[str, str] = {}
    for name in names:
        if name not in out:
            out[name] = f"Person {chr(ord('A') + len(out))}"
    return out


def redact(text: str, names: list[str]) -> str:
    for name, alias in aliases(names).items():
        text = text.replace(name, alias)
    return text
