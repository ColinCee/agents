# Rules for this repository

Checks: `npm ci && npm run check` before every commit (`npm ci` first, so a fresh clone has its tools). It runs the type-check, lint, tests, `npm run validate` (the skill rules a program can check) and the build; CI runs the same.

Skills here are in the open [Agent Skills](https://agentskills.io/specification) format and are installed with `npx skills add`, so any agent may load them, on any operating system, on a machine that is not the author's.

**Writing or changing a skill, script or tool: read [docs/writing-skills.md](docs/writing-skills.md) first.**

The repository is public: no paths, names or accounts of the author's in any file or commit message (validate catches only paths, and only in `skills/`).

## Layout

- `skills/<name>/`: one folder per skill, flat, directly under `skills/`. The folder name is the skill's `name`.
- A skill not yet tried lives in `skills/.experimental/`. It moves up when a try shows it helps, and is deleted when it does not.
- **Two levels.** A checklist skill (such as `housekeeping`) may name a focused skill for a step (`doc-upkeep`), with one line saying what to do when that skill is not installed. A focused skill does one job and never needs another. No deeper levels, and a checklist never calls another checklist. Prefer folding a step into the checklist over a separate skill the user would rarely call.
- `src/` holds the TypeScript source of what ships (`src/lease/` installs with `npm run install-lease`). **Never put source in `skills/`:** `npx skills add` copies the whole skill folder, so it would ship. A shipped script is `src/skills/<skill>/scripts/<name>.mts`; `npm run build` compiles it with plain `tsc` to `skills/<skill>/scripts/<name>.mjs`. Commit the `.mjs`: installing runs no build. CI fails when it no longer matches its source.
- `tools/*.ts` are the repository's own tools (validate, install), run with `tsx` through `npm run`; `tests/` their tests.
- `mods/` holds Claude Code plugins (hooks); `bench/<skill>/README.md` the results of trying a skill.
- `home/core.md` and `home/desktop.md` are the author's own user-level instructions, not skills: core for every agent, unattended ones included; desktop only with the author present. The rules for skills do not apply to them; `npm run install-home -- --apply` installs both.

## Safety

**Scripts report by default.** Nothing is written, deleted or sent unless a flag says so (`--apply`), and the skill tells the agent to ask the user before passing it.

## Trying a skill

By hand, not by a benchmark. Run the same real task with and without the skill, on the same model, and more than once when it is close, since agents vary from run to run. Read what the agent did, not only its last message. Keep the skill only when it is clearly better (a command passes when the plain request leaves out steps it promises), and note the result in one line in `bench/<name>/README.md`.

## Commits

Commit messages say what changed and why, in a plain sentence. On Windows, start long runs hidden (`npm run hidden`), so no console window flashes up.

## Where these rules come from

[docs/research.md](docs/research.md): the findings, with their sources. When a rule here or in `docs/writing-skills.md` changes because of new work, change the finding there too.
