GRAMS = {"g": 1, "kg": 1000, "t": 1_000_000}


def to_grams(amount: float, unit: str) -> float:
    if unit not in GRAMS:
        raise ValueError(f"unknown unit: {unit}")
    return amount * GRAMS[unit]


# Not called yet: the supplier feed switches to pounds in October. See docs/setup.md, "Imports".
def to_pounds(grams: float) -> float:
    return grams / 453.592
