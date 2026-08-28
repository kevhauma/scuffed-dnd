# TICKET-INL-01 — Inlays: entity, panel, and the gem catalog

- **Area:** Inlays configuration (new area)
- **Type:** Feature (new entity)
- **Traceability:** System [10 · Inlays](../systems/10-inlays.md); overview plan §8. First ticket
  of the minted **`INL`** prefix.

## User story

As a User, I want a catalog of gem inlays — 25 families in ten tiers of stat grants — so my
players can socket a gem into what they craft.

## Description

A new entity the app has never had. An `Inlay` mirrors the `Material` family/tier shape over nine
stat axes (all six core stats plus Health, Mana, Speed — Mana is the axis inlays dominate). This
ticket is the entity, its config panel, and the fragment; the socket on the item and the engine
term are TICKET-INV-05's.

## Current situation (as-is)

- Nothing. No inlay entity, no socket on [`Item`](../../../src/shared/types/config.ts), no third
  bonus source on equipment.
- The pattern to mirror exists twice: `Material` family/tiers
  ([config.ts](../../../src/shared/types/config.ts), TICKET-MAT-01) and the `constants` optional-
  array precedent (absent means none).

## Desired result (to-be)

- **`Configuration.inlays?`** — optional array, absent-means-none: family + **ten stored tiers**
  of `{statId, modifier}` rows, grouped Common/Precious. All ten rows per family are data —
  linearity is a property the capture verified, not a generator to impose (Obsidian and Zircon
  prove why).
- **A config panel** composed through
  [ConfigPanelShell](../../../src/client/components/config/shared/ConfigPanelShell.tsx), like
  every other entity panel — list, edit, guarded delete.
- **`inlays.json`** — a new fragment: 25 families, with **Zircon's blank tier-10 row kept absent**
  (a gap, not a zero — importable and selectable up to 9, the User's to fill) and the
  double-Obsidian noted (a material family and a gem family share the name with different
  numbers; both kept).

## Acceptance criteria

- [ ] A ruleset with no `inlays` behaves exactly as today (absent-means-none through import,
      export, validation) — additive-optional, no version bump needed for this field.
- [ ] The panel lists, creates, edits and deletes inlay families with tier editing; deletion is
      guarded once anything references one (the walker edge itself lands in TICKET-INV-05 — here
      the panel wires the existing guarded-delete surface).
- [ ] Persistence through the store action; the panel composes `components/ui` primitives, no raw
      controls; theme tokens only.
- [ ] The fragment's Zircon family imports with nine tiers and no invented tenth — pinned by an
      import test; Obsidian's full hand-authored ladder round-trips.
- [ ] `inlays.json` created with `source.ranges` cited
      (`Background Reference inlay: scaling` A1:J253, both group-header rows), the Zircon gap and
      double-Obsidian in `notes`, and an `exportedAt`; `yarn run sheet:import` regenerated;
      [README.md](../../imports/README.md) gains the fragment's row.
- [ ] Unit tests cover: absent default, tier CRUD through the store, the Zircon gap surviving a
      round-trip, and validation of `{statId, modifier}` targets against real stats.
- [ ] Verified via the `verifier` subagent, the `fallow` skill, and the `coding-conventions`
      skill, plus a live browser check of the panel (ask the User first).

## Notes

- The shape deliberately tolerates families with missing tiers if `Material` already does —
  confirm in the ticket, per systems/10's recommendation, rather than assuming.
- Every gem family also exists as purchasable *items* in the shop catalog (TICKET-ITEM-02) —
  the crafting component and the catalog entry are two records sharing a name.
