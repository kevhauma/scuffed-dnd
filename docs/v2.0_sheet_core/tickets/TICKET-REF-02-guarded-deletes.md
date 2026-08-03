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

## Acceptance criteria

- [ ] Guarded-delete tests per entity kind: stat in a formula, race on a character, item in an inventory, currency tier on a material value, constant/curve in a formula.
- [ ] Force-delete test: formulas naming the deleted entity evaluate to provenance-carrying errors; nothing throws; sheet shows FORM-06 chips.
- [ ] An unreferenced entity deletes cleanly; no advisory-only code path remains (the hooks call the store/engine machinery).
- [ ] Dialogs render the action's returned list; no component re-derives references.
- [ ] Verified via the `verifier` subagent, the `fallow` skill, and the `coding-conventions` skill.
- [ ] Verified live in the browser: attempt a guarded delete, see the reference list; force it, see the chips. (Ask the User first per CLAUDE.md.)

## Notes

- The reference walker reads both stores but lives in the engine layer (pure function over
  config + characters); actions call it.
- `engine/validator.ts`'s after-the-fact dangling-reference reporting stays — it still catches
  what imports bring in.
