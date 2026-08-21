# CR-13 — `Dialog` has no focus management despite `aria-modal`

**Severity:** Medium · **Area:** ui (base components) · **Type:** accessibility
**Scope:** inherited by every config form dialog and play-mode dialog

## Summary

The `Dialog` primitive never moves focus into the dialog on open, never returns it on close, and
has no focus trap — so keyboard focus and Tab order remain on the page *behind* an
`aria-modal="true"` overlay. `aria-modal` alone does not enforce containment.

## Evidence

- `src/components/ui/Dialog/Dialog.tsx` — no `ref.focus()` on open, no `focusout`/Tab handling,
  no restore-on-close. Escape, backdrop click, and the close button are otherwise handled well.
- Every `*FormDialog` in `src/components/config/**` and the play dialogs inherit the gap.
- The config tests already work around a sibling ui/-level labeling gap
  (`RollsConfigPanel.test.tsx:97`, `StatsConfigPanel.test.tsx:257` — `FormulaEditor`'s
  unassociated label), which suggests these primitive-level gaps are known friction.

## Impact

Keyboard and screen-reader users can Tab into the obscured page, interact with hidden controls,
and lose their place entirely when the dialog closes. Fails basic modal expectations
(WAI-ARIA dialog pattern).

## Suggested direction

In the `Dialog` primitive: on open, save `document.activeElement` and focus the dialog panel (or
first focusable); trap Tab/Shift+Tab within the panel; on close, restore the saved element. This
is one fix in one file that upgrades ~15 dialogs at once. Consider `FormulaEditor`'s label
association in the same accessibility pass.

## Related

- [CR-35](CR-35-field-array-selects-unlabeled.md) — unlabeled controls inside those dialogs.
