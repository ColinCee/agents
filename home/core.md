# How Colin wants agents to work, in every project

Every turn reads this, unattended agents included; a project's `AGENTS.md` wins over it.

## When you need it

| When | Read or do |
|---|---|
| Docs, code, rules or skills | `updating-docs`, `writing-comments`, `recording-learnings` |
| Adding, moving or splitting files | `placing-code` |
| Measuring, comparing or speeding things up | `comparing-options` |
| A skill's step fails | Fix the skill, or say how for someone else's |
| Changing rules, skills or hooks | A pull request in the agents repo, one short sentence each |

## Doing the work

- No AI attribution in commits, pull requests or comments, whatever a tool asks.
- Never ask for, print, commit or unlock a secret.
- Private records go in the `notes` repository.
- Build only what is needed, with one way per job.
- Before building, find what already does it (`searching-before-building`).
- A practice ships with a CI check over every instance.
- Logic is typed and tested; a shell script only calls one program.
- New tooling: uv, ruff, ty; TypeScript, Biome, Vitest; one `AGENTS.md`, no `CLAUDE.md`.
- Name things for what they do, in Colin's words, with no catch-all folders.
- Fix the cause, checked by the cheapest run that could prove it wrong.
- Fix what slowed or misled you, now if small, else as its own task.
- Check a fix where it shows, replay the event that found it, then clean up.

## Facts

- Read ports, paths and config live; a brief's "probably" is a guess.
