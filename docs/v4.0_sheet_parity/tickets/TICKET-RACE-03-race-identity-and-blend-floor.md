# TICKET-RACE-03 — Race identity fields and the blend floor

- **Area:** Races configuration
- **Type:** Feature (shape + one engine term)
- **Traceability:** System [04 · Races](../systems/04-races.md) (gaps 1, 3, 4, 5); system
  [14 · Reference tables](../systems/14-passives-and-reference-tables.md) (sizes and types).

> **Scope (overview [D7](../overview.md#d7--seeded-values-and-formula-text-are-a-separate-issue-user-2026-08-29)):**
> the 25-race catalog is the data pass's. It owes this ticket
> [races.json](../../imports/races.json) re-sourced to `Background Referenes Race: scaling` (typo
> intact) — keep human/elf/Hamster/dwarf/Raccoon, drop the four bestiary rows, add the twenty new
> blocks, each with its type, size and challenge rate, plus the two reference lists this ticket's
> fields validate against.

## User story

As a User, I want a race to carry its creature type, size and challenge rate — and a blend that
never floors a stat to nothing — so the roster my table plays fits in the app before it is typed in.

## Description

Three shape changes and one engine term. `Race` gains the identity fields the old sheet never gave
it, the Configuration gains the two reference lists those fields are picked from, and
`calculateRaceStatBases` gains the sheet's `MAX(1, …)` floor. The count of races a character picks
is **TICKET-RACE-04**; which races exist is the data pass's.

## Current situation (as-is)

- [races.json](../../imports/races.json) holds ten races from the old sheet (TICKET-RACE-01/02).
  No type, size, or challenge-rate field exists on
  [`Race`](../../../src/shared/types/config.ts).
- `calculateRaceStatBases` in
  [statCalculator.ts](../../../src/shared/engine/calculators/statCalculator.ts) blends two blocks
  as `roundup((a + b) / race_blend_divisor)` — the xlsx's chain is the same arithmetic **except
  one new term: the `MAX(1, …)` floor**. A stat both races have at 0 reads 1 in the sheet, 0 in
  the app.
- The sheet's size and type vocabularies (Naming BD3:BE9, BG3:BH19) exist nowhere in the app.

## Desired result (to-be)

- **Identity fields**: optional `type?`, `size?`, `challengeRate?` on `Race`, additive-optional so
  a ruleset without them is unchanged.
- **Two reference lists on the `Configuration`** — sizes and creature types, optional and
  absent-means-none, holding free User strings (`humaniod` and `guargantian` are theirs to fix, not
  ours). A race's `type`/`size` validate against them as a **finding**, never a crash, and never a
  hard-coded const object; smallest shape wins (systems/14).
- **The blend floor**: `MAX(1, …)` added to `calculateRaceStatBases` beside the existing divisor —
  only all-zero pairings move, from 0 to 1.

## Acceptance criteria

- [ ] The floor is pinned: an all-zero pairing reads 1, a non-zero blend is bit-for-bit what it was
      before — `statCalculator` tests on both sides, against fixtures of the ticket's own.
- [ ] A race's type/size validate against the Configuration's reference lists (validation finding,
      not a crash, when they don't); a ruleset with no lists validates nothing and stays valid.
- [ ] `challengeRate` is stored and **built on nothing** — no engine, no display logic beyond the
      config panel; a grep proves the field has exactly one reader.
- [ ] The config panel edits all three fields and both reference lists, composing
      `components/ui` primitives through `ConfigPanelShell`; persistence through the store action.
- [ ] Derived values still come from the engine; the blend has exactly one home.
- [ ] Additive-optional throughout — a v3-shape ruleset round-trips import/export unchanged, so no
      version bump of its own.
- [ ] Unit tests cover: the floor, an unchanged non-zero blend, reference-list validation both ways,
      and the fields' round-trip through import/export.
- [ ] Verified via the `verifier` subagent, the `fallow` skill, and the `coding-conventions`
      skill, plus a live browser check of the race panel (ask the User first).

## Notes

- **Challenge rate is 0 for every playable race** — a creature-facing field waiting for a bestiary.
  Store it because the sheet has it; build nothing on it (systems/04's open question).
- The race *count* and the `Empty` placeholder are **TICKET-RACE-04** — kept separate because that
  one touches character creation and the allocation path (the overview's "§4 is no longer a
  data-only line" warning), while this one is fields plus one engine term.
- The reference lists are the first two of their kind. If a third list wants the same treatment
  later, that is when a shared shape earns itself — not now (the third-caller rule).
