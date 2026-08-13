# TICKET-MAT-01 — Material modifiers target stats

- **Area:** Materials configuration
- **Type:** Refactor (breaking change to the modifier shape)
- **Traceability:** Concept [09 · Material family](../../excel%20export%20summary/concepts/09-material-family.md) (tier `mods` are per-stat)

## User story

As a User, I want a material tier to grant stat modifiers — "+50 Mana", "+1 Str" — so equipment
affects what the sheet says it affects.

## Description

Sheet material mods are keyed by stat (fur tier 1: Mana 50, Health 1); the app keys every
modifier by skill code and cannot touch a stat. This ticket changes the modifier shape and the
materials editor; the equipment aggregation rework is TICKET-MAT-02.

## Current situation (as-is)

- [`SkillModifier`](../../../src/types/config.ts) `{ skillCode, modifier }` on
  `MaterialLevel.bonuses`;
  [`useMaterialManager`](../../../src/components/config/materials/useMaterialManager.ts) offers
  main + speciality + combat codes as targets.
- Post-STAT-01, main-skill codes resolve as stat abbreviations only via the temporary bridge — a
  naming coincidence, in the wrong shape.

## Desired result (to-be)

- `StatModifier` `{ statId, modifier }` replaces `SkillModifier` on `MaterialLevel.bonuses`.
- The material-level dialog picks **stats** — resource stats included ("+50 max Mana" becomes
  expressible); a modifier on a *derived* stat is a named validation error (its formula is its
  source).
- `engine/validator.ts` checks modifier stat ids; REF-02 guards stat deletion against modifiers;
  export/import shape validation updated.

## Acceptance criteria

- [x] `MaterialLevel.bonuses` is `StatModifier[]` in type, store actions, and shape validation; export → import round-trips. ([`types/config.ts`](../../../src/types/config.ts) defines `StatModifier { statId, modifier }` and `MaterialLevel.bonuses` takes it; `useMaterialManager`'s `handleSaveLevel` writes it through `updateMaterial` as before. Shape validation is the new block in [`importExport.ts`](../../../src/services/importExport.ts), mirroring the race one. Pinned by `importExport.test.ts` → `material stat modifier round-trip (TICKET-MAT-01)`: survives export→import unchanged, stays spelled in ids on the wire, and a `{ skillCode }` bonus or a non-numeric modifier is a `ValidationError`.)
- [x] The dialog offers invested and resource stats, ~~rejects derived stats with a message~~ **omits derived stats, saying why when that leaves nothing to modify** (component test). (See implementation note 2 for the divergence. `MaterialsConfigPanel.test.tsx` — six cases: a bonus renders as `MANA: +50` rather than as its id, the picker offers `Strength (STR)` and the resource `Mana (MANA)`, it does *not* offer the derived `APT (APT)` or the speciality code `STL`, an edit persists as `{ statId: 'str-id' }` through the store, and a ruleset whose every stat is derived gets the explanatory line with `Add Bonus` disabled.)
- [x] Dangling `statId` reported by the validator; guarded delete covers modifier references. (`validator.test.ts` → `should detect a dangling stat reference in material bonuses (TICKET-MAT-01)` and `should refuse a material bonus that targets a derived stat (TICKET-MAT-01)`. Guard: `dependencies.test.ts` → `finds a material tier modifier by stat id, so a rename cannot defeat the guard` — the reference survives an abbreviation rename, which the old `skillCode` match could not — plus `no longer finds a material bonus when a speciality skill is deleted`.)
- [x] Persistence via store actions; components compose `ui/` primitives, theme tokens only. (No component gained a storage call — the level dialog still saves through `updateMaterial`. The dialog's raw `<input type="number">` and its hand-written `bg-white border-stone-300` classes are **gone**, replaced by the `Input` primitive; the shared `StatModifierBadges` keeps its class strings in a sibling `.style.ts` and uses `forest`/`crimson` only.)
- [x] Verified via the `verifier` subagent, the `fallow` skill, and the `coding-conventions` skill. (`npx vitest run` 1271 passing / 0 failing / 0 skipped; `npx tsc --noEmit` at the documented 2-error baseline; `yarn run check` clean. `fallow audit --base HEAD`: 0 introduced dead code, 0 introduced complexity findings; the single "introduced" clone group is the materials hook's return object against the panel's destructuring of it, attributed here only because one field was renamed in both. `conventions-reviewer` on the diff: layering, store-owned persistence, engine-owned math and theme tokens clean; its findings are folded in — notes 2, 3 and 5.)

## Implementation notes

1. **Materials can no longer buff a speciality or combat skill.** The shape change is what does it:
   a tier modifier names a stat id, so there is no way left to write "+2 Stealth boots". That is
   Concept 09's model — the sheet's tier mods are its nine stat columns — and a skill still moves
   with equipment, through the stats its formula reads. `calculator.test.ts` pins the new route:
   the cloak raises DEX and Stealth follows, one route instead of two. **The equipment aggregate
   itself is unchanged**: `calculateEquipmentBonuses` translates each `statId` to its stat's
   abbreviation on the way out, so everything downstream reads exactly what it read before, and
   TICKET-MAT-02 is what removes that bridge by carrying `StatModifier[]` to the composition.
2. **A derived stat is omitted from the picker, not offered and refused.** The to-be asked for a
   rejection message; refusing a choice the User can see is worse than not offering it, and the
   dialog says why in the case where it leaves nothing at all to modify. The *rejection* still
   exists where it has to: `engine/validator.ts` reports a modifier on a derived stat, because one
   can arrive by import even though the editor will not write one.
3. **The cards get every stat, the picker gets the modifiable ones.** `useMaterialManager` exposes
   both. A modifier that reached a derived stat by import must still read as `APT: +2` rather than
   as a raw uuid, so the display resolution needs the whole set — only the *offer* is filtered.
4. **`SUPPORTED_SCHEMA_VERSION` 3 → 4**, by the milestone's bump-on-every-reshape rule. A v3 file's
   tier bonuses name a skill code, and reading one as a `statId` would import a modifier that
   targets nothing at all — so the version gate stops it before the shape check does
   (`importExport.test.ts` → `refuses the shape before per-stat material modifiers`).
   `docs/imports/materials.json` is carried forward to stat ids and `yarn run sheet:import` rerun;
   every one of the sheet's nine modifier columns targets an invested or resource stat, so nothing
   was dropped.
5. **`references.ts` has no modifier branch left at all.** Both persisted modifier shapes are stat
   ids now, so `translateConfiguration` carries formula strings and nothing else, and the
   `codeToStored`/`codeToDisplay` pair retired with the last caller.
6. **Open, for MAT-02 or a follow-up**: nothing guards the in-app path where a stat that material
   tiers modify is *given* a formula. The modifier silently stops applying until the User opens the
   dashboard's validation report, which does surface the new "is a derived stat" error. REF-02's
   guard covers deletes only, so this is a decision to make rather than an oversight.

## Notes

- Race modifiers already moved (RACE-01); after this ticket plus ROLL-06, no skill-code-keyed
  modifier shape remains anywhere — ROLL-06 carries that grep criterion.
- Material family *generators* (`base_*`, tier formulas, `usable_for`) are the later materials
  milestone, on CRV-02's machinery.
