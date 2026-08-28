# TICKET-PAS-01 — Passive abilities: the catalog

- **Area:** Passive abilities (new area)
- **Type:** Feature (new entity, catalog only)
- **Traceability:** System [14 · Passives and reference tables](../systems/14-passives-and-reference-tables.md);
  overview [D5](../overview.md#d5--what-is-deliberately-not-parity) (nothing grants a passive
  yet). **Needs TICKET-SPL-03** (the templating attachment point two effects use). First ticket
  of the minted **`PAS`** prefix.

## User story

As a DM, I want a catalog of passive abilities — resistances, immunities, senses — that I can
hand to a character by name, so the sheet's reference table exists in the app before anything
automates it.

## Description

26 passives, name + effect text. Nothing grants them — Setup says "Passive abilites: Coming
soon", races and items reference nothing — so v4.0 builds the *catalog only*: the entity, a
config panel, the fragment, and a DM handout field. Wiring passives to races or items waits for
the sheet to do it first. Two of the 26 effects are formulas (Blindsight and darkvision scale
with perception), templating exactly like spells.

## Current situation (as-is)

- Nothing — no passive entity anywhere.
- The templating surface exists after TICKET-SPL-03: the `spell-effect`-style attachment point in
  [scoping.ts](../../../src/shared/engine/formula/scoping.ts), with
  [FormulaPreview](../../../src/client/components/config/shared/FormulaPreview.tsx) on every
  User-authored formula field.
- The sheet's actives tab exists and is empty — recorded, built into nothing.

## Desired result (to-be)

- **`Configuration.passives?`** — optional array, absent-means-none: `{ id, name, effectText }`,
  with `effectText` templated through the SPL-03 attachment point (its own `FormulaOwner` if the
  reference set differs; reuse if not — smallest shape wins) and previewed like every formula
  field.
- **A config panel** through
  [ConfigPanelShell](../../../src/client/components/config/shared/ConfigPanelShell.tsx) — list,
  edit, guarded delete.
- **`passives.json` + `Character.passiveIds?`** — the fragment carrying all 26 rows with the
  doubled poison-resistance ladder handled first-occurrence-wins, both row sets cited (the
  `skinning` precedent); and an optional character field so a DM can hand one out by name —
  all the sheet's table can do today.

## Acceptance criteria

- [ ] A ruleset with no `passives` behaves exactly as today; a character with no `passiveIds`
      likewise — both additive-optional, no version bump of their own.
- [ ] Blindsight and darkvision resolve per character (perception level × 10 / × 5 feet) through
      the one engine — no second evaluator; the other 24 render as plain text.
- [ ] The DM hands a passive out and takes it back through the DM action surface
      ([dmActions.ts](../../../src/shared/services/dmActions.ts)) with an Event, and the sheet
      lists the character's passives with resolved text; a Player cannot self-grant.
- [ ] Deleting a passive a character holds is refused by the walker
      ([dependencies.ts](../../../src/shared/engine/dependencies.ts)) naming the holder.
- [ ] `passives.json` created citing `Background refernces abilities: passive` (typo intact)
      B1:D27, the duplicate ladder rows both cited with first-occurrence-wins recorded, and the
      empty actives tab noted; `yarn run sheet:import` regenerated;
      [README.md](../../imports/README.md) gains the fragment's row.
- [ ] Unit tests cover: absent defaults, the two templated effects, grant/revoke with Events,
      and the delete guard.
- [ ] Verified via the `verifier` subagent, the `fallow` skill, and the `coding-conventions`
      skill, plus a live browser check of a handout appearing on the sheet (ask the User first).

## Notes

- **Build no granting mechanism** beyond the DM handout — no race wiring, no item wiring, no
  effect *mechanics* (a resistance is text; damage math does not exist to hook into). That is
  D5's line, held on purpose.
- The measurements table (Naming AU:AX) stays recorded-not-built — it belongs to no ticket.
