# triage

Labels incoming support tickets as `billing`, `bug`, `account` or `other`, so each goes to the right queue.

```bash
python classify.py v1 cases/all.jsonl   # label tickets with a prompt
python bench.py                         # score the prompts
```

- `prompts/`: the prompts. `v1` is live; `v2` is the rewrite.
- `model.py`, `recording.json`: the recorded stand-in for the hosted model, so the bench runs offline.
- `cases/all.jsonl`: 120 tickets from September, hand-labelled in `labels/human.jsonl`.
- `cases/old.jsonl`: 60 of those, the ones v1 struggled with.
- `cases/new.jsonl`: 60 tickets from October, labelled in `labels/auto.jsonl` by running v2 over them, to save labelling by hand.
- `results/runs.jsonl`: every bench run since 23 September; the weekly chart reads it. Not in git.
