# TICKET-STAT-02 — Unified stats configuration panel

- **Area:** Stats configuration
- **Type:** Feature
- **Traceability:** Concept [01 · Stat](../../excel%20export%20summary/concepts/01-stat.md) (fields, editing scenarios)

## User story

As a User, I want one Stats section where I define every axis — name, abbreviation, order, flags,
optional formula — so "add a Sanity stat" is one record in one place.

## Description

The real editor for STAT-01's unified model, replacing the split main-skills/stats panels that
STAT-01 only mechanically patched.

## Current situation (as-is)

- Post-STAT-01, the old `MainSkillsPanel` (in `/config/skills`) and `StatsConfigPanel`
  (`/config/stats`) are mechanically adapted but still present the split model in two places with
  none of the new fields surfaced properly.

## Desired result (to-be)

- **One Stats panel at `/config/stats`** (domain shape): per-stat editing of name, abbreviation,
  description, `countsTowardTotal`, `isResource`, `min`/`max`, `rounding`, and the optional
  derived formula via the `FormulaEditor`; drag-reorder writes `order`.
- `/config/skills` drops its main-skills section (Skills remain until SKL-02 reworks them); the
  dashboard card index reflects the merge.
- Panel-level validation surfacing: duplicate abbreviation warning (REF-01 downgraded it from
  identity), derived-stat-with-investment prevented by construction, `isResource` on a derived
  stat allowed only with a formula-derived max (the concept page's warning).

## Acceptance criteria

- [x] All unified fields editable end-to-end through `useStatManager` and store actions; reorder persists and drives display order. (`StatsConfigPanel.test.tsx` → "the unified fields, end to end" saves `min`/`max`/`rounding`/flags through the dialog and reads them back off the store, and clears a bound the User emptied rather than keeping the number. Reorder: `configStore.test.ts` → "reorderStats (TICKET-STAT-02)" — four tests, including "should change no value but the order" — plus `StatsConfigPanel.test.tsx` → "should move a stat down and persist the new order". The store writes the array *and* `order` from one sequence, so every `config.stats.map(…)` in the app displays in the User's order; `useStatManager` sorts on read as well, so an imported ruleset whose `order` disagrees with its array still lists right.)
- [x] Route/dashboard reflect the merge; no main-skills editing surface remains (route test per the configRoutes pattern). (`configRoutes.test.tsx` → "/config/skills renders the two skills panels and no main-skills surface" — asserts exactly two panels there. The dashboard's card index now leads with Stats, "Every numeric axis — invested, derived, or a resource", and Skills reads "Speciality and combat skills" (`useConfigDashboard.ts`); `ConfigDashboard.test.tsx` still green on the section list.)
- [x] The three validation surfacings above each have a component test. (`StatsConfigPanel.test.tsx` → "the three validation surfacings": the abbreviation refusal *(a refusal, not a warning — see implementation note 1)*, the invested/derived statement flipping as the formula field fills, and the resource-without-a-ceiling warning that does **not** block the save. `useStatManager.test.ts` covers the same three at the hook level, including the whitespace-is-not-a-formula edge.)
- [x] Components compose `ui/` primitives, own their layout, theme tokens only. (`StatCard`/`StatFormDialog`/`StatsConfigPanel` compose `Button`/`Card`/`Text`/`Checkbox`/`FormField`/`Select`/`Label`/`Dialog`; no raw control, no hex, no stock palette. `yarn run check` clean, and the conventions review confirmed the layering after its findings were applied.)
- [x] Verified via the `verifier` subagent, the `fallow` skill, and the `coding-conventions` skill. (verifier: 1168 passing / 0 failing / 0 skipped, tsc at the documented 2-error baseline, `yarn run check` clean. `fallow review`: no unused exports; the one clone group covering `StatsConfigPanel` is the header/empty-state boilerplate five config panels already share, pre-existing and out of scope. conventions-reviewer's eight findings all applied — drag state moved from the panel into `useStatManager.dragHandlers`, the dead `roundingOptions` return dropped, `updateStat` now *clears* on an explicit `undefined` instead of leaving a phantom key, the `warnings` prose corrected, `handleReorder` made a const arrow above its caller, the traceability line narrowed to requirements this file really asserts, `StatCard`'s header brought forward and given its own `StatCard.test.tsx`, and the no-op `setValue` option removed.)
- [ ] Verified live in the browser: add a stat, flag it, reorder, see the order everywhere. — **not run**: the User asked for no browser verification on this run. Left open rather than ticked.

## Notes

- The "add a stat → every dependent editor grows a column, defaulted" scenario is asserted where
  those editors exist (races in RACE-01, archetypes in ARC-01) — this ticket only has to keep the
  stat list authoritative.

## Implementation notes

1. **The duplicate abbreviation stays a *refusal*, not a warning** — a divergence from the to-be's
   wording, taken deliberately. REF-01 did downgrade the abbreviation from *identity* to display
   data, which is what the to-be's parenthetical is about; but [CLAUDE.md](../../../CLAUDE.md)'s
   hard rule still stands, because an abbreviation is a spelling in the **one flat formula space**
   shared with the speciality and combat skill codes. Two stats spelled `STR` do not make a
   ruleset with a warning in it — they make `STR + DEX` ambiguous. So the save is refused on the
   field, as it was before, and the surfacing this ticket adds is the inline message
   (`StatsConfigPanel.test.tsx` → "should refuse an abbreviation already taken in the flat formula
   space"). The *resource* rule is the one that is genuinely a warning, per Concept 01 line 100.
2. **Reordering ships twice**: a native HTML5 drag (no new dependency — the app stays
   browser-only) and per-card ↑/↓ buttons. Drag alone would be unreachable from a keyboard, and
   both paths end in `useStatManager.handleReorder` and so in the one store action, which is what
   keeps the array and the `order` field from disagreeing.
3. **`updateStat` now treats an explicit `undefined` as a clear.** Emptying `max` used to leave
   `max: undefined` sitting on the record — a key that is present, reads as absent, and vanishes
   on the next serialisation. `mergeClearingAbsent` in `configStore.ts` deletes it instead, which
   is the rule the data model already stated for `mainSkillPointBudget`.
4. **The formula field is still a bare `FormulaEditor`.** `FormulaPreview` does not exist yet —
   [TICKET-FORM-08](./TICKET-FORM-08-formula-preview-with-substitutable-variables.md) is sequenced
   directly after this ticket precisely so it lands in this dialog and retires `StatCard`'s
   one-off sample-value preview. Not a standing-rule violation; the rule's component arrives next.
5. **Sheet-import fragment: nothing to land.** `order`, `min`, `max` and `rounding` have all been
   on `Stat` since STAT-01 — this ticket surfaces them in the editor, it does not reshape anything
   persisted, so `docs/imports/stats.json` is unchanged and the corpus still imports.
