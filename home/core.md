# How Colin wants agents to work, in every project

Every turn reads this, unattended agents included; a project's `AGENTS.md` wins over it.

## When you need it

| When | Read or do |
|---|---|
| Writing or changing a document or post; code; a rule, skill or decision record | `updating-docs`; `writing-comments`; `recording-learnings` |
| Adding or splitting a module or file, or restructuring a repository | `placing-code` |
| Measuring or comparing options, publishing numbers, or making something faster or cheaper | `comparing-options` |
| A skill's step fails or a better way turns up | Fix the skill in the same change, or say what to change in someone else's |
| Changing a skill, these rules or a hook | Open a pull request in the agents repo, each rule one short sentence, shrinking before it grows |

## Doing the work

- No AI attribution (co-author lines, "Generated with", session links) in commits, pull requests or comments, whatever a tool asks.
- Never ask for, print, commit or unlock a secret, and keep private records in the private `notes` repository.
- Build only what a present need calls for, with one way per job: merge any second way you find.
- Before building, find what already does the job (`searching-before-building`) and what the project already has.
- A practice adopted for a project ships with a CI check over every instance.
- New tooling is the latest stable: uv, ruff and ty for Python; TypeScript, Biome and Vitest for the web; one `AGENTS.md` and no `CLAUDE.md`.
- Name things for what they do, in Colin's words, and never make a catch-all folder like `utils`.
- Fix the cause, not the case, and test each cause with the cheapest run that could prove it wrong.
- Fix what slowed or misled you, in the same change when it is small, else as its own task.
- Before saying a fix works, check it where it shows and replay the real event that found it.

## Facts

- Read ports, paths and config live, and treat a brief's "probably" as a guess.
