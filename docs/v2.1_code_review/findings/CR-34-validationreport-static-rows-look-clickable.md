# CR-34 — `ValidationReport` rows render as clickable even when there is no click handler

**Severity:** Low · **Area:** ui (ValidationReport) · **Type:** style/behavior mismatch

## Summary

`cursor-pointer` and hover styles are baked into every issue row's style, so rows advertise
clickability even when `onIssueClick` is absent — undercutting the component's own careful
`interactionProps` logic that removes `role`/`tabIndex` for static rows.

## Evidence

- `src/components/ui/ValidationReport/ValidationReport.style.ts` — `issueItemStyles` includes
  `cursor-pointer` + hover styling unconditionally.
- `src/components/ui/ValidationReport/ValidationReport.tsx:58-66` — `interactionProps`
  conditionally strips the semantics but not the visuals.

## Impact

Users click inert rows and nothing happens; the accessibility layer and the visual layer disagree
about what the row is.

## Suggested direction

Split the interactive styling out of `issueItemStyles` and apply it only when `onIssueClick` is
provided — same condition `interactionProps` already uses.
