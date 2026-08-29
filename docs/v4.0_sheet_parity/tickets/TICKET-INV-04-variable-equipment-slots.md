# TICKET-INV-04 — Equipment slots stay User-built and variable

- **Area:** Inventory & equipment
- **Type:** Feature (seed placements + a proof)
- **Traceability:** System [08 · Equipment slots](../systems/08-equipment-slots.md); overview
  [Rulings — ticket review](../overview.md#rulings-user-2026-08-29--ticket-review) (the builder is
  the authority, the sheet's six are seed data). Builds on **TICKET-INV-03**, the equipment slot
  display builder.

> **Scope (overview [D7](../overview.md#d7--seeded-values-and-formula-text-are-a-separate-issue-user-2026-08-29)):**
> which slots the seeded ruleset ships, and their names, are the data pass's. It owes this ticket
> the sheet's six rows (`Backpack` C4:D9, `Naming` BA12:BA17) in
> [equipment-slots.json](../../imports/equipment-slots.json), with the `accesory` retirement noted.

## User story

As a User, I want to decide how many equipment slots my ruleset has and what they are called — six
like the sheet, three, or twelve — so the figure my players equip is the one I drew, not one the
app assumed.

## Description

The v4 sheet has six body slots where the old one had seven. That is a change of *data*, not of the
app: TICKET-INV-03 already made the slot set User-built — a grid the User sizes, a slot on each
cell, a glyph on each slot — and `EquipmentSlot.type` is free text a Player's `equippedItems` keys
on. This ticket's job is to keep it that way while the sheet's new spellings arrive, and to prove
the count is genuinely free rather than incidentally free.

The one code-level gap is [equipmentLayout.ts](../../../src/shared/engine/equipmentLayout.ts)'s
`SEED_PLACEMENTS`: a convenience table that opens the builder on a recognisable figure instead of a
column of unplaced boxes. It knows `head`, `chest`, `main_hand`, `off_hand`, `legs`, `feet`,
`accessory` and their obvious aliases; it has never heard of `upperbody_gear` or `right_hand`, so a
v4 ruleset would open unplaced.

## Current situation (as-is)

- **The builder already exists and is already variable** (TICKET-INV-03):
  [EquipmentSlotsConfigPanel](../../../src/client/components/config/equipment/EquipmentSlotsConfigPanel.tsx)
  is CRUD over the slot list and
  [EquipmentLayoutPanel](../../../src/client/components/config/equipment/EquipmentLayoutPanel.tsx)
  is the board — columns and rows the User picks up to
  `MAX_EQUIPMENT_GRID_COLUMNS`/`MAX_EQUIPMENT_GRID_ROWS`, slots assigned to cells, unplaced slots
  listed beside it. `placement` is optional metadata; nothing requires one.
- `EquipmentSlot.type` is free text (`e.g., "helmet", "main_hand", "off_hand"` in
  [config.ts](../../../src/shared/types/config.ts)), lowercase-with-underscores by form validation
  only. `Inventory.equippedItems` is `Record<slotType, itemId>`.
- `SEED_PLACEMENTS` in [equipmentLayout.ts](../../../src/shared/engine/equipmentLayout.ts) maps a
  normalised type to a cell + glyph, with aliases (`weapon`, `boots`, `torso`, `ring`); an unknown
  type seeds **unplaced**, which costs it nothing. `DEFAULT_EQUIPMENT_LAYOUT` is 3×4.
- The old seven-slot set lives in
  [equipment-slots.json](../../imports/equipment-slots.json) — data, and therefore the data pass's.

## Desired result (to-be)

- **The sheet's spellings recognised**: `head_gear`, `upperbody_gear`, `lowerbody_gear`,
  `foot_gear`, `right_hand`, `left_hand` join `SEED_PLACEMENTS` as aliases of the cells and glyphs
  their old spellings already use — `right_hand` beside `main_hand`, not replacing it. Nothing is
  removed: a ruleset that says `chest` keeps its figure.
- **The count is proven free, not assumed free**: a test walks a ruleset with one slot, one with
  twelve, and one with none through config, equip and the play-mode doll
  ([EquipmentDoll.tsx](../../../src/client/components/play/inventory/EquipmentDoll.tsx)). If any of
  the three surfaces a fixed assumption — a hard-coded key, a grid that cannot hold the set, a doll
  that renders only what it recognises — fixing it is this ticket's work.
- **`accessory` is not special**: it stays in the alias table and in the glyph catalogue. Whether
  the seeded ruleset ships an accessory slot is a data question, and no app code answers it.

## Acceptance criteria

- [x] A ruleset whose slots are exactly the sheet's six opens the builder on a placed figure — six
      cells, sensible glyphs, nothing unplaced — pinned by an `equipmentLayout` test naming each of
      the six spellings.
      (`shared/engine/equipmentLayout.test.ts` *should open a v4 ruleset on a whole figure with
      nothing left over* — all six placed, six distinct cells, glyphs
      `helm/chest/legs/feet/main-hand/off-hand` — over the `SHEET_SIX` list that names each
      spelling. Seen through the builder in
      `config/equipment/EquipmentLayoutPanel.test.tsx` *should open a v4 ruleset with all six on
      the figure*, which asserts the six cells by coordinate and that the panel says
      "Every slot is placed.")
- [x] The old spellings still place: `chest`, `main_hand`, `off_hand`, `legs`, `feet`, `accessory`
      and their existing aliases resolve exactly as they do today — the same test, both halves.
      (`equipmentLayout.test.ts` *should keep every spelling it recognised before, alias for alias*
      walks `OLD_SHEET_SLOTS` and the eight hand-written aliases against the box each stands on,
      with `amulet` checked apart because it shares the accessory cell and differs only in glyph;
      *should fit inside the grid it seeds alongside, in both generations of spelling* is the one
      loop over both lists. Structurally guaranteed too: the boxes are named constants
      (`HEAD_BOX`, `MAIN_HAND_BOX`, …) that every spelling of a box shares, so the two generations
      cannot drift.)
- [x] Rulesets with 1, 6 and 12 slots each configure, equip and render on the doll end to end; a
      ruleset with **no** slots renders the empty state rather than a broken board — component
      tests over all four.
      (`play/inventory/InventoryPanel.test.tsx` *a ruleset's slot count* — each case configures the
      slots, lays them out through `seedEquipmentLayout` (the action the builder's own effect
      calls), equips through the tile's control and reads `equippedItems` back off the store:
      *should draw a one-slot ruleset as a figure of one*, *…the sheet's six with every one of them
      on the figure*, *…twelve slots without dropping the ones it does not recognise*, and *should
      say a ruleset defines no slots rather than draw an empty board*. The configure half at 1/6/12
      is `EquipmentLayoutPanel.test.tsx`'s *at any slot count* describe, where the twelve-slot case
      places all six unrecognised slots on the six free cells of the default 3×4 board and ends on
      "Every slot is placed."; the 0-slot builder case was already pinned by *should say so rather
      than draw a board when the ruleset defines no slots*. **No fixed assumption was found** — the
      grid ceiling is 6×6, the doll renders `placed`/`loose` off `splitByPlacement` and
      `InventoryPanel` already carried the empty state — so no production fix was owed beyond the
      alias table.)
- [x] No slot key is named outside `SEED_PLACEMENTS` and the glyph catalogue: a grep for the slot
      spellings across `engine/`, `services/` and play-mode components finds them nowhere else.
      (`rg "['\"\`](head|helmet|helm|head_gear|main_hand|weapon|right_hand|chest|body|torso|
      upperbody_gear|off_hand|shield|left_hand|legs|lowerbody_gear|accessory|ring|amulet|feet|
      boots|foot_gear)['\"\`]" src --glob '!*.test.*'` returns, once the `Text variant="body"`
      coincidences are set aside: `SEED_PLACEMENTS` and its prose in `equipmentLayout.ts`;
      `GLYPH_NAMES` in `types/config.ts` and `GLYPH_LABELS`/`GLYPH_GROUPS` in
      `ui/Glyph/Glyph.catalogue.ts` — the glyph catalogue the criterion allows; and JSDoc prose in
      `EquipmentDoll.tsx`, `EquipmentLayoutPanel.tsx` and `useEquipmentLayoutBuilder.ts` recording
      the recognition table this replaced. The only other hits are User-facing *examples*
      (`EquipmentSlotFormDialog.tsx`'s placeholder and hint, `EquipmentSlotsConfigPanel.tsx`'s
      description, `config.ts`'s `// e.g., "helmet", "main_hand", "off_hand"`), left as they are on
      purpose: an example is not a vocabulary, and rewriting them to the v4 words would imply the
      app has a favourite set.)
- [x] Persistence through store actions only; slot changes ride the existing
      equip/unequip and slot-CRUD actions unmodified.
      (`git diff` touches two production files and **no equip, unequip or slot-CRUD action**:
      `shared/engine/equipmentLayout.ts` is the alias table, and `client/stores/configStore.ts`'s
      `seedEquipmentLayout` gained a spread — see the aliasing note below — while keeping its
      behaviour. No hook, service or component moved. Every new component test drives the real
      `configStore` and `characterStore` with `services/storage` mocked, so `addEquipmentSlot`,
      `seedEquipmentLayout`, `placeEquipmentSlot` and `moveItemToEquipment` are the only writers on
      either path.)
- [x] Unit tests cover: alias resolution for both generations of spelling, an unknown type seeding
      unplaced, and `equippedItems` round-tripping import/export at a slot count of one and twelve.
      (Alias resolution: the two `seedPlacementFor` cases above, plus *should hand out a copy, so
      one ruleset cannot edit another's seed* — the boxes are shared now, so the reader returns a
      copy. Unknown type: *should have no opinion about a slot it has never heard of* (`horns` →
      `null`) and *should place the slots it recognises and leave the rest for the User*. Round
      trip: `shared/services/importExport.test.ts` *a slot set of any size round-trips
      (TICKET-INV-04)* takes a ruleset of 1 and of 12 placed slots through
      `serializeConfiguration` → `importConfiguration` unchanged and through
      `validateConfigurationShape` clean; `shared/services/characterShape.test.ts` *a kit of any
      size* takes `equippedItems` of 1 and of 12 keys through `JSON.stringify`/`parse` and past
      `uploadedCharacterErrors`, which is the gate both roots run on a stored or uploaded
      character.)
- [ ] Verified via the `verifier` subagent, the `fallow` skill, and the `coding-conventions`
      skill, plus ~~a live browser check of a six-slot board and a twelve-slot board~~ (ask the
      User first).
      (Left open for its **browser** clause only: the browser check was skipped by User instruction
      for this run, so neither board has been seen live. The rest is done — `npx vitest run`
      **3278/3278** with 0 failing and 0 skipped across 197 files, `npx tsc --noEmit` at its
      documented 2-error baseline, `yarn run check` clean including `yarn run arch`
      (696 modules, 0 violations), and `fallow audit --base main` **pass** with
      `dead_code_introduced: 0`, `complexity_introduced: 0`, `duplication_introduced: 0`.
      `fallow dead-code`'s two rows are inherited and untouched here; `fallow health --hotspots
      --since 6m` puts one touched file — `importExport.test.ts`, 9.8 — on the accelerating list,
      recorded in TEST_STATUS.md.)

## Notes

- **Must land before TICKET-INV-05/06** — composed items hang off whatever slots the ruleset has,
  and INV-05's per-slot summation should be written against a variable set from the start.
- No `RETIRED_FIELDS` entry and no conversion: nothing in the *shape* is being retired here. A
  stored character keyed on slots its ruleset no longer has is the existing validation surface's
  problem, unchanged by this ticket.
- The alias table is a convenience, not a vocabulary. It earns its keep by opening the builder on a
  figure; a slot it has never heard of is a first-class slot that the User places once.

## Implementation notes (2026-08-29)

- **No `SUPPORTED_SCHEMA_VERSION` bump, and none owed — this is not the milestone's first reshaping
  ticket.** Nothing persisted moved: `EquipmentSlot.type` was already free text, `EquipmentSlot`
  gained and lost no field, `Inventory.equippedItems` is the same `Record<slotType, itemId>`, and
  `SEED_PLACEMENTS` is a lookup table that never leaves the engine. The *accessory retirement* the
  overview's ruling settles under [D6](../overview.md#d6--no-backwards-compatibility-v40-is-a-clean-break-user-2026-08-29)
  is a rewrite of the **seeded fragment's** slot keys, which is the data pass's under
  [D7](../overview.md#d7--seeded-values-and-formula-text-are-a-separate-issue-user-2026-08-29) — and
  `accessory` is deliberately still in the alias table here, because whether a ruleset *has* an
  accessory slot is not a question app code answers. D6's single milestone-wide bump still belongs
  to the first ticket that genuinely reshapes a document, or to TICKET-DX-09.
- **The boxes were named before the six spellings were added to them.** The seed table repeated a
  three-field literal per alias, so `right_hand` would have been a second copy of `main_hand`'s
  coordinates and a box that moved would have had to be moved twice. Eight `*_BOX` constants now
  hold the cells and the glyphs, and every spelling of a box is a key pointing at one of them —
  which makes *"an alias of the cell and glyph its old spelling already uses"* structural rather
  than merely asserted. `seedPlacementFor` returns a **copy**, since a shared object handed to a
  ruleset would be the table editable from a distance.
- **One latent aliasing hazard of the same class was closed next door** (found in the
  `conventions-reviewer` pass). `configStore.seedEquipmentLayout` wrote
  `equipmentLayout: DEFAULT_EQUIPMENT_LAYOUT` — the exported module object *itself* — so every
  ruleset seeded in a session shared one layout. Latent rather than live, because
  `setEquipmentLayout` always builds a new clamped object, but it is exactly what
  `seedPlacementFor`'s copy closes one file over, and a spread closes it too. Behaviour unchanged;
  the reason is in a comment at the call site.
- **Nothing in the three surfaces turned out to be fixed**, which is the finding the second
  criterion was really asking for: the grid ceiling is `MAX_EQUIPMENT_GRID_COLUMNS`/`ROWS` (6×6, 36
  cells) and clamped in the store, `EquipmentDoll` draws whatever `splitByPlacement` hands it and
  lists the rest, and `InventoryPanel` already had the no-slots empty state. So the count was
  genuinely free and is now *proven* free rather than assumed — one production file changed.
- **`shared/engine/dependencies.ts` is owed nothing.** No new `Character` field names a
  configuration entity here; `equippedItems` keys on a slot *type* and the ticket adds no field to
  either document.
