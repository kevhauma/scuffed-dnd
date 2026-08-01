# Custom DnD Builder — v1.0 Foundation (Overview)

The first and (so far) only milestone: everything needed for a User to define a complete custom
ruleset and for a Player to build and play a character on it. Requirements live in
[requirements.md](./requirements.md), the architecture in [design.md](./design.md).

This file is the **index + build order**. Ticketed lines link to a `tickets/TICKET-*.md` file
carrying its own user story, as-is/to-be, and acceptance criteria — work them with the
`work-ticket` skill. Lines still marked *(plan §N)* come from the original
[tasks.md](./tasks.md) plan and have not been expanded into tickets yet; expand one with the
`story-ticket` skill before building it, then work the ticket.

## Built

Tasks 1–4 and 6–11 of the original plan shipped before the ticket workflow existed and are not
retroactively ticketed. Their detail (and requirement traceability) stays in [tasks.md](./tasks.md).

- [x] 1. Project setup and core infrastructure
- [x] 2. Core TypeScript types and data models — `src/types/`
- [x] 3. Formula engine — parser, evaluator, validator — `src/engine/formula/`
- [x] 4. Calculation engine — stat / speciality / combat / equipment calculators — `src/engine/calculators/`
- [x] 6. Storage service — LocalStorage abstraction + JSON import/export — `src/services/`
- [x] 7. Configuration validation service — `src/engine/validator.ts`
- [x] 8. Zustand stores — config, character, UI — `src/stores/`
- [x] 9. Checkpoint
- [x] 10. Base component library with medieval theme — `src/components/ui/`
- [x] 11. Configuration mode UI — all eight panels — `src/components/config/`

## Open — in build order

- [x] [TICKET-NAV-02](./tickets/TICKET-NAV-02-wire-config-routes-to-panels.md) — Mount the configuration panels on their routes (bug fix, Req 19.4 — six of the eight panels §11 built are unreachable; every `/config/*` route but the dashboard is still a placeholder) — **first**: smallest ticket in the backlog and it makes a third of the codebase reachable, so everything after it can be checked in a browser
- [x] [TICKET-DX-01](./tickets/TICKET-DX-01-fix-react19-vitest-hooks-failures.md) — Fix the React 19 + Vitest hooks-dispatcher failures (48 failing, 11 skipped) — early, because until it lands every ticket is verified against a baseline instead of a green suite, and each new hook-using component widens the exception list
- [x] [TICKET-CALC-01](./tickets/TICKET-CALC-01-calculated-character-assembly.md) — Assemble `CalculatedCharacter`, apply equipment bonuses to main and speciality skills (Req 11.5, 13.1-13.3, 6.7, 9.3) — §4 was checked off with the calculators built but never composed, so every play-mode screen would otherwise invent its own arithmetic
- [x] [TICKET-IO-01](./tickets/TICKET-IO-01-restore-state-on-app-start.md) — Restore configuration and characters on app start (bug fix, Req 17.3, 17.4 — hydration only fires inside `/config`, and `loadCharacters()` has no caller at all) — small and independent; take it early so later tickets aren't developed against an app that only has state if you visited `/config` first
- [x] [TICKET-FORM-01](./tickets/TICKET-FORM-01-block-circular-formulas-on-save.md) — Block circular formulas on save and derive skill dependencies from the parser (bug fix, Req 16.5, 16.6, 2.6 — decision recorded below) — independent; do it while the config panels are freshly reachable from NAV-02
- [x] [TICKET-ROLL-01](./tickets/TICKET-ROLL-01-dice-rolling-engine.md) — Dice simulator and combat roll aggregator (Req 5.5, 5.6) — pure engine, no UI; the last unbuilt piece of the logic layer, and TICKET-ROLL-02 plus the sheet's roll buttons both depend on it
- [ ] [TICKET-SKL-01](./tickets/TICKET-SKL-01-main-skill-point-allocation-rules.md) — Point allocation rules for main skills (Req 2.4, 11.3) — never modelled; blocks TICKET-CHAR-02 from honestly satisfying 11.3. Carries a blocking design decision for the User
- [ ] [TICKET-CHAR-01](./tickets/TICKET-CHAR-01-character-list.md) — Character list at `/play` (Req 11.1, 17.4, 21.1-21.5) — the entry point to play mode; nothing else in play mode is reachable until it exists
- [ ] [TICKET-CHAR-02](./tickets/TICKET-CHAR-02-character-creation-wizard.md) — Character creation wizard at `/play/create` (Req 11.1-11.6, 21.1-21.5) — needs TICKET-CHAR-01 for its entry point, TICKET-CALC-01 for its review step, and TICKET-SKL-01 for point allocation; produces the characters every later play-mode ticket renders
- [ ] [TICKET-NAV-01](./tickets/TICKET-NAV-01-root-layout-and-mode-switching.md) — Root layout: medieval shell, real mode switching, play-mode config lock (bug fix, Req 19.1-19.6, 22.1-22.6 — `__root.tsx` is still stock scaffold and `useUIStore.mode` is never written) — after the first play screens exist so the play nav has destinations, but before the §17.5 polish pass
- [ ] [TICKET-UI-01](./tickets/TICKET-UI-01-base-component-convention-cleanup.md) — Base component library cleanup: drop parent-layout constraints, replace `bg-white`/hex literals with theme tokens, add `FormField.style.ts`, fix the barrels (refactor, Req 21.2/21.3/21.6/21.7, 22.1, 22.4) — independent, can ship any time; cheaper before play mode adds a second wave of call sites, and closes most of §17.6 early
- [ ] Character sheet at `/play/character/$id` — header, main skills with racial bonuses, stats, speciality skills, combat skills with roll buttons *(plan §12.3 — Req 8.5, 13.4, 14.1, 14.2, 21.1-21.5)* — needs TICKET-CHAR-02
- [ ] StatEditor — current/max stat values with edit controls, current capped at max, negatives allowed *(plan §12.6 — Req 14.1-14.5, 21.1-21.5)* — embedded in the sheet, build alongside it
- [ ] InventoryPanel — equipment slot grid, misc items, drag-and-drop assignment with slot-type validation *(plan §12.4 — Req 12.1-12.6, 21.1-21.5)* — needs the sheet to hang off. Note: `useCharacterStore.equipItem()` writes any item into any slot with no type check today, so Req 12.3 has to be enforced in the **store**, not only in the panel
- [ ] Equipment bonus wiring — equip/unequip triggers recalculation and updates the sheet *(plan §14.1 — Req 13.1-13.5)* — needs the InventoryPanel; the calculator itself already exists
- [ ] CombatSkillRoller — per-skill roll button, animated dice, result breakdown, session history *(plan §12.5 — Req 15.1-15.5, 21.1-21.5, 22.1-22.6)* — needs TICKET-ROLL-01
- [ ] Play mode routes wired to real components *(plan §13.3 — Req 19.5)* — folded into the CHAR/INV tickets as they land; keep as a closing check
- [ ] Config dashboard with validation status and a "Validate Configuration" action *(plan §17.2 — Req 18.5, 18.6, 21.1-21.5)* — independent, can ship any time; `engine/validator.ts` and the `ValidationReport` primitive both already exist. **Still needed after TICKET-FORM-01**, which guards the *dialogs*: an imported configuration never passes through them, and per FORM-01's implementation note a multi-formula cycle can only enter that way. This is the check that catches it
- [ ] Export configuration button in config mode *(plan §15.1 — Req 1.4, 21.1-21.5)* — independent; `downloadConfiguration()` already exists, this is the button
- [ ] Import configuration button with validation errors surfaced *(plan §15.2 — Req 1.5, 1.6, 21.1-21.5)* — after export, so both live in the same config-mode surface
- [ ] Currency conversion utilities — convert between tiers, display values in the right tier *(plan §16.1 — Req 10.4, 10.5)* — independent; needed before item/material values can be shown in play mode
- [ ] [TICKET-POL-01](./tickets/TICKET-POL-01-route-layer-theme-and-composition.md) — Route layer: medieval theme tokens, `Text` primitive instead of raw markup, delete the dead `Header.tsx` (refactor, Req 22.1-22.4, 21.4, 21.5 — 38 stock-palette classes across 13 files) *(covers plan §17.5)* — **after** NAV-02 and NAV-01, or it re-themes markup that's about to be replaced
- [ ] [TICKET-DX-02](./tickets/TICKET-DX-02-reconcile-biome-with-the-codebase.md) — Reconcile `biome.json` with the codebase and clear the 35 lint errors (refactor; carries a formatting decision for the User) — schedule when the tree is quiet, since a whole-repo reformat conflicts with anything in flight
- [ ] [TICKET-DX-03](./tickets/TICKET-DX-03-traceability-and-component-shape.md) — `**Validates: Requirements**` headers across the codebase (10 of 108 modules today) and a `useFocusStatManager` hook for the one panel missing it *(covers the rest of plan §17.6)* — late, so the sweep covers the whole codebase once
- [ ] Remaining integration passes — stores wired to components, multi-race bonuses, formula recalculation flows *(plan §17.1, 17.3, 17.4)* — verification work, last
- [ ] Final checkpoint — full suite green *(plan §18)* — reachable once TICKET-DX-01 lands

## Spec decisions (answered 2026-07-30)

Raised by auditing [requirements.md](./requirements.md) against the code; answered by the User.
These are settled — don't re-open them without a new decision here.

- **One configuration at a time.** Multiple saved configurations are a nice-to-have, not a feature:
  moving a ruleset between browsers or keeping a spare goes through **import/export**
  (plan §15.1, §15.2), which is already specced. Requirement 1's plural wording therefore describes
  files on disk, not a picker in the app. A rename field for the current configuration is still
  worth having — currently it's hardcoded to `'My Custom Game System'` at initialisation — fold it
  into the export/import work rather than ticketing separately.
- **Item categories stay free-text.** A category exists exactly as long as an item references it;
  a category with no items assigned is ignored. Requirement 7.4 is satisfied as implemented — no
  item-category entity, no CRUD, no ticket.
- **Circular formulas: block and report.** Requirement 16.5's "prevent" stands as written — the
  save is refused and the cycle is named. →
  [TICKET-FORM-01](./tickets/TICKET-FORM-01-block-circular-formulas-on-save.md).
- **Level-ups after creation: out of scope** for v1.0, to be tackled when it comes up.
  [TICKET-SKL-01](./tickets/TICKET-SKL-01-main-skill-point-allocation-rules.md) stays scoped to
  creation-time allocation.

## Definition of Done (applies to every ticket)

Per [../../CLAUDE.md](../../CLAUDE.md): `npx vitest run` **green — 0 failures, 0 skips**,
`npx tsc --noEmit` with no errors beyond the 9 pre-existing ones in
[TEST_STATUS.md](../../TEST_STATUS.md), `yarn run lint` with no new errors, plus a live browser
check for any UI-visible change. Persistence goes through
a store action, never a direct storage-service or `localStorage` call from a component. Derived
numbers come from the engine calculators and are never persisted onto `Character`. Feature
components compose `components/ui` primitives and own their layout; base components never gain
margin or positioning. Styling uses the medieval theme tokens only. `src/routeTree.gen.ts` is
generated and never hand-edited.

[TICKET-DX-01](./tickets/TICKET-DX-01-fix-react19-vitest-hooks-failures.md) landed on 2026-07-31,
so the §18 "all tests pass" checkpoint is now reachable and the bar above is the strict one. The
cause was `tanstackStart()` in the Vitest plugin pipeline double-instantiating React; tests now run
from a dedicated `vitest.config.ts`. See [TEST_STATUS.md](../../TEST_STATUS.md).
