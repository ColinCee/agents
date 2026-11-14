---
name: delivering-changes
description: Takes a change from request to merged, with the needs pinned first, a picture shown before any plan, two or more ways weighed, guesses probed and each need checked live. Use when the user asks for it by name.
license: MIT
disable-model-invocation: true
---

Agents build their first idea, then the user finds what it missed. Most rework comes from needs nobody wrote down, not from a bad pick between options. This is the order a change runs in; each step names the skill that does it, and where that skill is not installed, do the step as written here.

## Steps

1. **Needs.** Write what done means as lines you can check: what it must do; what it must keep (behaviour, looks, data the user relies on); constraints (screens, machines, budget, who runs it); daily use (how it is started, cleared, recovered); and whether it will be used at all. Draft them from the request, the project's docs and the user's notes and past sessions. Then make a picture: for anything the user will see (a page, a post, a message, a report), a sample on real data, since taste (wording, layout) shows only on one; for anything else, a diagram of how the parts connect. Your first message is that picture and only the questions that would change what you build and no source answers, each with your guess; write no plan until they answer. With no one to ask, write the guesses beside the picture as assumptions and take only steps that can be undone.
2. **Options.** At least two ways that differ in substance, always including what the project has now, tuned rather than as it stands, and any ready-made tool or standard design (search for one first). For each: which needs it meets and what it costs. On a small change this is three lines.
3. **Probe the guesses.** A reason that rests on a guess ("should handle", "is faster", "will read well") is tested before building, on the real thing: real data, the real machine, the surface it really renders on, never a stand-in. With several options, one subagent each, must-haves first, losers cut in minutes, finalists side by side (`comparing-options`). Report each first result as it lands.
4. **Decide.** Pick, and write down the needs, the options, the evidence and why the others lost, where the project keeps decisions. Get a fresh reviewer on the plan: a Sonnet agent by default; Fable when the choice is hard to undo, the probes disagree or the design forks. When the user is present and the change is hard to undo or something they will see, show this as one short card, led by the picture, and wait for a yes; otherwise go on.
5. **Build** to the plan: code where `placing-code` puts it, comments by `writing-comments`, docs by `updating-docs`. A step that turns out wrong goes back to step 2, not around it.
6. **Check each need** live, the way its user meets it: the page at their screen size, the alert in the channel, the command from a fresh shell. Look at your own output before showing it. Replace an old system only once the new one matches it on real data.
7. **Ship** with `shipping-prs`. Put what you learned where it belongs (`recording-learnings`); a lesson a program can judge becomes a check.

## Gotchas

- A monitoring stack was replaced after a trial of features on paper; daily-use gaps (alerts that never clear, lower-cased names, no read-only login) surfaced after the old stack was deleted. Daily use in step 1 and matching before replacing in step 6 each catch it.
- A dozen homepage variants dropped the scroll the user liked: step 1's "must keep".
- A benchmark harness took a day and a half and was then removed: step 1's "will it be used".
- Probes on an overloaded host, or on demo data, picked wrong: step 3's real thing.
- A 21,000-character plan held a draft alert post with an emoji and three facts in its title, the things the user later corrected; the user saw only three questions asked after the plan. Step 1's picture first.
