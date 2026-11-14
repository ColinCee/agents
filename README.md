# agents

Skills, instructions and tools for coding agents.

## Skills

| Skill | Loads | What it does |
|---|---|---|
| [placing-code](skills/placing-code/SKILL.md) | by itself | Where code goes: folders by job, files and tests beside what uses them, no catch-all folders, splits with the fewest names crossing modules, safe moves. [Beat no skill by more than chance at laying out two repositories](bench/placing-code/README.md). |
| [writing-comments](skills/writing-comments/SKILL.md) | by itself | Keeps code comments to why, never what the code does or its history. |
| [updating-docs](skills/updating-docs/SKILL.md) | by itself | Keeps docs and posts true, short and easy to scan: only what must be kept, stale lines fixed in place, one home per fact. |
| [recording-learnings](skills/recording-learnings/SKILL.md) | by itself | Puts each lesson, rule or decision in its one home in git, and keeps `AGENTS.md` short. Not yet tried on its own. |
| [shipping-prs](skills/shipping-prs/SKILL.md) | by itself | Takes a pull request from opened to merged: tests, a fresh review, every comment answered, then the merge. Used daily; [its review angles found no more bugs than a plain review](bench/shipping-prs/README.md), so they are read only for risky changes. |
| [comparing-options](skills/comparing-options/SKILL.md) | by itself | Decides from evidence: one question, the ground truth, a fair repeated comparison; and the loop for making something faster. |
| [tidying-repos](skills/tidying-repos/SKILL.md) | `/tidying-repos` | A full clean-up pass in a safe order: what could be lost, code health, unused code, docs. |
| [reviewing-sessions](skills/reviewing-sessions/SKILL.md) | by itself, or `/reviewing-sessions` | Finds what you keep correcting, typed or edited by hand in the agent's text, fixes each where it belongs, and measures whether the fix works. |

```bash
npx skills add ColinCee/agents --global --skill '*' --agent claude-code
```

Results with and without each skill: [bench/](bench/).

Other people's skills I use:

| Skill | Loads | What it does | Install |
|---|---|---|---|
| [asd-ste100](https://github.com/danyuchn/asd-ste100-skill) | by itself | Rewrites dense or ambiguous English into short, one-meaning sentences (Simplified Technical English), for text an agent must parse. | `npx skills add danyuchn/asd-ste100-skill --global --agent claude-code` |
| [modern-web-guidance](https://github.com/GoogleChrome/modern-web-guidance) | by itself | Web platform guides with browser-support data, searched with its CLI, so agents use current HTML, CSS and JavaScript features with fallbacks instead of legacy patterns. | `claude plugin marketplace add GoogleChrome/modern-web-guidance`, then `claude plugin install modern-web-guidance@googlechrome --scope user` |

## Instructions for agents

[home/core.md](home/core.md) and [home/desktop.md](home/desktop.md): how every agent should work with me, and what applies only when I am there. Install: `npm run install-home -- --apply`.

That also installs the skills kept in my other repos beside what they describe (`reaching-homelab-devices`, in homelab; not in CI), and [home/hooks/require-skill.mjs](home/hooks/require-skill.mjs) with its entry in `~/.claude/settings.json`. The install also turns Claude Code's auto memory off in that file: what an agent learns goes in git. The hook refuses a step until the skill for it is loaded: `shipping-prs` before a first push or a pull request, `comparing-options` before a benchmark, and before an edit `updating-docs` (a doc), `writing-comments` (code) or `recording-learnings` (agent rules, a skill or a decision record).

A cloud environment (claude.ai) starts each session from a fresh container, so its setup script runs the same install with `--unattended`: `core.md` without `desktop.md`, plus the skills and hooks. Its network must allow github.com and raw.githubusercontent.com, or the script fails and no session starts. It takes `main` as of each container's build:

```bash
rm -rf /opt/agents && git clone --depth 1 https://github.com/ColinCee/agents /opt/agents && node /opt/agents/tools/install-home.ts --apply --unattended
```

## Tools

| Tool | What it does | Install |
|---|---|---|
| `lease` | Locks the GPU, RAM or a browser so agents and programs on one machine don't collide; one row above the Claude Code prompt shows RAM, holders and the GPU. | `npm run install-lease` |
| [agent-experiments](https://github.com/ColinCee/agent-experiments) | Tests whether a rule change works, on past moments and then on a random half of tasks, and draws one daily page. | Its code is pinned in [reviewing-sessions](skills/reviewing-sessions/SKILL.md), step 6 |

## Why so few skills

- Every installed skill costs context.
- A skill can make an agent worse: about one task in five, in published tests.
- Nobody knows how several skills mix.

So a skill stays only while it clearly helps. Sources: [docs/research.md](docs/research.md). Rules for this repository: [AGENTS.md](AGENTS.md).
