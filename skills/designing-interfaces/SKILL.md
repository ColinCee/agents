---
name: designing-interfaces
description: Designs pages, dashboards and charts that answer their reader at a glance, minimal and technical, with colour only for results and every chart labelled. Use when designing, building or changing a page, dashboard, app screen or chart.
license: MIT
---

What a page must answer comes before how it looks; the rest keeps it quiet enough to read at a glance. Each rule is binding; the values in brackets are examples.

## Before any screen

- **Write who uses it and what it must answer.** Who reads it, on what (a phone, a link an agent sent, a desktop), and the few questions it answers at a glance. Every element answers one of them or goes. Put this in the project's own product or design doc, beside the code.
- **Show real variants, working.** Two or three directions as working pages with real data at real size, not mockups or text art. After the pick, leave the dev server running on the change's branch, so the person sees the change itself before it merges.

## Look

- **Minimal and technical,** on the component library the project already has (shadcn where it is there): neutral colours, hairlines, small type (13px), numbers in monospace.
- **Colour only for a result:** good, bad, unsure. Never for decoration, a category or emphasis.
- **One number format** for one quantity across the page (a signed percent change everywhere, not a ratio in one place and a percent in another).
- **Words only for names and verdicts.** What a mark means (a band, a dashed line, a colour) is said once on the page, never under each chart.
- **A detail view adds to its row and never repeats it:** what the row already shows stays out.
- **No dot, bullet or bar between two facts** (`12 tasks · 3 days`): each fact gets its own labelled place.
- **Every chart has labelled axes with units.**
- **Panels side by side start at the same top edge.**

## Behaviour

- **Hover or focus previews, a click keeps.** Leaving returns to what was kept.
- **Every change of state moves, briefly (about 150ms) and slightly;** nothing moves under `prefers-reduced-motion: reduce`.
- **Each behaviour gets an end-to-end test** that drives the page as a person would.
