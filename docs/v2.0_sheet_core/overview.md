# Custom DnD Builder — v2.0 Sheet Core (Overview)

The second milestone: rework the app's core model so it matches what the source spreadsheet
actually does, as reverse-engineered in [`docs/excel export summary/`](../excel%20export%20summary/ttrpg-app-spec.md).
v1.0 was built from a working memory of the sheet; the export summary (2026-08-03) documented the
real mechanics cell-by-cell and showed the core missed in four structural places — the stat/skill
split, the skill level/bonus machinery, the specialisation mechanism, and the progression loop.
This milestone corrects the core. Content concepts built *on* that core (creatures, spells,
passives, harvest tables, item templates, material generators, currency rework) are later
milestones.

**Requirement source for this version:** the concept pages under
[`docs/excel export summary/concepts/`](../excel%20export%20summary/concepts/README.md), plus the
[spec](../excel%20export%20summary/ttrpg-app-spec.md). Tickets cite concept page numbers in their
`Traceability` line (e.g. `Concept 01 · Stat`); v1.0 requirement numbers appear only where a v1.0
behaviour is deliberately kept. There is no separate `requirements.md` here — the concept pages
are the requirements.

## Decisions (2026-08-03)

Made by the User when this milestone was scoped. Settled — don't re-open without a new decision here.

- **Option (a): correct the core, then build outward.** The current model is not "our own system";
  the goal is the sheet.
- **The product concept is unchanged: browser-only, no backend, one configuration.** Everything in
  the spec that assumes a server (multi-user roles, draft/publish versioning, audit logs) is out of
  scope for this milestone and probably forever. "Just a config."
- **Everything is configurable** — every name, abbreviation, and formula is data the User can edit,
  and renaming must never break a reference (Concept 00 §6). That is TICKET-REF-01 plus the entity
  tickets.
- **Clean break on persisted data.** The v2 `Configuration`/`Character` shapes are not compatible
  with v1. v1 LocalStorage and v1 JSON exports are rejected with a clear notice, not converted —
  old characters (focus stat, spend-derived level, speciality base levels) have no faithful mapping
  into the new model. TICKET-IO-03.
- **Tickets stay small.** At most **three to-be items** per ticket; anything larger splits into
  sequential tickets (User request, 2026-08-03). Engine/UI splits follow the ROLL-01/ROLL-02
  precedent. Apply this to every future ticket in every version.
- **The v1 skill triad collapses into the sheet's concepts:**

  | v1 concept | becomes | in tickets |
  |---|---|---|
  | `MainSkill` + `Stat` | one **Stat** concept (invested *or* derived, flags for resource/total) | STAT-01 · STAT-02 · STAT-03 |
  | `SpecialitySkill` | **Skill** — weighted stat derivation with level *and* bonus | SKL-02 · SKL-03 |
  | `CombatSkill` | **Roll definition** — input expression fed through a dice ladder | ROLL-05 · ROLL-06 |
  | focus stat (`focusStatCode` / `focusStatBonusLevel`) | **retired** — replaced by Archetype | ARC-03 |
  | `mainSkillPointBudget` (flat pool) | budget derived: `level × const.points_per_level` | RES-02 |

## Not in this milestone (deliberately)

Creature/bestiary, Spell, Passive, Harvest table, Creature type, Size, Damage & check types,
item template/instance split, slot `count`/`accepts`, material tier **generators**, currency
base-unit rework, the xlsx importer, Views beyond the existing sheet, versioning/permissions.
Each needs the corrected core first; ticket them in a later version once this one lands.

## Open — in build order

Formula engine (all additive, suite stays green):

- [x] [TICKET-FORM-02](./tickets/TICKET-FORM-02-formula-function-library.md) — Function calls in the formula engine (Concepts 01, 02) — **first**: `round`/`max` unlock every confirmed derivation
- [x] [TICKET-FORM-03](./tickets/TICKET-FORM-03-namespaced-reference-syntax-and-resolution.md) — Namespaced reference syntax and resolution (Concept 00 §5) — needs FORM-02's parser work fresh
- [x] [TICKET-FORM-04](./tickets/TICKET-FORM-04-namespace-scoping-and-cycle-detection.md) — Namespace scoping table + cycle detection across namespaces (Concept 00 §5) — pairs with FORM-03
- [x] [TICKET-FORM-05](./tickets/TICKET-FORM-05-errors-as-values-engine.md) — Errors as values in the engine (Concept 00 §7) — before the entity tickets multiply `CalculatedCharacter` consumers
- [x] [TICKET-FORM-06](./tickets/TICKET-FORM-06-error-chips-on-the-sheet.md) — Error chips on the character sheet (Concept 00 §7) — renders FORM-05; closes the v1.0 known bug's visible half

Identity and the two new config concepts:

- [ ] [TICKET-REF-01](./tickets/TICKET-REF-01-stable-ids-and-rename-safety.md) — Stable ids and rename-safe formulas (Concept 00 §6) — the "every name configurable" decision; before the entity tickets
- [ ] [TICKET-REF-02](./tickets/TICKET-REF-02-guarded-deletes.md) — Guarded deletes with reference lists (Concept 00 §6) — needs REF-01's references and FORM-05's error values
- [ ] [TICKET-CST-01](./tickets/TICKET-CST-01-constants-concept.md) — Constants entity and `const.*` (Concept 05) — SKL-02, RACE-02, RES-02, ARC-02 read these
- [ ] [TICKET-CST-02](./tickets/TICKET-CST-02-constants-panel.md) — Constants panel (Concept 05) — UI for CST-01
- [ ] [TICKET-CRV-01](./tickets/TICKET-CRV-01-curve-entity-and-lookup.md) — Curve entity and lookup engine (Concept 06) — RES-01 (reverse) and ARC-02 (multi-column) consume it
- [ ] [TICKET-CRV-02](./tickets/TICKET-CRV-02-curve-generators-and-overrides.md) — Curve generators with preserved overrides (Concepts 06, 00 §1.1) — the generate-and-overlay machinery
- [ ] [TICKET-CRV-03](./tickets/TICKET-CRV-03-curves-panel-and-seeds.md) — Curves panel and the `point_buy` / `xp_thresholds` seeds (Concept 06) — UI + seeds for CRV-01/02

The schema rework:

- [ ] [TICKET-STAT-01](./tickets/TICKET-STAT-01-unified-stat-model-and-engine.md) — The unified Stat model and engine (Concepts 01, 00) — **the centrepiece**; merges `MainSkill` + `Stat`, new character shape, composition calculator
- [ ] [TICKET-IO-03](./tickets/TICKET-IO-03-v2-shape-clean-break.md) — Clean break: reject v1 data with a clear notice (decision above) — immediately after STAT-01 so nothing misloads old data
- [ ] [TICKET-STAT-02](./tickets/TICKET-STAT-02-unified-stats-panel.md) — Unified stats configuration panel (Concept 01) — the real editor replacing STAT-01's mechanical patches
- [ ] [TICKET-STAT-03](./tickets/TICKET-STAT-03-wizard-and-sheet-on-unified-stats.md) — Wizard and sheet on unified stats (Concept 01) — play surfaces; resource gating of current values

Mechanics on the new core:

- [ ] [TICKET-RACE-01](./tickets/TICKET-RACE-01-race-stat-blocks.md) — Races as stat blocks (Concept 04 subset) — shape + editor
- [ ] [TICKET-RACE-02](./tickets/TICKET-RACE-02-blended-bases-and-cardinality.md) — Blended bases, 1–2 races (Concepts 04, 05) — wires the base term; fixes additive stacking
- [ ] [TICKET-MAT-01](./tickets/TICKET-MAT-01-modifiers-target-stats.md) — Material modifiers target stats (Concept 09) — shape + dialog
- [ ] [TICKET-MAT-02](./tickets/TICKET-MAT-02-equipment-bonuses-on-stats.md) — Equipment bonuses land on stats (Concepts 01, 09) — completes the composition; "+50 Mana" works
- [ ] [TICKET-SKL-02](./tickets/TICKET-SKL-02-weighted-skills-level-and-bonus.md) — Skill entity and weighted derivation (Concept 02) — level + `round(level / const.bonus_divider)`
- [ ] [TICKET-SKL-03](./tickets/TICKET-SKL-03-skills-panel-and-sheet-grid.md) — Skills panel, sheet grid, skill validation (Concept 02) — UI + the three validation rules
- [ ] [TICKET-RES-01](./tickets/TICKET-RES-01-xp-and-derived-level.md) — XP and curve-derived level (Concepts 20, 06) — inverts v1.0's spend-derived level
- [ ] [TICKET-RES-02](./tickets/TICKET-RES-02-level-derived-point-budget.md) — Level-derived point budget (Concepts 06, 05) — retires the flat pool; needs RES-01
- [ ] [TICKET-RES-03](./tickets/TICKET-RES-03-resource-pool-behaviours.md) — Resource pool behaviours (Concept 20) — reset-to-max, relative entry, kept-and-flagged
- [ ] [TICKET-ARC-01](./tickets/TICKET-ARC-01-archetype-concept-and-panel.md) — Archetype concept and panel (Concept 03) — entity + affinity editor
- [ ] [TICKET-ARC-02](./tickets/TICKET-ARC-02-curve-routed-stat-gains.md) — Curve-routed stat gains (Concepts 03, 06) — the exchange rates; needs ARC-01, CRV-03, RES-02
- [ ] [TICKET-ARC-03](./tickets/TICKET-ARC-03-wizard-step-and-focus-stat-retirement.md) — Wizard archetype step; retire the focus stat (Concept 03) — closes the character-build loop

Rolls, then the gate:

- [ ] [TICKET-ROLL-03](./tickets/TICKET-ROLL-03-dice-ladder-engine.md) — Dice ladder entity and decomposition (Concept 07) — pure engine
- [ ] [TICKET-ROLL-04](./tickets/TICKET-ROLL-04-ladder-rolling-and-notation.md) — Ladder rolling and notation (Concept 07) — pure engine; pairs with ROLL-03
- [ ] [TICKET-ROLL-05](./tickets/TICKET-ROLL-05-roll-definitions-and-panel.md) — Roll definitions and the rolls panel (Concept 08) — entity + editor + seeds
- [ ] [TICKET-ROLL-06](./tickets/TICKET-ROLL-06-sheet-rolls-and-combat-skill-removal.md) — Sheet rolls the definitions; `CombatSkill` removed (Concept 08) — completes the triad collapse
- [ ] [TICKET-DX-04](./tickets/TICKET-DX-04-golden-fixtures-from-the-sheet.md) — Golden fixtures from the sheet (spec §12) — **last**: the milestone's parity gate and final checkpoint

## Definition of Done (applies to every ticket)

Per [../../CLAUDE.md](../../CLAUDE.md): `npx vitest run` green — 0 failures, 0 skips —
`npx tsc --noEmit` with no errors beyond the documented baseline in
[TEST_STATUS.md](../../TEST_STATUS.md), `yarn run check` clean (the pre-commit hook enforces it),
verification via the `verifier` subagent plus the `fallow` and `coding-conventions` skills, and a
live browser check for anything UI-visible (ask the User first; if declined, the criterion stays
open with a note). Persistence goes through a store action. Derived values come from the engine
and are never persisted onto `Character` — the sanctioned stored player state after this
milestone is exactly resource current values, invested points, and accumulated XP. Feature
components compose `components/ui` primitives; theme tokens only; `src/routeTree.gen.ts` is never
hand-edited.
