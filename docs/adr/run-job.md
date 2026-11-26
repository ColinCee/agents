# How heavy jobs share one PC

Agents run heavy jobs directly; `run-job`, still installed, has its method in `src/run-job/run-job.mts`.

## Lost, and why

- **run-job for agents:** its holds (a false "game on", a game window left open to playtest) slowed the user's feedback more than shared load did, and the user pauses jobs by hand to play.
- **One exclusive lock for every job:** four sessions waited 229 minutes in two hours on a mostly idle PC; shared, a replay waited none.
- **Admission by average busy threads:** six 10.3 s checks started at once, and each took 3.4 to 3.8 times as long.
- **Admission by physical cores:** six checks took 47 s against 39 s all at once, and a speed-budget test still failed.
- **Fixed caps or declared sizes:** a command's needs are unknown before it runs, and a cap idles spare cores.
- **No `--urgent`:** a commit check behind 16 one-core bot jobs waited 157 to 167 s; with it, 0.3 to 0.4 s. Run time cannot tell a check from a sweep (9 s against 23 s), so the caller says which.
- **pueue, GNU parallel, Slurm, HTCondor:** each needs a daemon or declared sizes, pueue knows nothing of memory, and parallel's memory option does not run on Windows.

## Traps

- Wall-clock speed-budget tests fail under any extra load (2321 against 2300 µs): keep them out of per-commit checks.
