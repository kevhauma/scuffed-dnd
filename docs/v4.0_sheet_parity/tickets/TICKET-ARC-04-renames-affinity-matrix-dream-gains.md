# TICKET-ARC-04 — Archetype refresh: renames, the proven matrix, dream-amplified gains

- **Area:** Archetypes configuration (point-buy)
- **Type:** Feature (data revision + engine)
- **Traceability:** System [05 · Archetypes and point-buy](../systems/05-archetypes-and-point-buy.md);
  system [02](../systems/02-progression-and-identity.md) (Dream level's role); overview
  [Rulings 2026-08-29](../overview.md#rulings-user-2026-08-29) (sub gains `+dreamLevel` even at
  zero points). **Needs TICKET-RES-04** (`dreamLevel`).

## User story

As a Player, I want my archetype's stats to grow the way the new sheet computes them — main stats
multiplied by my Dream level, sub stats gaining it flat — so raising my dream moves my sheet the
way it moves the table's.

## Description

Six renamed archetypes with new taglines, the sub/non affinity tagging v2.0 could not prove (now
read from formulas), and Dream level entering the gain formula. The `point_buy` curve turns out to
be **unchanged** — the online "new integer table" was display rounding (overview
[D3](../overview.md#d3--formulas-are-captured-and-one-display-trap-is-on-record)).

## Current situation (as-is)

- [archetypes.json](../../imports/archetypes.json) carries the old names (Strong, Sneaky, Smart,
  Wise, Tanky, Funny) with only `main` tagged — the sub/non split was deliberately not invented
  (TICKET-ARC-01). The validator still warns that the imported set "does not tag" sub stats.
- [pointBuy.ts](../../../src/shared/engine/calculators/pointBuy.ts) routes each stat's spent
  points through the curve column named by the archetype's affinity (TICKET-ARC-02) — the same
  per-stat routing the xlsx confirms. **No dream term.**
- [curves.json](../../imports/curves.json)'s `point_buy` is **byte-identical to the sheet's
  table**, anomalies (`4.64285714…`, `12.0665…`) included. No curve change.

## Desired result (to-be)

- **Six renames + taglines** (ids stable, TICKET-REF-01): Muscels "Strenght above all", thieving
  "now you see me", Science "magic and science is where you excel", Advisor "nature and advice is
  where your heart lays", Wall "Shielding the weak", Leader "Charisma is on point".
- **The full affinity matrix** in archetypes.json — two `sub` tags per archetype exactly as
  systems/05 tables it (Muscels: Con+Health; thieving: Mana+Speed; Science: Wis+Mana; Advisor:
  Int+Mana; Wall: Strenght+Health; Leader: Dex+Mana); `non` stays sparse (absent). The
  validator's "does not tag" warning retires for the imported set.
- **The dream term in the gain**: main = `point_buy.main(p) × dreamLevel`, sub =
  `point_buy.sub(p) + dreamLevel` (flat, points or none), non unchanged. Where the dial lives —
  hard-wired shape vs two constants — is this ticket's design call; the sheet hard-wires it.

## Acceptance criteria

- [ ] The sample character's residue reproduces: Science, dream 1, 3 points on Int → Int +3
      (`main(3) = 3 × 1`), Wis +1 and Mana +1 (`sub(0) = 0 + 1` each) — engine test through
      `calculateCharacter`, ready for plan §15's fixtures.
- [ ] A sub-affinity stat gains `+dreamLevel` at **zero** points, and raising Dream level moves a
      character's stats with nothing else written — both pinned by `pointBuy` tests (the ruling's
      "pin that in the fixtures").
- [ ] `main(0) = 0.75 × dreamLevel` is a real fractional gain that flows through composition
      unrounded (systems/03) — pinned; ARC-02's zero-spend-gains-nothing note is superseded and
      the module header says so.
- [ ] The `point_buy` curve rows and generator are untouched — asserted by an unchanged
      [curves.json](../../imports/curves.json) (`git diff` clean on the file) and passing
      curve tests.
- [ ] [archetypes.json](../../imports/archetypes.json) re-sourced to the new workbook
      (`Background Archetype calulation` / Naming ranges) with new `exportedAt` and the
      display-rounding trap noted; `yarn run sheet:import` regenerated.
- [ ] Unit tests cover: all six matrices route correctly, the no-archetype fallback still routes
      everything through `non` (ARC-02's pinned behaviour, now with a dream term to ignore).
- [ ] Verified via the `verifier` subagent, the `fallow` skill, and the `coding-conventions`
      skill, plus a live browser check: raise Dream level as DM, watch a sub stat move (ask the
      User first).

## Notes

- The renames change what a *character picker* shows mid-creation; `Character.archetypeId` does
  not move, so existing picks survive within the milestone's own data.
- ARC-02 pinned "spending nothing gains nothing" for **main** — under the sheet's formulas that
  becomes `0.75 × dreamLevel` at zero points on a *main* stat. That is a deliberate behaviour
  change this ticket owns; the golden fixtures (TICKET-DX-09) pin the new arithmetic, and the
  divergence note lives in the fragment.
- The old curve anomalies stay the User's decision, unchanged since v2.0.
