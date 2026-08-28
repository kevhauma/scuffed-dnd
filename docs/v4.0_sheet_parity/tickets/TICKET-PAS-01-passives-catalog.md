# TICKET-PAS-01 — Passive abilities: the entity and the handout

- **Area:** Passive abilities (new area)
- **Type:** Feature (new entity)
- **Traceability:** System [14 · Passives and reference tables](../systems/14-passives-and-reference-tables.md);
  overview [D5](../overview.md#d5--what-is-deliberately-not-parity) (nothing grants a passive
  yet). **Needs TICKET-SPL-03** (the templating attachment point two effects use). First ticket
  of the minted **`PAS`** prefix.

> **Scope (overview [D7](../overview.md#d7--seeded-values-and-formula-text-are-a-separate-issue-user-2026-08-29)):**
> the 26 passives are the data pass's. It owes this ticket a new `passives.json` citing
> `Background refernces abilities: passive` (typo intact) B1:D27, the doubled poison-resistance
> ladder handled first-occurrence-wins with both row sets cited (the `skinning` precedent), the two
> templated effects (Blindsight and darkvision, perception level × 10 / × 5 feet) written in
> SPL-03's syntax, the empty actives tab noted, and its row in
> [README.md](../../imports/README.md).

## User story

As a DM, I want a catalog of passive abilities — resistances, immunities, senses — that I can
hand to a character by name, so the sheet's reference table exists in the app before anything
automates it.

## Description

Name + effect text, and nothing else. Nothing grants a passive — Setup says "Passive abilites:
Coming soon", races and items reference nothing — so v4.0 builds the entity, a config panel, and a
DM handout field, and stops there. Wiring passives to races or items waits for the sheet to do it
first. Some effects are formulas (Blindsight and darkvision scale with perception), templating
exactly like spells.

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
- **`Character.passiveIds?`** — an optional character field, absent-means-none, so a DM can hand a
  passive out by name and take it back. All the sheet's table can do today.

## Acceptance criteria

- [ ] A ruleset with no `passives` behaves exactly as today; a character with no `passiveIds`
      likewise — both additive-optional, no version bump of their own.
- [ ] A templated effect resolves per character through the one engine — no second evaluator — and
      a plain-text effect renders verbatim; both pinned against fixtures shaped like Blindsight
      (perception level × 10 feet) and a resistance line.
- [ ] The DM hands a passive out and takes it back through the DM action surface
      ([dmActions.ts](../../../src/shared/services/dmActions.ts)) with an Event, and the sheet
      lists the character's passives with resolved text; a Player cannot self-grant.
- [ ] Deleting a passive a character holds is refused by the walker
      ([dependencies.ts](../../../src/shared/engine/dependencies.ts)) naming the holder.
- [ ] Unit tests cover: absent defaults, a templated and a plain effect, grant/revoke with Events,
      and the delete guard.
- [ ] Verified via the `verifier` subagent, the `fallow` skill, and the `coding-conventions`
      skill, plus a live browser check of a handout appearing on the sheet (ask the User first).

## Notes

- **Build no granting mechanism** beyond the DM handout — no race wiring, no item wiring, no
  effect *mechanics* (a resistance is text; damage math does not exist to hook into). That is
  D5's line, held on purpose.
- The measurements table (Naming AU:AX) stays recorded-not-built — it belongs to no ticket.
