# How heavy jobs share one PC

Agents run builds, tests and simulations directly, at full speed; `run-job` stays installed, and its method is in `src/run-job/run-job.mts`.

## Lost, and why

- **run-job for agents:** its holds (a false "game on", a game window left open to playtest) slowed the user's feedback more than shared load did, and the user pauses jobs by hand to play.
- **One exclusive lock for every job:** four sessions waited 229 minutes in a two-hour evening while the PC was mostly idle; a replay of that evening with every headless job shared waited none.
- **Admission by average busy threads:** it let six copies of a 10.3 s check start at once; jobs started together burst together, and each took 3.4 to 3.8 times as long as alone.
- **Admission by physical cores:** six checks took 47 s against 39 s for all at once, the slowest of the shared policies, and a speed-budget test still failed.
- **Fixed caps or declared sizes:** nobody knows a command's needs before it runs, and a cap wastes the cores a light job leaves idle.
- **No `--urgent`:** a commit check behind 16 one-core bot jobs waited 157 to 167 s; with it, 0.3 to 0.4 s.
- **pueue, GNU parallel, Slurm, HTCondor:** pueue needs a daemon and knows nothing of memory, GNU parallel's memory option does not run natively on Windows, and Slurm and HTCondor need daemons and declared sizes.

## Traps

- Wall-clock speed-budget tests fail under any extra load (2321 µs against 2300 µs at two jobs at a time): keep them out of a per-commit check or give them the machine.
- Never measured: a real game's frame times with jobs running beside it.
