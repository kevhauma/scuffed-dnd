# CR-07 — The selected archetype card renders near-black text on a dark background

**Severity:** High · **Area:** play (character creation) · **Type:** UI bug / accessibility

## Summary

Picking an archetype in the creation wizard turns its card into the pressed `primary` Button
(`bg-royal text-parchment-50`), but the nested `Text` components carry their own ink color
classes, which beat the parent's inherited color — so the card becomes illegible exactly when
selected.

## Evidence

- `src/components/play/creation/ArchetypeStep.tsx:85-99` — selected card renders `Button`
  `primary` with nested `Text` children.
- `Button` `primary` sets `bg-royal text-parchment-50`; `royal` is `#2e4057`
  (`src/styles.css:24`).
- `Text` variants set their own colors: `body-small` → `text-ink-900` (`#2a2419`),
  `body-small-secondary`/`caption` → `text-ink-700`. An element's own `color` class always beats
  inherited color.
- The comment above the JSX claims "the picked archetype reads as the pressed control it is" —
  the nested variants defeat it.

## Impact

Near-black on dark blue at the exact moment the user confirms their choice. Fails contrast
outright; on some displays the card content is effectively invisible.

## Suggested direction

Either add inverse variants to `Text` (e.g. `body-small-inverse`) and use them in the selected
state, or stop nesting color-opinionated `Text` inside the pressed Button and style the card's
selected state locally with `text-parchment-50` descendants. Verify in the browser with a
selected archetype.
