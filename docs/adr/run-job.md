# How heavy jobs share one PC

Agents run heavy jobs directly; `run-job`, still installed, has its method in `src/run-job/run-job.mts`.

## Lost, and why

- **run-job for agents:** its holds (a false "game on", a game window left open to playtest) slowed the user's feedback more than shared load did. Reopen if agents run unattended while the user games.
- **One exclusive lock for every job:** four sessions waited 229 minutes in two hours on a mostly idle PC; shared, a replay waited none. Reopen for jobs that cannot share, such as GPU jobs.
- **Admission by average busy threads:** six 10.3 s checks started at once, and each took 3.4 to 3.8 times as long. Reopen for jobs that never start together.
- **Admission by physical cores:** six checks took 47 s against 39 s all at once, and a speed-budget test still failed. Reopen if a game's frame lateness matters more than throughput (3.3 ms p99 against 10.7).
- **Fixed caps or declared sizes:** a command's needs are unknown before it runs, and a cap idles spare cores. Reopen if job sizes are known.
- **No `--urgent`:** a commit check behind 16 one-core bot jobs waited 157 to 167 s; with it, 0.3 to 0.4 s. Drop it only if checks stop queueing behind long jobs; run time cannot tell them apart (9 s against 23 s).
- **pueue, GNU parallel, Slurm, HTCondor:** each needs a daemon or declared sizes, pueue knows nothing of memory, and parallel's memory option does not run on Windows. Reopen if one learns sizes, daemon-free, on Windows.

## Traps

- Wall-clock speed-budget tests fail under any extra load (2321 against 2300 µs): keep them out of per-commit checks.
