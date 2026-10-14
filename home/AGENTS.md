# How Colin wants agents to work, in every project

From a catalogue of his corrections to agents (963 prompts, 30 September to 14 October 2026). Each rule here was given more than once, often after it had already been written into one repo.

## Keep each rule at one level

The levels, highest first: this file, a project's `AGENTS.md`, that project's documents and skills. A rule lives at the highest level it applies to, and nowhere else.

- **When a project's `AGENTS.md`, documents or skills repeat a rule from this file,** cut the repeat and, if a pointer helps, point here. Do it in the turn you notice it.
- **When you write or edit an instruction or a document,** check it against the levels above and leave out what they already say.
- **When the same rule turns up in two or more projects,** move it here (`home/AGENTS.md` in the agents repository, then run `python scripts/install_home.py --apply` there) and cut the copies.

## Replies

He runs about ten pieces of work at once and skims each reply for what he has to do. Every reply is something he can take in at a glance.

- **Short, high level by default.** What happened in plain words, shaped to be scanned: a table, bullets or a small diagram beat paragraphs, and visuals help him most. No fixed length. Technical detail (files, causes, numbers) only when he asks for it.
- **Then his action list:** only what he has to do, a few short bullets, most important first. "Nothing" when nothing.
- **Always say what's next,** and do it yourself when you can, so he never has to ask "what's next?".
- **No internal names, numbered references or jargon** he would have to ask about. Link the exact page or file he should look at.
- **One decision at a time.**

## Doing the work

- **Do it yourself, without asking.** Run commands, installs, sign-ins and setup steps instead of handing them over. Ask only when a step is destructive or hard to undo, touches secrets, money, his private data or anything public, or needs the GPU.
- **Finish the list.** When a next step follows from the work, do it in the same turn. Do not end on "Shall I...?" or "Go?". Stop only for his data, money, privacy or a real blocker.
- **Build only what a present need calls for,** and say what any extra work buys. No unrequested files or features.
- **Turn a step done by hand twice into one kept command,** with one entry point that runs everything.
- **Get an independent review** (an advisor or a fresh agent) of a plan, method or design before running it.

## Facts and settings

- **Read ports, paths and config live** before using them, never from memory earlier in the session.
- **Before saying something is out of reach,** check the connectors and browser tools attached to the session.
- **Look in his notes and earlier answers** before asking for a fact he already gave.
- **When he states a preference or rule, write it into that repo's AGENTS.md** in the same turn.

## His machine

- **Windows, PowerShell 7.** Run any command you hand him in that shell first: quoting, PATH and certificates have broken handed-over commands.
- **The GPU and PC are his first.** Ask before starting a GPU run, and stop yours the moment he wants to game.
- **Large installs and data go on D:,** not C:.
- **Before taking a port or another shared resource,** check what is in use and tell other running sessions what changed.

## Git

- **No feature branches or pull requests** unless he asks or work runs in parallel. How often to commit is set in each repo's AGENTS.md.
