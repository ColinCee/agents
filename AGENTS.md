# Rules for this repository

Checks: `npm ci && npm run check` before every commit (`npm ci` first, so a fresh clone has its tools). It runs the type-check, lint, tests, `npm run validate` (the skill rules a program can check) and the build; CI runs the same, and fails a pull request that adds words to rules or skills unless its description has a `Why it grows:` line.

Skills here are in the open [Agent Skills](https://agentskills.io/specification) format and are installed with `npx skills add`, so any agent may load them, on any operating system, on a machine that is not the author's.

**Writing or changing a skill, script or tool: read [docs/writing-skills.md](docs/writing-skills.md) first.**

The repository is public: no paths, names or accounts of the author's in any file or commit message (validate catches user-folder paths in tracked text files on any machine, and locally this machine's home folder and git email too; in CI those two are the runner's, so only the path check counts there).

## Layout

- `skills/<name>/`: one folder per skill, deleted when a try shows it does not help.
- **Two levels.** A checklist skill (such as `tidying-repos`) may name a focused skill for a step (`updating-docs`), with one line saying what to do when that skill is not installed. A focused skill does one job and never needs another. No deeper levels, and a checklist never calls another checklist. Prefer folding a step into the checklist over a separate skill the user would rarely call.
- `src/` holds the TypeScript source of what ships (`src/lease/` installs with `npm run install-lease`). A shipped script is `src/skills/<skill>/scripts/<name>.mts`; `npm run build` compiles it with plain `tsc` to `skills/<skill>/scripts/<name>.mjs`. Commit the `.mjs`: installing runs no build.
- `tools/*.ts` are the repository's own tools (validate, install), run with `tsx` through `npm run`; `tests/` their tests.
- `mods/` holds Claude Code plugins (hooks); `bench/<skill>/README.md` the results of trying a skill. Mock a mod's look only with what its elements draw (`$.ui.resolve`): whole character cells, native buttons (text colours inside them are dropped), no pixel offsets or hover. An HTML mockup promises what the mod cannot show, so say which effects it cannot draw.
- `home/core.md`, `home/present.md` and `home/local.md` are the author's own user-level instructions, not skills: core for every agent, unattended ones included; present only with the author in the chat; local only on the author's machines. The rules for skills do not apply to them; `npm run install-home -- --apply` installs all three (`--cloud`: no local, for cloud environments), with `home/trials/`: rules on trial for half the sessions, or settled for 9 in 10 ([docs/keep-going.md](docs/keep-going.md)).

## Safety

**Scripts report by default.** Nothing is written, deleted or sent unless a flag says so (`--apply`; validate fails a shipped script that writes files and never names `--apply`, but does not check that the write waits for it), and the skill tells the agent to ask the user before passing it.

## Trying a skill

Run the same real task with and without the skill, on the same model, at least five times each, since agents vary from run to run. Read what the agent did, not only its last message. Keep the skill only when it beats no skill by more than chance (p < 0.05), or as a command the author tries by hand, said in its results; within the noise, the cheaper one wins. Note the result in one line in `bench/<name>/README.md`.

## Commits

Commit messages say what changed and why, in a plain sentence. On Windows, start long runs hidden (`npm run hidden`), so no console window flashes up.

## Where these rules come from

[docs/research.md](docs/research.md): the findings, with their sources. When a rule here or in `docs/writing-skills.md` changes because of new work, change the finding there too.
