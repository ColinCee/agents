# How heavy jobs share one PC

Agents run heavy jobs directly, at full speed; `run-job` stays installed, and its method is in `src/run-job/run-job.mts`.

## Lost, and why

- **run-job for agents:** its holds (a false "game on", a game window left open to playtest) slowed the user's feedback more than shared load did. Reopen if agents run unattended while the user games.
- **One exclusive lock for every job:** four sessions waited 229 minutes in two hours on a mostly idle PC; replayed with headless jobs shared, none. Reopen for jobs that cannot share, as GPU ones.
- **Admission by average busy threads:** six copies of a 10.3 s check started at once, burst together, and each took 3.4 to 3.8 times as long as alone. Reopen for jobs that never start together.
- **Admission by physical cores:** six checks took 47 s against 39 s all at once, and a speed-budget test still failed. Reopen if a game needs whole cores.
- **Fixed caps or declared sizes:** nobody knows a command's needs before it runs, and a cap idles the cores a light job leaves. Reopen if jobs come with known sizes.
- **No `--urgent`:** a commit check behind 16 one-core bot jobs waited 157 to 167 s; with it, 0.3 to 0.4 s. Reopen if run time tells a check from a sweep (9 s against 23 s median did not).
- **pueue, GNU parallel, Slurm, HTCondor:** each needs a daemon or declared sizes, and parallel's memory option does not run on Windows. Reopen if one learns sizes, daemon-free, on Windows.

## Traps

- Wall-clock speed-budget tests fail under any extra load (2321 µs against 2300): keep them out of per-commit checks.
