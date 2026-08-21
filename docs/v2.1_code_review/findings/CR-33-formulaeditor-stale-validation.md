# CR-33 — `FormulaEditor` only validates on user input, never on arriving props

**Severity:** Low · **Area:** ui (FormulaEditor) · **Type:** stale-state bug

## Summary

Validation runs only inside `handleInputChange`, so a formula that arrives invalid via the
`value` prop shows no error until the user types — and a change to `availableVariables` (e.g. a
stat renamed elsewhere) never revalidates the currently displayed value.

## Evidence

- `src/components/ui/FormulaEditor/FormulaEditor.tsx:39-64` — validation confined to the change
  handler; no effect on `value`/`availableVariables` changes.

## Impact

Opening an edit dialog on a formula that has since become invalid shows it as clean; the error
only appears after an unrelated keystroke. Mild, but it undercuts trust in the inline validation.

## Suggested direction

Derive the validation result from `(value, availableVariables)` — a `useMemo` over props rather
than state written in the change handler. That removes the staleness class entirely instead of
patching individual triggers.
