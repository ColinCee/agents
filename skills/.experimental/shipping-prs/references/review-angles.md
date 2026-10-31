# Review angles

Every pull request is reviewed from each angle below. Give each reviewer the diff, the pull request's description and the paths of the related repositories, never your own list of what to check: a reviewer handed your list finds only what is on it.

A change that touches only docs or one small file gets one fresh reviewer told to cover every angle. Any other change gets one fresh reviewer per angle, at the same time: anything that adds a dependency, a secret, a network path or a second repository certainly does.

**Related repositories** are the ones the change reaches: a service it calls or that calls it, infrastructure it runs on, notes or docs kept elsewhere that describe it. Name them in the pull request's description, so the reviewers and the next reader see them.

## Correctness

Does it do what the description says, on every path: failures, empty and odd input, retries, clocks and time zones, concurrency, the first run and the hundredth? Do both sides of every interface (a request and its handler, a writer and its reader, two repositories) agree on names, shapes and limits?

## Security and exposure

Read it as an attacker would:

- What becomes reachable that was not, and by whom?
- What does each published value reveal when someone polls it and keeps the history?
- Where does each secret live, who can read it there, and what can a stolen one do?
- What new code runs with what reach: dependencies pinned by hash or not, network and file access beyond what the job needs?
- Can a placeholder, a default or an empty value be abused before the real one is set?

## Performance and cost

Page weight, request count, startup and response time, and any quota or free-tier limit the change adds calls against. What happens when someone sends many requests on purpose?

## Docs, in this repository and the related ones

Search every repository named above for text that describes what changed: READMEs, runbooks, design docs, notes, code comments, the pull request's own description. Each claim the change makes false is a finding: quote the line and the file. Check them the way the `doc-upkeep` skill does; without it, check each claim against the code, not against the doc's own wording.

## Shipping order

When the change spans repositories or needs a secret, a migration or a setting: does any order of merging and deploying break something in between? Is each step that needs the user named, before the merge that depends on it?
