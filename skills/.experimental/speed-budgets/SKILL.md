---
name: speed-budgets
description: Sets up and keeps page speed budgets that fail CI when a web page gets heavier or slower in bytes by type, requests or LCP. Use when asked to add performance budgets, test page speed in CI, or find out why a page got slower.
license: MIT
---

A budget is a test: each page type's numbers today, plus headroom, checked on every change. Every step is binding; the numbers in them are defaults that worked, not requirements.

## Setting up

1. **Measure with the browser test runner the project already has** (Playwright, else add it), against the production build served locally, not the dev server, which serves files unbundled. Lighthouse CI's default simulated LCP rebuilds load time from the network graph, so it misses delays a page makes itself, such as an entrance animation; use it only when the project asks for Lighthouse scores.
2. **One test per page type** (home, a list page, a content page with code or figures, any other template), each load in a fresh browser context so the cache is empty. Throttle with the devtools protocol's `Network.emulateNetworkConditions` (Chromium only, a session per page): throughput is in bytes a second, so 1.6 Mbps is `downloadThroughput: 200000`, with `latency: 150` (ms). Load at phone size, with motion on. For each page record:
   - bytes by resource type (HTML, styles, scripts, fonts, images) and the total, from each finished request's `responseHeadersSize + responseBodySize` (Playwright's `request.sizes()`; the body size is as sent, so compressed when the server compresses);
   - the request count;
   - LCP, the median of three loads, from a `largest-contentful-paint` observer with `buffered: true`. No click or scroll before reading it: input ends LCP.
3. **Make the page the same every run.** Answer calls to live APIs (weather, analytics, feeds) with a fixed response. Fetch the site's own third-party assets (web fonts, a CDN script) for real, since visitors download them. Fail the test on any failed request or 4xx/5xx response: a missing file makes a page look lighter and pass.
4. **Budgets from today's numbers:** bytes 10% or 3 KB over, whichever is more (a small file can take a small edit, a big one can't grow much); requests two more; LCP 30% over. Put them in the test as one table, and on failure print the page, the metric, the measured value and the budget. Allow one retry, for timing spikes on shared CI machines.
5. **Wire it in:** one package script that builds and runs it, the project's check command, and a CI step after the build. Say in the project's agent instructions that a budget is raised only with the reason in the change that raises it.
6. **Write down why the numbers are what they are**, in the project's docs: the method, the headroom rule and today's numbers, so the next person can tell a real regression from noise.

## A page got slower

Find what LCP waits for before changing anything. Rerun with reduced motion (it only stops animations the CSS gates on `prefers-reduced-motion`; else inject CSS that sets every animation and transition to zero): if LCP drops to first paint with the same bytes, an animation is the cause, not loading, and the fix changes how the page looks; that is a design decision for the user. Otherwise compare bytes by type with the last good build.

## Gotchas

- Read LCP after the first screen's animations finish (poll `document.getAnimations()` until none with a finite `getComputedTiming().endTime` is running, since one started by a script or observer joins late. Cap the wait at a few seconds and fail when something is still running at the cap, unless the test lists it as expected (a timer bar, a looping reel): reading LCP then would take an earlier candidate and let a slow page pass; `finished` rejects when an animation is cancelled, so wait with `Promise.allSettled`), not after a fixed wait: an entrance longer than the wait leaves an earlier, smaller candidate as the result.
- A local preview server usually sends files uncompressed, over HTTP/1.1. Budget the uncompressed bytes (steadier than estimating compression) and say in the docs that production sends less.
- A request that fails never fires the finished event, so counting only finished requests hides it. Listen for failures too.
- A CI runner's timings differ from a laptop's (about 10% either way). Bytes should match exactly; if they don't, something on the page varies between runs.
- Pick a content page whose text is settled, so editing a post doesn't move its budget.
