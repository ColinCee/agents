# Findings

One line per settled result about the author's agent rules, newest first, each linked to its write-up. A result listed here is not reported again. Ranges are 90%, from resampling whole sessions; "before and after" compares the weeks either side of a fix, not random halves.

| Settled | Finding | Write-up |
|---|---|---|
| Nov 2026 | The line against pull request numbers in replies: a replay of 198 past moments cut them 72% (60 to 84), but real agents with the line broke it three times as often as the replay, so a replay cannot settle it; on trial | [#98](https://github.com/ColinCee/agents/pull/98) |
| Nov 2026 | p < 0.02 at each of three looks passed a do-nothing rule 6% of the time on real sessions; the stricter limits now used, 3.6% | [Method](https://github.com/ColinCee/agent-experiments/blob/main/docs/architecture.md#method) |
| Nov 2026 | Before-and-after verdicts passed about 1 in 4 made-up fixes | [Why this method](keep-going.md#why-this-method) |
| Nov 2026 | A week brings 5 to 19 tasks a group, and most measures need 40 or more to find a true halving, so a replay comes first | [Method](https://github.com/ColinCee/agent-experiments/blob/main/docs/architecture.md#method) |
| Nov 2026 | A hook that refuses a commit naming no paths: such commits fell 79% (70 to 85), before and after | [#24](https://github.com/ColinCee/agents/pull/24) |
| Nov 2026 | A hook that refuses a pull request until its skill is loaded: sessions shipping without it fell 76% (66 to 84), before and after | [#15](https://github.com/ColinCee/agents/pull/15) |
| Nov 2026 | "Never a table of numbers in a reply": tables fell 83% (74 to 89), before and after | [#13](https://github.com/ColinCee/agents/pull/13) |
| Nov 2026 | A reminder at each stop: no effect that could be shown, at an extra agent turn each | [Needless stops](keep-going.md#needless-stops) |
| Nov 2026 | A separate judge model caught 16% of needless stops | [Needless stops](keep-going.md#needless-stops) |
| Oct 2026 | The user-level stop rule, when it first loaded: needless stops fell from 31 to 18 per 100, by model labels | [Needless stops](keep-going.md#needless-stops) |
