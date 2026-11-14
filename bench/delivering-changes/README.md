# delivering-changes: results

**What to expect:** type `/delivering-changes` to run a change in order: needs and a picture first (a sample of what you will see, else a diagram), then options, probes, build, checks and shipping. It is a command the author tries by hand: it did not beat no skill on any benchmark, and while it was offered by description agents never loaded it, so it now loads only when typed.

| On Claude Opus 5.5, 6 runs a side | No skill | With the skill named |
|---|---|---|
| Three synthetic tickets, score (both at the ceiling) | 1.00 | 1.00 (+30% cost) |
| Five real past requests, needs the owner corrected that the plan stated up front | 0.34 | 0.31 (within chance) |

**Why it is not settled:** the replays forbade questions, so the skill could not ask; about 11 of the 29 needs were taste (emojis, wording, layout) that surfaces only when the owner sees a draft. One live replay with the owner answering scored the same: the skill asked its questions after a long plan, and the draft he would have corrected sat inside it unseen. Step 1 now leads with a picture and only the questions that would change the pick, untested.

The tests and every run are in the private `agents-bench` repository, under `skills/delivering-changes/`.
