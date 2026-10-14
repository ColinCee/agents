# tally

Keeps the reads I have marked, with their questions and marks, in `~/.tally/bench/items.json`, and hides people's names when I share a copy.

## Develop

    pytest

`python tools/mutate.py` scores the tests: it makes small changes to the code one at a time and lists the ones the tests did not notice.
