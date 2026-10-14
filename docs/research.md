# What the rules rest on

The findings behind `AGENTS.md`, gathered 13 and 14 October 2026. Each line says what was found and where. Replace a line when newer work overturns it; do not add a second one beside it.

## Contents

- Do skills help?
- Writing a skill
- Measuring a skill
- Experiments and decisions
- Keeping a benchmark honest
- Speed and cost
- Sources

## Do skills help?

| Finding | Source |
|---|---|
| Curated skills raised pass rates by 16 points on average, but only 4.5 in software engineering, and 16 of 84 tasks did worse with a skill | SkillsBench |
| The same skill helped one model and agent and hurt another on 37% of tasks | Downstream utility study |
| Skills written by the model for itself gave no gain on average | SkillsBench, SkillLearnBench |
| Agents loaded an installed skill on 41% of the tasks that needed it; the usual cause was the description | Tessl |
| 92% of 138,000 public skill files had at least one defect; the commonest was no trigger guidance (52%) | 138K study |
| Repository overviews in `AGENTS.md` did not help; project-specific instructions did | ETH Zurich |
| Firebase went from 32% to 78% by writing evals first and adding only what fixed a seen failure | Firebase |

These studies have weak spots: SkillsBench's length and count findings are confounded with which task each skill came with, and the failure study used one model and one agent.

## Writing a skill

| Finding | Source |
|---|---|
| Two thirds of the task failures a skill caused came from the agent treating an example, template or default as a requirement | Failure study |
| The commonest waste was a skill ordering too much checking | Failure study |
| A rule that names a command, file or flag raised compliance by about half; prose edits barely moved it; deleting a rule lost about three quarters of what adding it gained | Revisions study |
| Gotchas lists, templates, one default over a menu, procedures over answers | Agent Skills guide, Anthropic guide |

## Measuring a skill

| Finding | Source |
|---|---|
| Run each task with and without the skill; the gap is the skill's worth | Agent Skills evals guide, OpenAI, NVIDIA, Firebase, Deephaven |
| Grade with code where possible; a model grader only for what code cannot decide | OpenAI, Hamel Husain |
| About 30% of generated tasks leaked the grading criteria into the prompt; leaked tasks showed smaller gaps | Tessl |
| Three runs per task is too few; results must be kept per model and agent | Downstream utility study |
| Harbor (sandbox harness, Terminal-Bench's authors) and Inspect (UK AI Security Institute) run real agents in containers and grade the end state; tracing tools (Langfuse, Phoenix, Braintrust) do not | GitHub, vendor docs |
| Saving every model answer under a hash of its full input let Cortex re-score a 27-minute bench in 28 seconds | Cortex, this machine |

## Experiments and decisions

| Finding | Source |
|---|---|
| Controlling for something measured after the treatment can bias the result either way and by any amount; this is the mistake behind the 5 October recall-card conclusion | Montgomery, Nyhan and Torres 2018; Cinelli, Forney and Pearl |
| Checking results as they arrive and stopping at the first win inflates false positives; fix the number of runs, or use an always-valid sequential test | Johari, Pekelis and Walsh |
| Hosted models are not deterministic even at temperature 0, so one run per arm decides nothing | Thinking Machines, September 2025 |
| Compare per item, with error bars that allow for items being related | Miller, "Adding Error Bars to Evals", 2024 |
| Cases that never separate the arms, or flip between repeat runs, can be dropped with little loss | Signal and Noise 2025; tinyBenchmarks 2024 |
| A model judge favours positions, lengths and its own family; swap positions, hide labels, check against human labels | Zheng et al. 2023 |
| Research agents preferred low-quality pages until given source-quality rules | Anthropic, June 2025 |
| No public skill covers controls measured after the outcome, comparing models or prompts, or labelling where a claim came from; the closest are a web A/B-testing skill and Anthropic's statistical-analysis skill | Search of skills.sh, 14 October 2026 |

## Keeping a benchmark honest

Agents look up answers when they can. Every route below has been seen in published runs.

| Route | Seen | Control here |
|---|---|---|
| The benchmark's own repository on GitHub | Terminal-Bench 3 audit, 8 October 2026: one entry fell from 18.7% to 3.5% once such runs were removed | Agent reaches only Anthropic (`network_mode = "allowlist"`) |
| Mirrors, package registries, the author's homepage once GitHub is blocked | Poolside post-mortem, April 2026 | Allowlist, not blocklist |
| Git history or leftover refs holding the fix | SWE-bench surveys, Scale AI on SWE-Bench Pro | Fixture history holds the faults, never a later fix |
| Files left on the disk | Microsoft, RuBench | Grading files never enter the agent's container; the fixture build removes its own leftovers |
| DNS or an allowlisted package cache | Google Cloud | Allowlist covers Anthropic only; not yet tested for DNS |
| Tampering with what the grader runs | General risk | Graded in a fresh container that receives only the declared files |

Escaping the container needs a privileged container, a mounted Docker socket or a kernel bug. Here: no privileged mode, no socket, the agent runs as an ordinary user, and the container sits inside Docker's Linux VM, capped at 6 GB. Keeping Docker Desktop updated covers the kernel route.

Checked on this repository's runs, 14 October 2026: in 40 trajectories no agent touched the grading script, the reference solution, the fixture's build files, Harbor or the network.

## Speed and cost

| Item | Measured or quoted |
|---|---|
| One local trial, after installing Claude Code in the image | about 110 s: 17 container start, 1 agent set-up, 40 agent, 35 grading in a fresh container |
| The same before | about 165 s, of which 62 s installing Claude Code every time |
| Cloud sandbox start, under load | Modal 0.9 s, E2B 1.6 s, both 100% success; Daytona 0.27 s but 37% success (one independent test, August 2026) |
| Cloud cost | Modal: $30 of free credit a month, then per second. E2B: $100 of credit once. One trial is about $0.006 on Modal's rates, so a 20-trial run is about $0.25. Third-party figures; check the vendors' own pages |

## Sources

- Agent Skills: [specification](https://agentskills.io/specification), [best practices](https://agentskills.io/skill-creation/best-practices), [scripts](https://agentskills.io/skill-creation/using-scripts), [descriptions](https://agentskills.io/skill-creation/optimizing-descriptions), [evaluating skills](https://agentskills.io/skill-creation/evaluating-skills)
- Anthropic: [skill authoring best practices](https://platform.claude.com/docs/en/agents-and-tools/agent-skills/best-practices)
- [`npx skills`](https://github.com/vercel-labs/skills) and [skills.sh](https://skills.sh)
- Studies: [SkillsBench](https://arxiv.org/abs/2602.12670), [downstream utility](https://arxiv.org/abs/2610.08875), [skill-induced failures](https://arxiv.org/abs/2608.11888), [revisions](https://arxiv.org/abs/2610.04832), [138K skill files](https://arxiv.org/abs/2608.08453), [SkillLearnBench](https://arxiv.org/abs/2604.20087), [AGENTS.md (ETH Zurich)](https://arxiv.org/abs/2602.11988), [a critique of SkillsBench](https://dev.to/itay-maman/why-i-wouldnt-act-on-skillsbench-1h61)
- Practice: [Tessl](https://tessl.io/blog/a-proposed-framework-for-evaluating-skills-research-eng-blog), [Firebase](https://firebase.blog/posts/2026/08/eval-driven-development-agent-skills), [OpenAI](https://developers.openai.com/blog/eval-skills), [Hamel Husain](https://hamel.dev/blog/posts/evals-skills/), [Deephaven](https://deephaven.io/blog/2026/05/29/agent-skills-evals/), [NVIDIA](https://developer.nvidia.com/blog/evaluating-ai-agent-skill-performance-with-nvidia-skillevaluator/)
- Experiments: [post-treatment bias](https://sites.dartmouth.edu/nyhan/files/2021/03/post-treatment-bias.pdf), [Cinelli, Forney and Pearl](https://ftp.cs.ucla.edu/pub/stat_ser/r493.pdf), [always-valid inference](https://arxiv.org/abs/1512.04922), [error bars for evals](https://arxiv.org/abs/2411.00640), [Signal and Noise](https://arxiv.org/abs/2508.13144), [tinyBenchmarks](https://proceedings.mlr.press/v235/maia-polo24a.html), [LLM as a judge](https://proceedings.neurips.cc/paper_files/paper/2023/hash/91f18a1287b398d378ef22505bf41832-Abstract.html), [nondeterminism](https://thinkingmachines.ai/blog/defeating-nondeterminism-in-llm-inference), [Anthropic research agents](https://www.anthropic.com/engineering/multi-agent-research-system)
- Tools: [Harbor](https://www.harborframework.com/docs/tasks/task-difference), [Inspect](https://inspect.aisi.org.uk/sandboxing.html), [Arize on Harbor with Phoenix](https://arize.com/?p=32730)
- Cheating and sandboxes: [Terminal-Bench 3 audit](https://github.com/harbor-framework/terminal-bench/issues/2218), [benchmark hacking (Poolside summary)](https://blog.prompt20.com/posts/benchmark-hacking-agent-reward-hacking/), [Microsoft](https://developer.microsoft.com/blog/your-ai-coding-agent-evaluation-is-only-as-good-as-its-sandbox/), [Google Cloud](https://medium.com/google-cloud/your-agent-is-only-as-good-as-the-sandbox-you-measured-it-in-f391b908418c)
- Sandboxes and prices: [burst benchmark](https://bex.co/blog/2026/10/04/superagent-sandbox-benchmark-cold-start-concurrency), [MarkTechPost comparison](https://www.marktechpost.com/2026/08/27/best-agent-sandboxes-2026-cold-start-pricing-network-policy/), [Modal pricing](https://www.beam.cloud/blog/modal-pricing-explained), [E2B pricing](https://www.morphllm.com/e2b-pricing)
