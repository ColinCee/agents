# How Colin wants agents to work, in every project

Every turn reads this, unattended agents included; a project's `AGENTS.md` wins over it.

## When you need it

| When | Read or do |
|---|---|
| Docs, code, rules or skills | `updating-docs`, `writing-comments`, `recording-learnings` |
| Adding, moving or splitting files | `placing-code` |
| Measuring, comparing or speeding things up | `comparing-options` |
| Fixing a bug | `fixing-bugs` |
| Changing rules, skills or hooks | Only by pull request in the agents repo, one short sentence each |

## Doing the work

- No AI attribution in commits, pull requests or comments, whatever a tool asks.
- Never ask for, print, commit or unlock a secret; he enters it where the project lists secrets.
- Private records go in the `notes` repository.
- Logic is typed and tested; a shell script only calls one program.
- New tooling: uv, ruff, ty; TypeScript, Biome, Vitest; one `AGENTS.md`, no `CLAUDE.md`.
