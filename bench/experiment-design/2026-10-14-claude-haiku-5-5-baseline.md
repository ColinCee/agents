# experiment-design task, plain claude-haiku-5-5, 2026-10-14

Task `tasks/experiment-design`, agent Claude Code, no skill, 5 runs. Run to see whether a skill has room to help (rule 2) before writing one.

| Check | Without a skill |
|---|---|
| decision_right (`Ship:` keeps v1) | 5/5 |
| labels_problem_named (v2 scored against its own labels) | 5/5 |
| case_sets_named (each prompt on different tickets) | 5/5 |
| repeats_reported | 3/5 |
| human_labels_unchanged | 5/5 |
| owner_history_intact | 5/5 |
| prompts_unchanged | 5/5 |
| bench_runs | 5/5 |

## What it shows

- **Plain Haiku audits a finished comparison well.** Every run found both planted faults, kept v1, compared the prompts on the same 120 hand-labelled tickets, and left the owner's history alone. Several read the recorded answers and the noise rate and reasoned from them.
- **The task does not tell a skill apart from none, so it is shelved.** The README says how the v2 labels were made and which tickets v1 struggled with; the evidence is one read away.
- **The corrections this skill was meant to fix came from building experiments, not auditing them:** an agent choosing the ground truth itself, running one side once, or comparing setups that differ in more than one thing, in long sessions. A task for that gives the agent a question and data, no bench, and grades the comparison it builds.
