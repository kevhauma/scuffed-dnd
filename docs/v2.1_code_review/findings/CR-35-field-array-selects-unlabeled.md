# CR-35 — Field-array selects: `watch`+`setValue` instead of `register`, and no label association

**Severity:** Low · **Area:** config components (skills, materials) · **Type:** accessibility + rhf misuse

## Summary

Two dialogs drive their field-array `Select`s through `watch` + `setValue` (bypassing
react-hook-form's dirty tracking) even though a sibling dialog proves plain `register` works on
the `Select` primitive. The same selects — and the adjacent weight inputs — have no `id`/label
association or `aria-label`, so a row's stat picker is unnamed to a screen reader.

## Evidence

- `src/components/config/skills/SkillFormDialog.tsx:106-114` — watch/setValue-driven select,
  unlabeled.
- `src/components/config/materials/MaterialLevelFormDialog.tsx:133-141` — same pattern.
- Proof `register` suffices: `src/components/config/archetypes/ArchetypeFormDialog.tsx:89-96`.

## Impact

Dirty-state features (unsaved-changes warnings, submit-if-dirty) won't see these fields; screen
readers announce anonymous comboboxes in a repeating row where field identity matters most.

## Suggested direction

Switch both to `register` (per the archetype exemplar) and give each row control an `aria-label`
composed from the row context (e.g. "Stat for weight row 2"). Note
[CR-32](CR-32-ui-primitive-prop-api-gaps.md): `Text` can't carry ids for `htmlFor`-style
association, so `aria-label` is the practical route today.
