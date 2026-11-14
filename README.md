# agents

Skills, instructions and tools for coding agents.

## Skills

| Skill | Loads | What it does |
|---|---|---|
| [shipping-prs](skills/shipping-prs/SKILL.md) | by itself | Takes a pull request from opened to merged: tests, fresh reviews, every automated comment answered and resolved. Used daily; not yet tried against a run without it. |
| [reviewing-changes](skills/reviewing-changes/SKILL.md) | by itself | Fresh reviewers check a change from fixed angles: correctness, running it as users do, design, moved code, security, cost, docs, shipping order. [Finds about as many bugs as a plain review](bench/reviewing-changes/README.md), at 2.6 times the cost. |
| [designing-modules](skills/designing-modules/SKILL.md) | by itself | Designs a split or a new module two ways and keeps the one with fewer names crossing module lines and no load-time import cycle. [Smallest interface, but no higher score](bench/designing-modules/README.md) than without it, on one split. |
| [updating-docs](skills/updating-docs/SKILL.md) | by itself | Keeps docs and posts true, short and easy to scan: only what must be kept, stale lines fixed in place, one home per fact. |
| [writing-comments](skills/writing-comments/SKILL.md) | by itself | Keeps code comments to why, never what the code does or its history. |
| [recording-learnings](skills/recording-learnings/SKILL.md) | by itself | Puts each lesson, rule or decision in its one home in git, and keeps `AGENTS.md` short. Not yet tried on its own. |
| [comparing-options](skills/comparing-options/SKILL.md) | by itself | Decides from evidence: one question, the ground truth, a fair repeated comparison. |
| [optimizing-performance](skills/optimizing-performance/SKILL.md) | by itself | The loop for making something faster: profile, change one thing, keep or revert, then report before, now and where the time left goes. Tried once, on homelab CI. |
| [tidying-repos](skills/tidying-repos/SKILL.md) | `/tidying-repos` | A full clean-up pass in a safe order: what could be lost, code health, unused code, docs. |
| [reviewing-sessions](skills/reviewing-sessions/SKILL.md) | `/reviewing-sessions` | Finds what you keep correcting, typed or edited by hand in the agent's text, fixes each where it belongs, and measures whether the fix works. |
| [restructuring-code](skills/restructuring-code/SKILL.md) | by itself | Moves code grown by appending into folders by job and deep modules behind small interfaces. Barely tried: loaded by one session. |
| [budgeting-page-performance](skills/budgeting-page-performance/SKILL.md) | by itself | Fails CI when a web page gets heavier or slower than its budget: bytes by type, requests, LCP. Never tried. |

```bash
npx skills add ColinCee/agents --global --skill '*' --agent claude-code
```

Results with and without each skill: [bench/](bench/).

Other people's skills I use:

| Skill | Loads | What it does | Install |
|---|---|---|---|
| [asd-ste100](https://github.com/danyuchn/asd-ste100-skill) | by itself | Rewrites dense or ambiguous English into short, one-meaning sentences (Simplified Technical English), for text an agent must parse. | `npx skills add danyuchn/asd-ste100-skill --global --agent claude-code` |

## Instructions for agents

[home/core.md](home/core.md) and [home/desktop.md](home/desktop.md): how every agent should work with me, and what applies only when I am there. Install: `npm run install-home -- --apply`.

That also installs the skills kept in my other repos beside what they describe (`reaching-homelab-devices`, in homelab; not in CI), and [home/hooks/require-skill.mjs](home/hooks/require-skill.mjs) with its entry in `~/.claude/settings.json`. The install also turns Claude Code's auto memory off in that file: what an agent learns goes in git. The hook refuses a step until the skill for it is loaded: `shipping-prs` before a first push or a pull request, `comparing-options` before a benchmark, and before an edit `updating-docs` (a doc), `writing-comments` (code) or `recording-learnings` (agent rules, a skill or a decision record).

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
