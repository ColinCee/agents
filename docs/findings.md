# Findings

One line per settled result about the author's agent rules, newest first, each linked to its write-up. A result listed here is not reported again. Ranges are 90%, from resampling whole sessions; "before and after" compares the weeks either side of a fix, not random halves.

| Settled | Finding | Write-up |
|---|---|---|
| Nov 2026 | A CI check that fails a rule edit with no trial: of the 14 pull requests changing rules since, 7 passed with a stated exception instead of a trial; can't tell, with no like-for-like count from before | [#126](https://github.com/ColinCee/agents/pull/126) |
| Nov 2026 | The Done line naming what the whole session still has open: the author asked whether a session was done in about 1% of messages before and after (change +12%, -62% to +277%); can't tell | [#125](https://github.com/ColinCee/agents/pull/125) |
| Nov 2026 | "Never end on an offer", even when the closing box asks for one: needless offer stops went from 16.1 to 14.5 per 100 labelled stops (10 to 12 Nov, 180 stops; 13 to 18 Nov, 311), no difference shown; not working after two wordings | [#95](https://github.com/ColinCee/agents/pull/95) |
| Nov 2026 | The plain-words line naming references from other sessions: the author's "what is that?" questions went from 3.7% to 5.3% of the author's messages (change +45%, +7 to +91), before and after; not working after three wordings | [#96](https://github.com/ColinCee/agents/pull/96) |
| Nov 2026 | shipping-prs asking a fresh review "for every pull request, a one-line follow-up included": pull requests merged with no fresh reviewer fell 49% (28 to 79), before and after | [#106](https://github.com/ColinCee/agents/pull/106) |
| Nov 2026 | "About 75 words; over 150 only beside a picture": closing replies over 150 words went from 54% to 57% (change +7%, -12 to +28), before and after; not working after two wordings; removed, since a hook would fire on every reply and only the closing summary needs to be short | [#106](https://github.com/ColinCee/agents/pull/106) |
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
