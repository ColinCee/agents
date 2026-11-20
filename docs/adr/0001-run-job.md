# 0001: How heavy jobs share one PC (run-job)

## Status

Retired for agents on 2026-11-20: they run jobs directly at full speed, since run-job's holds (a false "game on", a game window left open to playtest) slowed his feedback loop more than shared load did, and he pauses jobs himself when he games. The command and its band stay installed but unused.

## Context

Agents on one Windows PC (8 cores, 16 threads) run builds, tests, simulations, GPU models and game windows. Until now every such job took an exclusive lock (`lease --res gpu`), headless ones included. In one 2-hour evening four agent sessions waited 229 minutes for that lock, while the PC was mostly idle. A replay of that evening's jobs from the lock log reproduced the waiting (213 minutes): one session's long timing runs held the lock for 64 minutes, and the other jobs queued behind them. With those holds removed the same replay waits 15 minutes; with every job shared, it waits none.

In five weeks of the log, the 632 jobs were real GPU work (models, speech, game agents), game windows (screenshots, play tests) and headless CPU work (checks, tests, bot runs), with one job that needed RAM.

## Options measured

Six copies of one project's check (10.3 s alone, 0.8 GB peak, about 4 threads busy, 2.1 on average), started together through each policy. The probe is a normal-priority loop with a 16.7 ms frame and 4 ms of work, recording how late each frame starts.

| Policy | All six done | Budget-test failures | Probe lateness p99 |
|---|---:|---:|---:|
| Nothing running | | | 0.05 to 0.2 ms |
| All at once, below-normal priority (also what admission by average threads allows) | 39 s | 2 of 6 | 10.7 ms |
| By busy threads against 16 (4, then 2) | 43.5 s | 1 of 6 | 7.0 ms |
| By busy threads against 8 cores (2 at a time) | 47 s | 1 of 6 | 3.3 ms |
| One at a time (the exclusive lock) | about 62 s (6 × 10.3 s) | 0 of 20, in separate runs | |

The failures are one wall-clock speed-budget test in that project, which fails under any extra load (2321 µs against 2300 µs at two at a time). They are the test's to fix, not the runner's.

## Decision

`run-job -- COMMAND` starts every headless job at idle priority, admitted by two pools: RAM (its highest recent peak × 1.25) and CPU threads (its 90th-percentile busy threads over recent runs). Both are learned by watching each run, so no agent estimates anything. While nobody plays, the CPU pool is every thread, because every queue finished the batch later than running all at once. While a game is on, the pool is a quarter of the threads, because low priority does not stop a job's thread slowing the game's thread on the same core. A game is on when the card is busy, no job of ours holds it, and a program Windows has recorded as a game runs: a video under a live wallpaper keeps the card 21-53% busy, as busy as StarCraft II (25-43%), and by the card alone that once held a sweep to 4 of 16 threads for ten minutes. A job that needs more than the pool counts as the whole pool, so alone it starts instead of waiting for room that never comes. GPU jobs and game windows keep the exclusive lock, and say so with `--res gpu`: guessing a window from the processes counted a console as one, and that put every check back behind the GPU lock.

A job someone waits on, such as a commit check, runs with `--urgent`: at below-normal priority, and counting only other urgent jobs' cores, so ordinary jobs at idle priority yield it theirs. A sweep's jobs last about as long as a check (23 s against 9 s, median), so run time cannot tell them apart; the caller says which. While a game is on, an urgent job counts every job, so the game keeps its share. Measured with 16 one-core bot jobs refilling while 3 checks ran one after another: each check waited 157 to 167 s before, and 0.3 to 0.4 s with `--urgent`; each ran 7.5 s before and 6.1 to 8.6 s after. In the 80 minutes before, 33 of 58 commit checks had waited, up to 316 s.

What lost:
- **One exclusive lock for everything:** 229 minutes of queueing in two hours.
- **Fixed caps, or declared sizes:** nobody knows a command's needs before it runs, and a cap wastes the cores a light job leaves idle.
- **Admission by average threads:** it lets all six start at once; jobs started together burst together, and each check took 3.4 to 3.8 times as long as alone.
- **Admission by physical cores:** this ran fewest at once, finished last of the shared policies, and still did not stop the flaky test.
- **Existing tools:** pueue needs a daemon and knows nothing of memory, GNU parallel's memory option does not run natively on Windows, and Slurm and HTCondor need daemons and declared sizes.

## Consequences

- (Retired, see Status.) Agents run heavy work as `run-job -- <command>`; `lease` stays as a second name for the same file until its callers in other repositories move.
- Wall-clock speed tests flake under load; projects keep them out of the per-commit check or give them room.
- Each job starts one sampler process, whose process query takes about 0.17 s, once a second.
- Outside Windows the sampler reads RAM only, so jobs there are admitted by RAM and the unmeasured thread count.
- To do: a real game session with jobs running, comparing frame times with and without them.
