---
name: ui-decluttering
description: Redesigns a cluttered screen so the user decides quickly: one primary action, few choices in view, nothing unrelated, controls that look like what they do. Use when a page, sidebar or panel is messy, has too many buttons, or causes decision fatigue.
license: MIT
---

A screen exists for one decision. Every button, number and link on it either helps that decision or is in the way.

## Steps

1. **Name the decision** the screen is for, in one line, and the answer most people give. That answer is the one primary action.
2. **List every element in view**: buttons, links, toggles, dropdowns, numbers, notes. For each, say which part of the decision it serves.
3. **Cut, hide or keep**, in that order of preference:
   - Not about this decision (feed counts, totals, other items' state): remove it from this screen.
   - Needed now and then: put it behind one "More" control, so it is reachable but not in view.
   - Needed most times: keep it in view, styled quiet.
4. **Keep the numbers small**: one primary action, and at most four choices in view including it. Count them in the rendered page, not in the code: fetch the page, or open it in a browser, and count the buttons, links and controls visible without opening anything.
5. **Make each control look like what it does.** A switch is a checkbox or toggle that shows its state; a link goes somewhere; a button acts. An arrow (→) promises navigation.
6. **Keep every function reachable**, or name in the report what was removed and why. Decluttering hides; it does not take away what the user relies on without saying so.

## The report

| Was | Now | Why |
|---|---|---|

## Gotchas

From real corrections:

- Two primary buttons side by side ("Already booked" and "Add to calendar") make the user stop and compare. Only one is styled primary; the other is quiet.
- Restyling every button smaller is not decluttering. The count in view is what tires the user.
- A toggle styled as "Notify me →" was clicked as a link and silently switched something off.
- Numbers about the whole feed in a card's sidebar ("Written to the calendar 0") are read as being about the card.
