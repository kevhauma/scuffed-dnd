# CR-29 — Eight features declare their form-data interface twice (hook and dialog)

**Severity:** Low · **Area:** config components · **Type:** duplicate code / drift risk

## Summary

Most features re-declare the react-hook-form shape in both the manager hook and the dialog, while
stats, skills, and curves already do it right — export the type from the manager and import it in
the dialog. Structural typing hides drift between the two copies until it breaks at the panel
call site.

## Evidence

Declared twice: `RaceFormData`, `ConstantFormData`, `CurrencyFormData`, `ItemFormData`,
`EquipmentSlotFormData` (×3 declarations), `CategoryFormData`, `MaterialFormData`,
`LevelFormData`, `RollFormData`, `LadderFormData`, `ArchetypeFormData`.

Exemplars already correct: `useStatManager` / `useSkillManager` / `useCurveManager` export the
type; their dialogs import it.

## Impact

Adding a field to one copy but not the other type-checks fine in isolation and fails (or worse,
silently drops the field) where hook meets dialog.

## Suggested direction

Adopt the `useStatManager` pattern everywhere: single exported `XFormData` in the hook, imported
by the dialog. Mechanical change, no behavior difference.
