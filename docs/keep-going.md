# Measuring agent rules

How a change to an agent rule is tested and then tracked, and how often agents stop needlessly. Settled results: [findings.md](findings.md).

## Testing a rule

A new wording is first replayed on past moments (hours), then put on trial for a random half of tasks, looked at when its smaller group reaches 10, 20 and 40 tasks and last on day 7. [agent-experiments](https://github.com/ColinCee/agent-experiments) counts each rule's misses from the user's `measures/measures.sql`, takes the looks, gives the verdicts, runs replays and draws the daily overview page; how and why: its [architecture](https://github.com/ColinCee/agent-experiments/blob/main/docs/architecture.md). When to run it: [reviewing-sessions](../skills/reviewing-sessions/SKILL.md), step 6.

Data stays in `~/.claude/keep-going/`, never in this repository: it is the user's own sessions. `backup.toml` lists it for the user's nightly PC backup.

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
- **Settled.** A trial that works gets `status: settled`: every task gets `On`, except about 1 in 10, which never get a settled rule and stay the comparison group.
- **Limits.** A session working in this repository can read both wordings. A continued session outside a worktree may draw another group, and is then left out.

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

Checked on the user's sessions of October and November 2026, for three counted mistakes; the rest is in the [architecture's method](https://github.com/ColinCee/agent-experiments/blob/main/docs/architecture.md#method).

- **Before and after is not a test.** The earlier rule (the rate fell by half after the fix) said "working" at about 1 in 4 made-up fix dates, because days differ more than fixes do.
- **Three looks, not a daily check.** On random halves with no real difference, checking every day at 1 in 20 passed about 30% of the time.
