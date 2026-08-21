# CR-43 — Minor consistency sweep (grouped small findings)

**Severity:** Low · **Area:** various · **Type:** small inconsistencies, each a few-line fix

Grouped because each is individually trivial; they'd make one small cleanup ticket together.

## Items

1. **`ConfigTransferPanel` holds form state in the panel** —
   `src/components/config/dashboard/ConfigTransferPanel.tsx:41` keeps `draftName` in `useState`
   inside the panel; the convention ("panels don't hold logic") puts form state in the hook. Same
   shape `FocusStatConfig` was previously cleaned up for.

2. **`CurveColumnDialog` doesn't clear a prior save refusal on edit** —
   `src/components/config/curves/CurveColumnDialog.tsx:94`: the generator field keeps showing a
   stale refusal, unlike `StatFormDialog.tsx:129` and `RollDefinitionFormDialog.tsx:137`, which
   call `clearErrors` in `onChange`.

3. **`ItemsConfigPanel` inline empty state** —
   `src/components/config/items/ItemsConfigPanel.tsx:152-157` uses a bare centered `Text` where
   `ConfigEmptyState` exists (partially justified by its filter-dependent message; parameterize
   the message instead).

4. **Parser doc drift in `term()`** — `src/engine/formula/parser.ts:443` says
   `factor ((MULTIPLY | DIVIDE) factor)*` but the body (correctly, per the module-header grammar)
   parses `power`.

5. **Multi-tab behavior is undocumented** — no `storage` event listener exists anywhere; two tabs
   each hydrate once and then last-write-wins on every action, so a second tab can silently
   clobber the first's edits. Acceptable for a single-user browser app, but worth one line in
   `data-model`'s skill doc so it's a decision, not an accident.

## Suggested direction

One small cleanup pass; none of these need design discussion.
