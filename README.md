# agents

Skills, instructions and tools for coding agents.

## Skills

| Skill | Loads | What it does |
|---|---|---|
| [placing-code](skills/placing-code/SKILL.md) | by itself | Where code goes: folders by job, files and tests beside what uses them, no catch-all folders, splits with the fewest names crossing modules, safe moves. [Beat no skill by more than chance at laying out two repositories](bench/placing-code/README.md). |
| [designing-interfaces](skills/designing-interfaces/SKILL.md) | by itself | Pages, dashboards and charts that answer their reader at a glance: who and what first, colour only for results, labelled axes, hover previews and a click keeps. [Its rules followed where no skill followed them, on a dashboard task](bench/designing-interfaces/README.md). |
| [writing-comments](skills/writing-comments/SKILL.md) | by itself | Keeps code comments to why, never what the code does or its history. [Tried inside `updating-docs`](bench/updating-docs/README.md), before the two split. |
| [updating-docs](skills/updating-docs/SKILL.md) | by itself | Keeps docs and posts true, short and easy to scan: only what must be kept, stale lines fixed in place, one home per fact. |
| [recording-learnings](skills/recording-learnings/SKILL.md) | by itself | Puts each lesson, rule or decision in its one home in git, and keeps `AGENTS.md` short. Not yet tried on its own. |
| [shipping-prs](skills/shipping-prs/SKILL.md) | by itself | Takes a pull request from opened to merged: tests, a fresh review, every comment answered, then the merge. Used daily; [its review angles found no more bugs than a plain review](bench/shipping-prs/README.md), so they are read only for risky changes. |
| [searching-before-building](skills/searching-before-building/SKILL.md) | by itself; the hook asks for it before a new code file | Before anything is built, asks a fresh agent only which maintained tool, library or built-in rule already does each job. Not yet tried on its own. |
| [comparing-options](skills/comparing-options/SKILL.md) | by itself | Decides from evidence: one question, the ground truth, a fair repeated comparison; and the loop for making something faster. |
| [delivering-changes](skills/delivering-changes/SKILL.md) | `/delivering-changes` | A change from request to merged: needs and a picture you can react to first, then options, probes, checks. [Unproven](bench/delivering-changes/README.md): tried by hand. |
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

[home/core.md](home/core.md), [home/present.md](home/present.md) and [home/local.md](home/local.md): how every agent should work with me, what applies only when I am in the chat, and what applies only on my own machines. Install: `npm run install-home -- --apply`.

That also installs the skills kept in my other repos beside what they describe (`reaching-homelab-devices`, in homelab; not in CI), and [home/hooks/require-skill.mjs](home/hooks/require-skill.mjs) with its entry in `~/.claude/settings.json`. The install also turns Claude Code's auto memory off in that file: what an agent learns goes in git. The hook refuses a step until the skill for it is loaded: `shipping-prs` before a first push or a pull request, `comparing-options` before a benchmark, and before an edit `updating-docs` (a doc), `writing-comments` (code) or `recording-learnings` (agent rules, a skill or a decision record).

A cloud environment (claude.ai) starts each session from a fresh container, so its setup script runs the same install with `--cloud`: everything but `local.md`. Its network must allow github.com and raw.githubusercontent.com, or the script fails and no session starts. It takes `main` as of each container's build:

```bash
rm -rf /opt/agents && git clone --depth 1 https://github.com/ColinCee/agents /opt/agents && node /opt/agents/tools/install-home.ts --apply --cloud
```

## Tools

| Tool | What it does | Install |
|---|---|---|
| `run-job` | Installed but no longer used by agents (ADR 0001). Runs agents' heavy jobs side by side on spare capacity at low priority, by the cores and RAM each used before, holding back while a game runs; locks the GPU or a browser for jobs that cannot share; one row above the Claude Code prompt shows it. | `npm run install-run-job` |
| [agent-experiments](https://github.com/ColinCee/agent-experiments) | Tests whether a rule change works, on past moments and then on a random half of tasks, and draws one daily page. | Its code is pinned in [reviewing-sessions](skills/reviewing-sessions/SKILL.md), step 6 |

## Why so few skills

- Every installed skill costs context.
- A skill can make an agent worse: about one task in five, in published tests.
- Nobody knows how several skills mix.

So a skill stays only while it clearly helps. Sources: [docs/research.md](docs/research.md). Rules for this repository: [AGENTS.md](AGENTS.md).
