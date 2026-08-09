# TICKET-STAT-03 — Wizard and sheet on unified stats

- **Area:** Stats configuration (play surfaces)
- **Type:** Feature
- **Traceability:** Concept [01 · Stat](../../excel%20export%20summary/concepts/01-stat.md) (where a value comes from; resource gating)

## User story

As a Player, I want to allocate points into stats when creating a character and see them on my
sheet with their breakdown — and only resource stats offering current-value controls — so play
mode speaks the unified model.

## Description

The play-mode half of the STAT-01 rework: the creation wizard's allocation step and the sheet's
stat sections, replacing STAT-01's mechanical patches with the intended UX.

## Current situation (as-is)

- Post-STAT-01, [`SkillAllocationStep`](../../../src/components/play/creation/) and the sheet's
  `MainSkillsSection`/`StatsSection` compile against the new model but still present the old
  main-skills-vs-stats split, and [`StatEditor`](../../../src/components/play/sheet/StatEditor.tsx)
  renders for every stat rather than only resources.

## Desired result (to-be)

- The wizard's allocation step allocates `investedStatPoints` across invested stats
  (validator-driven, per the established `useCharacterCreation` pattern); derived stats preview
  read-only.
- The sheet gets one stats grid in `order`: value + labelled breakdown (base / invested /
  equipment via `SkillBreakdownRow`); `StatEditor`'s current-value controls render **only** for
  `isResource` stats; derived stats show their computed value with FORM-06 chips on error.
- The temporary abbreviation bridge for legacy speciality/combat formulas keeps those sections
  working, with a test that marks it as scaffolding to be removed by SKL-02/ROLL-06.

## Implementation notes

1. **A resource's maximum is stated once, not chipped twice.** Every stat now gets a
   `SkillBreakdownRow`, and a resource gets the `StatEditor` *as well* — so a broken formula behind
   a resource produced two identical FORM-06 chips, one per row. The breakdown row keeps the chip
   (it carries the full provenance chain); `StatEditor` now reads `maximum unavailable` in plain
   text instead. `CharacterSheet.test.tsx`'s "one chip on the broken value only" assertion is what
   caught it and is what holds the line.
2. **`DerivedValue` moved out of `useCharacterSheet`** into
   [`components/play/derivedValue.ts`](../../../src/components/play/derivedValue.ts), because the
   wizard's derived-stat preview needs the same `FormulaResult` → renderable interpretation. Two
   copies of that reading would have been a second hand-rolled interpretation of the engine's
   errors, which is the thing FORM-05 exists to prevent.
3. **Nothing persisted changed**, so there is no `docs/imports/` fragment to land: the ticket adds
   a view field (`StatBreakdown.isDerived`) and rendering, not a shape.

## Acceptance criteria

- [x] Wizard flow creates a valid v2 character end-to-end; allocation consumes the engine validator, sums nothing itself. (`CharacterCreationWizard.test.tsx` "should create the character once and navigate to its sheet" now also asserts the v2 shape — points keyed by stat *id*, `currentResourceValues` seeded to the calculated max, no `mainSkillLevels`. The budget line and every step block come from `validateStatAllocation`; the derived preview from `calculateCharacter` — `useCharacterCreation.ts` adds no arithmetic.)
- [x] Sheet grid renders by order with breakdowns from the calculator; no component re-derives arithmetic. ([`StatsSection.tsx`](../../../src/components/play/sheet/StatsSection.tsx) maps one `SkillBreakdownRow` per stat; `useCharacterSheet.ts` sorts by `order` and reads every number off `calculateCharacter`. Test: "should list every stat in the order the ruleset arranges them" reverses `order` and asserts the rendered sequence follows.)
- [x] Resource gating: exactly the `isResource` stats have editable current values (component test both ways). (`CharacterSheet.test.tsx` → "resource gating": Health/Mana have an input and both ± controls; Strength/Dexterity have none; and "should stop offering current-value controls when a stat stops being a resource" flips `isResource` off and shows the stat still renders its value.)
- [x] The bridge test exists and names the tickets that retire it. (`calculator.test.ts` → "the flat abbreviation bridge (retired by TICKET-SKL-02 and TICKET-ROLL-06)" — three cases, with a block comment saying which ticket deletes which half and that the fix is never to re-add the flat spelling.)
- [x] Components compose `ui/` primitives, theme tokens only. (`StatsSection`/`SkillAllocationStep` compose `Card`/`Text`/`Input`/`Label`/`ErrorChip`; the only colours are `border-stone-200` and the `Text` variants. `yarn run check` clean.)
- [x] Verified via the `verifier` subagent, the `fallow` skill, and the `coding-conventions` skill. (`verifier`: 1203 passing / 0 failing / 0 skipped, +12 from this ticket; `npx tsc --noEmit` at the documented 2-error baseline; `yarn run check` clean after formatting the one array literal it flagged.)
- [x] Verified live in the browser: create a character, check the grid, confirm only resources are editable. (Ducklets ruleset on `localhost:3000`. Allocation step: nine invested stats plus a "Derived Stats" card where APT read 1, then 2 after Speed was allocated 40 — the preview tracks the points. Sheet for the created character lists STR·DEX·CON·INT·WIS·CHA·HP·MANA·SPEED·APT in `order`, each with `invested`/`racial` beside its total; only Health and Mana carry an input and ± controls — `Decrease Mana` took 200 → 199 and LocalStorage came back `{"stat-health":7,"stat-mana":199}`. No console errors.)

## Notes

- Wizard step order changes again in ARC-03 (archetype step) — keep step composition in
  `useCharacterCreation` so that's cheap.
- `.claude/launch.json` pointed at `npx vite dev` on port 5173; the project's dev server is
  `yarn dev` on 3000. Corrected in passing so the browser criterion could be met.
