# Measuring agent rules

How a change to an agent rule is tested and then tracked, and how often agents stop needlessly. Settled results: [findings.md](findings.md).

## Testing a rule

| Step | How | Answer in |
|---|---|---|
| Replay | `npm run replay`: about 200 past moments where the rule could be broken, the agent's next message written under the old rules and under the new, misses counted with a pattern | Hours |
| Trial | A file in `home/trials/`: the rule is on for a random half of tasks | 7 days at most |
| Tracking | `npm run rule-tests`, each day: one row per session, every trial's looks, every measure's usual range | Every day |

Data stays in `~/.claude/keep-going/`, never in this repository: it is the user's own sessions. `backup.toml` lists it for the user's nightly PC backup.

- **A measure** is a query in the user's `measures/measures.sql` that adds rows to `chances`: one per moment a rule could be broken, and whether it was. [tools/sessions.sql](../tools/sessions.sql) names the tables it reads. Sessions are the unit everywhere, because misses clump within a session.
- **A replay** tests the wording only: the model gets the conversation as text, with no tools, project rules or skills. It stands for the real agent only if, under the rules those sessions really had, it breaks the rule within 1.5 times as often as they did; otherwise its answer is "replay can't test this".
- **A trial file** is `home/trials/<name>.md`:

  ```
  ---
  status: testing
  measures: <measure ids, comma separated>
  started: <YYYY-MM-DD, the day after it is installed>
  ---
  ## Off
  The line as it was; empty for a new rule.
  ## On
  The new line.
  ```

  A reworded line moves out of `home/core.md` or `home/desktop.md` into the file, so no session has both wordings; rules about the same behaviour share one file. [home/hooks/rule-groups.mjs](../home/hooks/rule-groups.mjs) gives each task its half at session start, from a hash of the trial's name and the task (its worktree, else the session), so trials split tasks independently and a restart keeps its group. Subagents get the same; Codex, which runs no hook, always gets `On`. Never put a rule that guards money, data or a destructive step in a trial: half the sessions go without it.
- **Looks.** A trial is looked at when its smaller group reaches 10, 20 and 40 sessions, and a last time on day 7. Each look shuffles sessions between the groups: `works` when fewer than 1 shuffle in 50 differs as much and the rule's group misses less; at the last look, `no useful effect` when the 90% range of the drop (resampling sessions) rules out a 30% drop, else `can't tell`. An earlier look either works or gives no verdict. A look is written once to `track/looks.csv` and never retaken.
- **Settled.** A trial that works gets `status: settled`: every task gets `On`, except about 1 in 10, which never get a settled rule. `rule-tests` compares the two on the model in use, so a model that no longer needs a rule shows, and names a measure whose day falls outside the middle 98% of what the same number of sessions gave over the 28 days before.
- **Limits.** A session working in this repository can read both wordings. A continued session outside a worktree may draw another group and is then left out, as are a session the hook did not reach (`rule-tests` counts those) and one nobody typed in.

## Needless stops

| | |
|---|---|
| Daily score | [tools/stop-score.sql](../tools/stop-score.sql): the user's replies and go-aheads ("yes, merge it", "do it", "now what?", typed or clicked) and input tokens, still in the reminder trial's two halves, which no longer differ; also the day's stops for labelling |
| One stop's thread | [tools/stop-thread.sql](../tools/stop-thread.sql), for the labelling page |
| Chart | `npm run keep-going`: needless stops per 100 by rule version, from model labels |
| Data | `measures/stop-score/`, `stops/`, `labels/`, `versions.csv` (the chart's rule versions) and `labelling/README.md`, the daily steps |

A go-ahead is a stop where the agent asked for permission it already had. A labeller also reads each day's stops with the user's own calls as examples; its labels draw the chart but decide nothing, since two labellers each matched the user's own calls on only half of the hard stops.

- **The AGENTS.md rule helped when it first loaded:** needless stops fell from 31 to 18 per 100, by model labels. Later rewordings moved it between 15 and 30, on few stops each.
- **The reminder's effect could not be shown.** In half the sessions (by the last digit of the session id), a hook told the agent once per stop to take the next step if its rules allowed. Over 8 and 9 November: 5.9 go-aheads per 100 replies with it (6 of 102, in 11 sessions), 7.9 without (10 of 127, in 6 sessions); the gap's 90% interval, from resampling whole sessions, was about −2 to 6.5, and the two days pointed opposite ways. The trial was planned for 14 days, which by an estimate from 8 earlier days could show a gap of about 3 per 100 or more; it ended after 2 because the user saw no difference and each of the 60 reminders cost an extra agent turn.
- **Earlier wordings of the reminder could not be judged.** Of about 830 reminders in 10 days, about 1 in 10 led the agent to do a step it had wrongly left to the user or to finish a wait; the rest added a status line or nothing, at about 4% of input tokens. The rule was reworded and the app's reply buttons arrived in the same weeks, so that data cannot separate their effects.
- **A separate judge model doesn't work.** A Haiku judge replayed on 1,073 labelled stops caught 16% of needless stops and sent back 3 that needed the user.
- **Direction, not permission.** The user's own calls on hard stops: questions about what to build or which idea to follow are his; questions about whether something is safe, or whether the agent may merge or run it, are not.

Out of scope: subagents' stops, agents other than Claude Code.

## Why this method

Checked on the user's sessions of October and November 2026, per session, for three counted mistakes:

- **Before and after is not a test.** The earlier rule (the rate fell by half after the fix) said "working" at about 1 in 4 made-up fix dates, because days differ more than fixes do.
- **Three looks, not a daily check.** On random halves with no real difference, three looks at 1 in 50 passed 2 to 3% of the time; checking every day at 1 in 20 passed about 30%.
- **Count misses over chances, by session.** It found a real halving 3 to 5 times as often as counting sessions with any miss.
- **A week is often too short.** About 9 sessions a day have a chance at a common mistake, so a week gives about 30 a group, and a true halving passed only 22 to 40% of the time at 40 a group. So the replay comes first, and a trial that can't tell gets a commoner measure or a bolder change.
