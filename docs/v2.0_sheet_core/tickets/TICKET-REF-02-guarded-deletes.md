# TICKET-REF-02 — Guarded deletes with reference lists

- **Area:** References & identity
- **Type:** Feature (fixes the unguarded-delete class, including the v1.0 item-delete TODO)
- **Traceability:** Concept [00 · Field model §6](../../excel%20export%20summary/concepts/00-field-model.md); spec [§3.2](../../excel%20export%20summary/ttrpg-app-spec.md)

## User story

As a User, I want deleting something that's in use to be refused with a list of what uses it —
and force-delete to leave visible errors, never silent zeros — so I can't quietly corrupt my
ruleset.

## Description

Store deletes filter unconditionally today; what guarding exists is advisory and UI-side. This
ticket moves the guard into the store actions, on top of TICKET-REF-01's reference machinery and
TICKET-FORM-05's error values.

## Current situation (as-is)

- `deleteMainSkill` / `deleteStat` / `deleteRace` / `deleteCurrencyTier` in
  [`configStore.ts`](../../../src/stores/configStore.ts) are unguarded `filter(...)` calls; item
  deletion carries a "character store integration will come later" TODO in
  [`useItemManager.ts`](../../../src/components/config/items/useItemManager.ts) and leaves
  dangling inventory ids.
- Advisory checks exist only for skills
  ([`useSkillDependencies`](../../../src/components/config/skills/shared/useSkillDependencies.ts))
  and materials/slots (manager hooks) — bypassable, and nothing covers races, currency tiers, or
  characters.

## Desired result (to-be)

- **Delete actions refuse while references exist** and return the reference list (kind, entity,
  field) — including references from characters (`raceIds`, inventories, `configurationId`).
- **Force-delete** proceeds and converts each reference into a FORM-05 error value with
  provenance — never a silent zero.
- The delete dialogs render the returned list (with jump-to links); the advisory hook checks
  collapse into calls of this one machinery.

## Implementation notes (2026-08-05)

Recorded while building, so the boxes below aren't read as more than they are.

1. **The guard is the store action's return value.** Every `deleteX` in
   [`configStore.ts`](../../../src/stores/configStore.ts) now returns `EntityReference[]` —
   non-empty means it refused and that list is what points at the entity; empty means it deleted.
   `{ force: true }` overrides. All ten share one `guardedDelete` helper, so a new entity kind is a
   new row rather than a new code path. The walker,
   [`engine/dependencies.ts`](../../../src/engine/dependencies.ts), is pure over
   `(target, config, characters)`; `guardedDelete` reads the character store to supply the third
   argument, which is what this ticket's own note sanctions.
2. **"Delete anyway" is a deliberate divergence from Requirement 2.6**, whose EARS text is
   unconditional ("*prevent deletion and display dependent components*"). The ticket's user story
   asks for force-delete explicitly, and the dialog spells out the consequence before it happens,
   so 2.6 is satisfied as the *default* and knowingly overridable. Don't read 2.6 as satisfied
   verbatim.
3. **Constants and curves cannot be tested** — CST-01 and CRV-01 have not landed, so there is no
   such entity to delete or to reference. `ReferenceTargetKind` gets those rows with them; the
   criterion below is split rather than ticked whole.
4. **Force-delete needed a calculator fix to keep its promise.** A character's allocation for a
   deleted skill was still seeding the formula namespace, so a forced delete read the orphaned
   number instead of erroring — a silent wrong answer, which is exactly what the user story rules
   out. `calculateTotalMainSkillLevels` now lets the **ruleset alone** decide what the namespace
   contains when `options.mainSkills` is given: an allocation, racial modifier, equipment bonus or
   focus stat naming an undefined code contributes nothing. The character data is left where it
   is, so re-adding the skill brings it back.
5. **Material *levels* are still deleted unguarded** (`useMaterialManager.handleDeleteLevel`), even
   though `Item.materialLevel` points at one. Outside the ten entity kinds this ticket names, and
   the fix belongs with the item template/instance split; flagged rather than folded in.

## Acceptance criteria

- [x] Guarded-delete tests per entity kind: stat in a formula, race on a character, item in an inventory, currency tier on a material value, ~~constant/curve in a formula~~. (`dependencies.test.ts` — one case per `ReferenceTargetKind`: "finds a main skill in formulas, modifiers and characters", "finds a speciality skill named by a combat skill formula", "finds a stat named by another formula through its display slug", "finds a stat a character has a current value for", "finds a race on a character", "finds an item in an inventory, equipped or loose", "finds a material on an item", "finds a material category on a material", "finds an equipment slot on an item and in an inventory", "finds a currency tier on a material level value, keyed by the material that holds it". Negative cases too: "does not count a code that merely appears inside a longer identifier" (references come from the parser, not `String.includes`) and "does not count the stat's own formula against it". At the store: `configStore.test.ts` "refuses a delete while something points at the entity, and says what" and "counts a character as a reference". **Constant/curve struck through** — see implementation note 3.)
- [x] Force-delete test: formulas naming the deleted entity evaluate to provenance-carrying errors; nothing throws; sheet shows FORM-06 chips. (`integration.test.ts` "turns a force-deleted skill into error values, never silent zeros (TICKET-REF-02)" — drives the real stores and storage: the delete is refused first, then forced, then `calculateCharacter` gives `isFormulaError(maxStatValues.health) === true` with `describeFormulaError` containing `Undefined variable: STR`, the combat skill reading STR fails the same way, nothing throws, and the speciality skill that named no deleted code still computes. The orphaned-allocation hole that made this read `50` instead of an error is fixed and pinned by `mainSkillCalculator.test.ts` "drops an orphaned allocation rather than letting it answer for a deleted skill" and "ignores a racial modifier for a skill the ruleset no longer defines". The chip half is the FORM-06 machinery unchanged — `CharacterSheet.test.tsx` "should show one chip carrying the provenance text, on the broken value only" already covers a stat formula naming a code the configuration does not define (`Undefined variable: NOPE`, chip labelled `Stat "Health"`), which is precisely the post-force state.)
- [x] An unreferenced entity deletes cleanly; no advisory-only code path remains (the hooks call the store/engine machinery). (`configStore.test.ts` "deletes an unreferenced entity cleanly and returns nothing" — returns `[]`, the entity is gone, `saveConfiguration` was called; and the refusal case asserts `saveConfiguration` was **not** called. The advisory paths are gone: `useSkillDependencies.ts` and its test are deleted, the `alert()` in `useItemManager.handleDeleteEquipmentSlot`, the `alert()`s in `useMaterialManager`, and the `confirm()` in `useEquipmentSlotManager` are all replaced — every one of the eleven delete handlers across the seven manager hooks now calls `attemptDelete`, which calls the store action.)
- [x] Dialogs render the action's returned list; no component re-derives references. (`config/shared/BlockedDeleteDialog.tsx` takes the `BlockedDelete` that `useGuardedDelete` captured and renders `references` directly — it imports nothing from the engine and computes nothing. `BlockedDeleteDialog.test.tsx` "renders every reference the action returned", "stays closed when nothing was refused", "closes on cancel without forcing", "forces the delete when the User insists"; `useGuardedDelete.test.ts` covers the retained refusal and that "Delete Anyway" re-runs **the same action** with `{ force: true }`. It is mounted by `BaseSkillPanel` (all three skill kinds) and by the stats, races, currency, materials, items and equipment-slot panels.)
- [x] Verified via the `verifier` subagent, the `fallow` skill, and the `coding-conventions` skill. (verifier: **880 passing, 0 failing, 0 skipped** (from 852), `npx tsc --noEmit` at the documented 4-error baseline, `yarn run check` clean over 229 files. Its first pass caught a real regression — `BlockedDeleteDialog.test.tsx` had been written with `@testing-library/user-event` and `toBeInTheDocument`, neither of which this repo has (the exact failure TEST_STATUS.md records from TICKET-DX-01); rewritten to the repo's `fireEvent` + plain-matcher idiom. fallow: 0 introduced complexity findings, 0 introduced dead code; three introduced clone groups, all in the manager-hook preambles that were already near-identical before this ticket — deduplicating them means a shared manager abstraction, which is its own refactor. conventions-reviewer: layering, store-owned persistence, formula-engine-only references, theme tokens, barrels and the base-vs-feature split all clean, plus eleven findings. Nine fixed here: racial modifiers could resurrect a force-deleted skill (**the serious one** — the equipment and focus loops were guarded and the racial loop was not); `holderId` for a currency-tier reference was the *target's* id, not the holder's, which also collided React keys; skill formula holders were keyed by `code` after REF-01 demoted it to display data; the un-hydrated-character-store assumption is now stated in `guardedDelete`'s JSDoc; `useGuardedDelete` had no test; the walker's parallel `formulaHolders`/`formulaTexts` arrays were index-coupled and are now one list of pairs; the unused `describeReferences` export is dropped; `config/shared/` gained its `index.ts`; and Requirements 2.5/2.6 were added to the store's `**Validates:**` line. The remaining two are recorded as implementation notes 2 and 5 rather than changes.)
- [ ] Verified live in the browser: attempt a guarded delete, see the reference list; force it, see the chips. (Ask the User first per CLAUDE.md.) — **open by the User's instruction to skip the browser check for this run.** The headless equivalent is `integration.test.ts` "turns a force-deleted skill into error values, never silent zeros", which drives the real stores and real LocalStorage, plus the dialog's own tests; no live check was performed.

## Notes

- The reference walker reads both stores but lives in the engine layer (pure function over
  config + characters); actions call it.
- `engine/validator.ts`'s after-the-fact dangling-reference reporting stays — it still catches
  what imports bring in.
