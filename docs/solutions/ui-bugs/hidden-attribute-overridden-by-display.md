---
title: HTML hidden attribute overridden by a CSS display rule
date: 2026-07-06
category: ui-bugs
module: shell/toolsMenu (toolbar dropdown)
problem_type: ui_bug
component: frontend_stimulus
symptoms:
  - "Tools dropdown rendered permanently open, even with no document loaded"
  - "Setting element.hidden = true had no visual effect"
root_cause: wrong_api
resolution_type: code_fix
severity: medium
tags: [css, hidden-attribute, dropdown, display, specificity, cascade]
---

# HTML hidden attribute overridden by a CSS display rule

## Problem
The "Tools ▾" dropdown menu in the toolbar was always visible — it appeared open on page load (with no PDF open, and even while its trigger button was disabled) and toggling it had no effect. The menu is shown/hidden via the HTML `hidden` attribute, but an author CSS `display` rule silently defeated it.

## Symptoms
- The Tools dropdown showed all its items on load and could not be closed.
- In JS, `menu.hidden = true` ran without error but the menu stayed visible (`getComputedStyle(menu).display` was `flex`, not `none`).

## What Didn't Work
- **Relying on the `hidden` attribute alone.** The toggle logic (`menu.hidden = true/false`) was correct — the attribute was being set — but had no visual effect, so the bug looked like a JS/state problem when it was purely CSS.

## Solution
The dropdown's stylesheet set an explicit `display`:

```css
.tools-dropdown {
  position: absolute;
  display: flex;          /* ← overrides the `hidden` attribute's display:none */
  flex-direction: column;
  ...
}
```

Fixed with a single global guard so the `hidden` attribute always wins, regardless of any element's author `display` (`src/style.css`):

```css
/* The `hidden` attribute must always win over author `display` rules. */
[hidden] {
  display: none !important;
}
```

## Why This Works
The `hidden` attribute hides an element only because the UA (browser default) stylesheet contains `[hidden] { display: none }`. That rule has very low specificity, so **any** author rule that sets `display` on the same element (here `.tools-dropdown { display: flex }`) overrides it and the element stays visible.

Adding an author-level `[hidden] { display: none !important }` restores the intended behaviour: `!important` beats normal author declarations, so an element with the `hidden` attribute is hidden no matter what other `display` value its class sets. It fixes this class of bug for every element in the app that uses `hidden` (e.g. the "Install" button, the OCR output textarea), not just this one dropdown.

## Prevention
- **Add `[hidden] { display: none !important; }` to the CSS reset** in any project. It's a one-line, app-wide guard against this exact trap and is a common defensive rule.
- When an element you hide via the `hidden` attribute also needs an author `display` (flex/grid/block), remember the two conflict — either use the global guard above, or toggle a class (e.g. `.is-open`) instead of the `hidden` attribute.
- Debugging tip: if `element.hidden = true` "does nothing," check `getComputedStyle(el).display` — a non-`none` value means an author `display` rule is winning over the attribute.

## Related Issues
- First documented solution for this repo; no related docs yet.
