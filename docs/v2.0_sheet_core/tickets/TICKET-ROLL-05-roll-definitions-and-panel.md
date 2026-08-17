# TICKET-ROLL-05 — Roll definitions and the rolls panel

- **Area:** Dice & rolls
- **Type:** Feature
- **Traceability:** Concept [08 · Roll definition](../../excel%20export%20summary/concepts/08-roll-definition.md)

## User story

As a User, I want named rolls — melee, ranged, evasion, endure — each an input expression plus a
ladder, so what a character rolls is configuration, not six hand-typed dice counts per skill.

## Description

The entity and its config editor. The sheet flow that replaces combat skills is TICKET-ROLL-06.

## Current situation (as-is)

- [`CombatSkill`](../../../src/types/config.ts) `{ code, name, description, dice, bonusFormula }`
  is the roll-shaped concept: a hand-typed pool plus a formula bolted on as a flat bonus, edited
  in the combat section of `/config/skills`.
- ROLL-03/04 landed ladders and rolling with no consumer.

## Desired result (to-be)

- `RollDefinition` entity `{ id, name, description, input: formula, ladderId, category?:
  'offence' | 'defence' | 'utility', order }`. `input` evaluates in the character context —
  `stats.*`, `skills.*` (level/bonus), `const.*` (a FORM-04 scoping-table row) — so "evasion
  reads Dex and armour" is a formula edit.
- A Rolls panel (domain shape + dashboard card) editing definitions **and** ladders (ROLL-03's
  entity gets its editor here); guarded deletes via REF-02 both ways (a ladder used by a
  definition; a definition — once ROLL-06 rolls it into history — safe to delete, history is
  session-only).
- Fresh-config seeds: the `[20, 12, 6]` ladder and the four rolls with placeholder inputs
  (`stats.str` melee, `stats.dex` ranged/evasion, `stats.con` endure), descriptions naming them
  placeholders — the true evasion/endure expressions are spec open question #1.

## Implementation notes

1. **The seeded inputs are `0`, not `stats.str`.** The to-be asked for the four rolls with
   placeholder inputs naming stats — and that is not seedable, because a fresh ruleset has **no
   stats**. Those four expressions would name members that do not exist, so a brand-new
   configuration would open reporting four validation errors before the User had done anything.
   `0` always computes, so the seed states the ruleset's *shape* — four named rolls down one
   ladder — and each description says what the sheet reads there and that it rolls 0 until the User
   writes it. The real expressions ship in the **sheet corpus**
   ([`roll-definitions.json`](../../imports/roll-definitions.json)), where the stats they name exist.
2. **Two panels on one route**, `RollsConfigPanel` and `DiceLaddersConfigPanel`, composed in
   [`routes/config/rolls.tsx`](../../../src/routes/config/rolls.tsx) — the shape `/config/items` and
   `/config/skills` already use. **The first cut was one panel with two managers**, and the
   `conventions-reviewer` was right to refuse it: the second entity had to hand-write the header
   `ConfigPanelShell` owns, at `h5/h3` where the shell emits `h4/h2`. That is precisely the
   `BaseSkillPanel` drift TICKET-DX-05 existed to remove, reintroduced one ticket later. The review
   also caught that the docstring, this note and the project-map entry all cited `/config/skills` as
   precedent for the single-panel shape — which it is not; it mounts two panels at the route.
   Splitting also dissolved a shared-`blocked` workaround (`rolls.blocked ?? ladders.blocked`), which
   worked only because a modal happens to serialise the clicks.
3. **`deleteDiceLadder` is now guarded**, closing what TICKET-ROLL-03 deliberately left open. A roll
   names its ladder by **id**, so no rename defeats the guard, and there is no formula to scan — a
   ladder is not spelled in the formula space at all. `roll-definition` is a `ReferenceTargetKind`
   too, and its case **returns nothing on purpose**: no formula can name a roll (there is no `rolls`
   namespace, because a roll produces dice rather than a number) and roll history is session state.
   The case exists to say a roll is a leaf rather than to leave it forgotten.
4. **A roll input is a leaf in the dependency graph**, like a curve generator: nothing can reference
   a roll, so a roll cannot be part of a cycle. `validateFormulaChange` still runs the cycle pass
   over it, which costs nothing and keeps the guard uniform across attachment points.
5. **The corpus carries `roll-definitions.json` *alongside* `combat-skills.json`**, mirroring the
   code: this ticket adds `RollDefinition` beside `CombatSkill` and ROLL-06 removes the older one.
   Ids are prefixed `rolldef-` so the two sets do not collide in the merge, and the README now marks
   the combat-skills fragment superseded. Melee and ranged inputs are the sheet's confirmed raw
   stats; evasion and endure ship the raw stat and are honestly **7 and 4 short**, because the
   sheet's extra term is Concept 08's open question and inventing a constant would be worse.
6. **`fallow audit` flagged two things, both accepted rather than suppressed.** `findReferences` in
   `dependencies.ts` crossed the complexity threshold (22 → 24 cyclomatic) because this ticket adds
   two `case`s — but the switch **is** the registry of guarded-delete kinds, and one arm per kind is
   what makes the exhaustiveness visible; splitting it would hide exactly what the file exists to
   show. `rollDefinitionShapeErrors` (11 cyclomatic) is a flat list of independent
   `if (bad) push(message)` checks, the same family as `curveShapeErrors` (18) and
   `diceLadderShapeErrors` (12), and it was extracted from `validateConfiguration` for the same
   reason those were. It also found `parseDieSizes` exported with no consumers, which was a genuine
   slip — it is module-private now.
7. **The `conventions-reviewer` found six more, all applied.** Beyond the panel split (note 2): the
   ladder `<select>` opened blank with no prompt when a ruleset has more than one ladder, so it now
   carries a `Select a dice ladder` option like `ItemFormDialog`'s; `availableSkillCodes` was derived
   in the dialog rather than the manager, unlike its two siblings; `updateRollDefinition` went
   through `applyRenameSafely` on a **wrong rationale** — that helper exists because an entity's own
   spelling lives in a formula namespace, and a roll's name lives in none, so it was a whole-ruleset
   round trip that could never do anything; `useRollManager.availableLadders` was returned unused
   (it and a new `ladderFor` are consumed now, so the panel derives nothing); a new roll's `order`
   used `currentRolls.length`, which can collide after a delete, and is now one past the highest;
   and `holderKind` read `'Roll'` where every sibling uses the entity's own name.

## Acceptance criteria

- [x] Definition and ladder CRUD persist via store actions; export/import round-trips both. (`add`/`update`/`deleteRollDefinition` and the ladder trio in [`configStore.ts`](../../../src/stores/configStore.ts), all through `autoSave`; no component touches storage. `configStore.test.ts` › `Roll definitions CRUD (TICKET-ROLL-05)` asserts three `saveConfiguration` calls, the export→`importConfiguration` round trip, and the `category` clear removing the key; the ladder block does the same and now asserts the guarded delete.)
- [x] Input formulas validate in the character context: unknown refs named, cycles blocked at save (FORM-04 rules applied to the new attachment point). (New `roll-input` row in all three [`scoping.ts`](../../../src/engine/formula/scoping.ts) tables — no branch anywhere — sharing a derived stat's namespaces and codes, since a roll is another reading of the character. `useRollManager` calls the same `validateFormulaChange` every other formula editor uses. Evidence: `scoping.test.ts` › `gives a roll input everything a character is`, the enumeration guard now listing `roll-input`, `validator.test.ts`'s two roll cases, and `RollsConfigPanel.test.tsx` › `should refuse an input that would not compute, without saving`.)
- [x] Seeds present with placeholder-labelled descriptions. (`createSeedRolls()` in `configStore.ts` — the `[20, 12, 6]` ladder plus Melee/Ranged/Evasion/Endure. **Diverged on the inputs; see implementation note 1.** `configStore.test.ts` asserts the four names down one ladder, that every description contains "Placeholder", and — the point of the divergence — that a freshly minted ruleset produces **no** validator errors.)
- [x] Panel follows the domain shape, `ui/` primitives, theme tokens only. (`components/config/rolls/` is the four-part shape twice over — two cards, two dialogs, two managers, and **two panels**, each composing its own `ConfigPanelShell` and mounted together at the route; see implementation note 2 for why that is not one panel. The input renders `FormulaPreview` at `owner="roll-input"` per CLAUDE.md's standing rule. Route at `/config/rolls`, nav entry, dashboard card, barrel; `routeTree.gen.ts` regenerated by `vite build`, never hand-edited. 11 cases in `RollsConfigPanel.test.tsx` across both panels, including that the roll dialog offers **no** `d4…d20` boxes — the entity's whole argument against `CombatSkill`.)
- [x] Verified via the `verifier` subagent, the `fallow` skill, and the `coding-conventions` skill. (Full suite 1570/1570, 0 skipped; `tsc --noEmit` at the documented 2-error baseline; `yarn run check` clean. `fallow audit` findings recorded in implementation note 6.)
- [ ] Verified live in the browser: edit a roll's input and ladder. — **left open: the User declined the live check for this run and the rest of the milestone.**

## Notes

- `applies_to` (creature rolls) and `visibility` wait for the creature milestone / a second view;
  both additive.
- `CombatSkill` stays alive until ROLL-06 — this ticket adds alongside, that one removes.
