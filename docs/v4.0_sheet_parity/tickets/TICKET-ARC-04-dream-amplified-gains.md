# TICKET-ARC-04 — Dream-amplified archetype gains

- **Area:** Archetypes configuration (point-buy)
- **Type:** Feature (engine)
- **Traceability:** System [05 · Archetypes and point-buy](../systems/05-archetypes-and-point-buy.md);
  system [02](../systems/02-progression-and-identity.md) (Dream level's role); overview
  [Rulings 2026-08-29](../overview.md#rulings-user-2026-08-29) (sub gains `+dreamLevel` even at
  zero points). **Needs TICKET-RES-04** (`dreamLevel`).

> **Scope (overview [D7](../overview.md#d7--seeded-values-and-formula-text-are-a-separate-issue-user-2026-08-29)):**
> the archetype renames, their taglines and the sub/non affinity tags are seeded values, so they
> are the data pass's. It owes this ticket
> [archetypes.json](../../imports/archetypes.json) re-sourced: Muscels "Strenght above all",
> thieving "now you see me", Science "magic and science is where you excel", Advisor "nature and
> advice is where your heart lays", Wall "Shielding the weak", Leader "Charisma is on point" (ids
> stable, TICKET-REF-01), each with its two `sub` tags — Muscels Con+Health, thieving Mana+Speed,
> Science Wis+Mana, Advisor Int+Mana, Wall Strenght+Health, Leader Dex+Mana — `non` staying sparse.
> The `point_buy` curve does **not** move: the online "new integer table" was display rounding
> (overview [D3](../overview.md#d3--formulas-are-captured-and-one-display-trap-is-on-record)).

## User story

As a Player, I want my archetype's stats to grow the way the new sheet computes them — main stats
multiplied by my Dream level, sub stats gaining it flat — so raising my dream moves my sheet the
way it moves the table's.

## Description

One engine change with two consequences. Dream level enters the gain: main =
`point_buy.main(p) × dreamLevel`, sub = `point_buy.sub(p) + dreamLevel`, non unchanged. Because
`main(0)` is `0.75` rather than `0`, "spending nothing gains nothing" stops being true for main
stats — a deliberate behaviour change this ticket owns — and the gain becomes fractional, which
composition carries through unrounded.

## Current situation (as-is)

- [pointBuy.ts](../../../src/shared/engine/calculators/pointBuy.ts) routes each stat's spent
  points through the curve column named by the archetype's affinity (TICKET-ARC-02) — the same
  per-stat routing the xlsx confirms. **No dream term.**
- ARC-02 pinned "spending nothing gains nothing" for **main** — a statement about the old formula,
  not about the curve, and the note this ticket supersedes.
- `Character.dreamLevel?` arrives with TICKET-RES-04, absent-means-1.
- [curves.json](../../imports/curves.json)'s `point_buy` is byte-identical to the sheet's table,
  anomalies (`4.64285714…`, `12.0665…`) included, and stays that way.

## Desired result (to-be)

- **The dream term in the gain**: main = `point_buy.main(p) × dreamLevel`, sub =
  `point_buy.sub(p) + dreamLevel` (flat, points or none), non unchanged. Where the dial lives —
  hard-wired shape vs two constants — is this ticket's design call; the sheet hard-wires it, and
  a dial nobody has asked for is an abstraction before its third caller.
- **Fractional gains flow through unrounded**, `main(0) = 0.75 × dreamLevel` included (systems/03);
  ARC-02's zero-spend note is superseded and the module header says so.
- **Nothing else in the calculator moves**: the per-stat routing, the fallback to `non` for a
  character with no archetype, and the curve itself are all untouched.

## Acceptance criteria

- [ ] A sub-affinity stat gains `+dreamLevel` at **zero** points, and raising Dream level moves a
      character's stats with nothing else written — both pinned by `pointBuy` tests against a
      fixture of the ticket's own (the ruling's "pin that in the fixtures").
- [ ] `main(0) = 0.75 × dreamLevel` is a real fractional gain that flows through composition
      unrounded — pinned; ARC-02's zero-spend-gains-nothing note is superseded and the module
      header says so.
- [ ] A character with no `dreamLevel` computes exactly as a dream level of 1 — the neutral default
      is RES-04's reader rule, and this calculator adds no second one.
- [ ] The `point_buy` curve rows and generator are untouched — asserted by an unchanged
      [curves.json](../../imports/curves.json) (`git diff` clean on the file) and passing curve
      tests.
- [ ] The no-archetype fallback still routes everything through `non` (ARC-02's pinned behaviour,
      now with a dream term to ignore) — unmodified test.
- [ ] Derived values still come from the engine, in one place; the server re-derives the same way.
- [ ] Verified via the `verifier` subagent, the `fallow` skill, and the `coding-conventions`
      skill, plus a live browser check: raise Dream level as DM, watch a sub stat move (ask the
      User first).

## Notes

- The renames the data pass brings change what a *character picker* shows mid-creation;
  `Character.archetypeId` does not move, so existing picks survive.
- The old curve anomalies stay the User's decision, unchanged since v2.0.
- The sample's residue — Science, dream 1, 3 points on Int → Int +3, Wis +1, Mana +1 — is the case
  to reproduce, and becomes a golden fixture once the data pass seeds the matrix it needs.
