# CR-23 — Two generations of form dialogs coexist; error nodes spelled three ways; footer copied 13×

**Severity:** Medium · **Area:** config components · **Type:** inconsistent pattern / duplication

## Summary

Newer form dialogs use the `FormField` primitive; six older ones hand-roll `Label` + `Input` + an
error node — and the error node itself is spelled three different ways across them. The
Cancel/submit footer is copied verbatim in all 13 dialogs.

## Evidence

- **FormField generation** (good): races, archetypes, stats, skills, ladders, rolls,
  material-level.
- **Hand-rolled generation**: `ConstantFormDialog`, `CurveFormDialog`, `CurveColumnDialog`,
  `CurrencyFormDialog`, `ItemFormDialog`, `EquipmentSlotFormDialog`.
- Error-node spellings:
  - `Text variant="error"` (constants, curves);
  - raw `<p className="text-crimson text-sm">` (`CurrencyFormDialog.tsx:63,82`);
  - raw `<span className="text-xs text-crimson mt-1">` (`EquipmentSlotFormDialog.tsx:78,98`,
    `ItemFormDialog.tsx:94` — where `mt-1` is inert on an inline span).
- Footer: the same Cancel/Save button row appears verbatim in 13 dialogs, differing only in label
  strings.
- Static duplication analysis independently flagged the dialog skeleton as one of the largest
  clone families in the repo.

## Impact

Error presentation drifts visually between features; every dialog-level improvement (e.g. the
[CR-13](CR-13-dialog-lacks-focus-management.md) focus work, a busy-state on save) has 13 places
to land instead of one.

## Suggested direction

Two mechanical sweeps:
1. Migrate the six older dialogs to `FormField` (the newer dialogs prove the primitive covers the
   cases).
2. Add a small `FormDialogActions` (or an `EntityFormDialog` wrapping `Dialog` +
   `<form onSubmit>` + footer) in `config/shared/`, and adopt it everywhere.

## Related

- [CR-24](CR-24-manager-hook-dialog-lifecycle-duplication.md) — the hook-side half of the same
  scaffolding.
