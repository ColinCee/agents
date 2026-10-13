# pantry

Tracks what is in the kitchen and builds the shopping list.

## Use

    python -m pantry add rice --have 1 --want 2
    python -m pantry list
    python -m pantry shop

The pantry is kept in `var/pantry.json`. It is not in git: it is mine, and it changes every day.

## Develop

    ruff check .
    pytest

Every command that is run is appended to `var/usage.log` with the time.
