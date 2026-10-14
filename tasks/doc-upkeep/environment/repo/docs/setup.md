# Setting up

1. Python 3.11 or later.
2. `pip install -e .`

## Checks

Run `ruff check .` and `pytest` before every commit. Stock files live in `data/stock/`, one per supplier.

## Imports

`inventory.units.to_pounds` is not called yet: the supplier feed switches to pounds in October, and the importer will use it then. Keep it.
