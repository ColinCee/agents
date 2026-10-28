# Keep going: an experiment

When the agent ends its turn, it gets one reminder: by your AGENTS.md rules, does the next step really need the user? If not, it carries on; if it does, it stops again and adds nothing, so its summary or question stays last. No reminder when the agent is waiting on background work, when another hook already decided, or in scripted runs (`claude -p`, the SDK). Its own rules (AGENTS.md) and the whole conversation decide; the hook adds no rules of its own.

| | |
|---|---|
| Hook | [mods/keep-going/hooks/register.ts](../mods/keep-going/hooks/register.ts) |
| Measure | `npm run keep-going`: needless stops per 100 before and after, drawn against no rule, and reminders a day |
| Install | `npm run install-keep-going` |
| Data | `~/.claude/keep-going/`: `log/` (each reminder), `labels/`, `results.html`. Never in this repository: it is the user's own sessions |

## Why

In 1,418 past stops (30 Sep to 26 Oct 2026, labelled by a model reading what the user typed next), 24% cost the user a nudge ("yeah", "what next"): "Shall I…?" on a step it had recommended (162), "Fixing." then stopping (47), a menu when it had a pick (41), "done" with work left (40), a command handed over (32).

## What decides it

Past sessions are the comparison. Each rule version is a row of `~/.claude/keep-going/versions.csv` (version, from, to, what, link): v0 no rule (30 Sep to 15 Oct) is the baseline, v1 the old AGENTS.md rule (16 to 26 Oct). A new rule version is one pull request that changes only that rule. Once it merges, its row goes in with the PR as its link: the row before it ends the day before the merge, the new row starts the day after, and the merge day counts in neither. From 28 Oct the reworded rule and the reminder run together, so the result is the two combined. They stay if needless stops fall by at least a third against the old rule; what reminded agents went on to do is read by hand in the daily review. The cost is one extra agent turn per reminder, reading the conversation from the prompt cache.

## Findings

- **The AGENTS.md rule works:** 31.3 needless stops per 100 with no rule, 18 once Claude Code loaded it (16 Oct).
- **A separate judge model doesn't.** A Haiku judge replayed on 1,073 labelled stops caught 16% of needless stops and would have sent back 3 stops that needed the user; on top of the rule it made things worse (−11.3 vs −13.3 per 100). The agent itself, with its rules and the whole conversation, is the better judge, so the hook only reminds it.
- **Most stops are in long sessions:** 78% of stops, and 85% of needless ones, sit on over 100k tokens of context.

Labels are one model's reading, not ground truth, and the kind of work changes from week to week. Stops where the user's message arrived mid-turn, and stops sharing a session and minute, are left out. Out of scope: subagents' stops, agents other than Claude Code.
