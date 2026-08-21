# CR-24 — ~13 manager hooks repeat the same dialog-lifecycle scaffolding; extract `useEntityDialog`, not `useEntityManager`

**Severity:** Medium · **Area:** config components (manager hooks) · **Type:** duplication, with a scoped consolidation

## Summary

Every `use*Manager` hook repeats the same ~40-line skeleton: config selector + action triple,
`useGuardedDelete`, `isDialogOpen`/`editingXId` state, `handleAdd`/`handleEdit` doing
`form.reset(...)` + open, `handleSave` doing add-vs-update + close. The review's key judgment:
a full generic `useEntityManager<T>` is the **wrong** consolidation — the save paths differ
meaningfully and it would become parameter soup. The genuinely identical core is the **dialog
lifecycle**, which is safely extractable.

## Evidence

- Clone family confirmed by static analysis across: archetypes, constants, currency, curves,
  equipment slots, items, materials, races, ladders, rolls, skills, stats (e.g.
  `useArchetypeManager.ts:25-36`, `useConstantManager.ts:46-57`, `useRaceManager.ts:23-33`,
  `useStatManager.ts:94-107`, `useRollManager.ts:40-50`, `useDiceLadderManager.ts:56-66`, …).
- Why not a full generic manager — the save paths genuinely differ: identifier/uniqueness rules
  (constants, curves), `validateFormulaChange` (stats, rolls), sparse-pruning (races,
  archetypes), index-based levels (materials).
- The delete flow proves the right pattern already: `useGuardedDelete` is one implementation with
  13 one-line callers — 100% adoption.

## Impact

~15 lines × 11 simple managers of identical code; every lifecycle refinement (e.g. dirty-check on
close) needs 13 edits.

## Suggested direction

Extract `useEntityDialog<TForm>(form)` returning
`{ isOpen, editingId, openForAdd(defaults), openForEdit(id, values), close }` into
`config/shared/`, and adopt it in the simple managers. Leave every save path exactly where it is.
Model the shape and rollout on `useGuardedDelete`.

## Related

- [CR-23](CR-23-two-generations-of-form-dialogs.md) — the component-side half.
- [CR-29](CR-29-formdata-interfaces-declared-twice.md) — the form-type half.
