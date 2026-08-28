# TICKET-DX-09 — Sheet corpus v4 and the golden fixtures

- **Area:** Developer experience / sheet corpus
- **Type:** Feature (verification closeout)
- **Traceability:** System [01 · Sheet source and capture](../systems/01-sheet-source-and-capture.md);
  overview [D1](../overview.md#d1--the-new-workbook-replaces-the-old-one-as-the-source-of-truth) /
  [D6](../overview.md#d6--no-backwards-compatibility-v40-is-a-clean-break-user-2026-08-29).
  Closes the milestone the way TICKET-DX-04 closed v2.0. **Last — needs every other v4.0
  ticket.**

## User story

As a developer, I want the whole corpus re-sourced to the new workbook and a golden suite pinned
on the sample character, so any future change that breaks sheet parity fails a test that names
the cell it broke.

## Description

The closeout: every fragment touched by v4.0 confirmed re-sourced (new `exportedAt`, xlsx ranges,
typos intact), and a golden suite pinned on **Thomas the test more** — races Ducklets + Ducklets,
archetype Science, focus Arcane/Summening/Arcane, level 1, Dream level 1 — whose gear, stat and
roll arithmetic the capture verified end to end.

## Current situation (as-is)

- The golden pattern exists: [golden/fixtures.ts](../../../src/shared/engine/golden/fixtures.ts)
  and its [README](../../../src/shared/engine/golden/README.md) (TICKET-DX-04) pin v2.0's sheet
  arithmetic; [sheetImport.test.ts](../../../src/shared/services/sheetImport.test.ts) asserts the
  corpus regenerates and imports clean.
- Each v4.0 ticket re-sourced its own fragments as it landed; nothing yet proves the *set* is
  coherent, and no fixture pins the new arithmetic end to end.

## Desired result (to-be)

- **The corpus audit**: every fragment in [docs/imports/](../../imports/README.md) touched by
  v4.0 cites the new workbook (xlsx sheet names with their typos and truncations, ranges,
  `exportedAt` 2026-08-28 or later); fragments *not* brought forward still cite the old workbook
  by design — the README says which is which.
- **The golden suite on the sample character**, pinned from the capture: the race blend
  (8/9/8/8/12/14, H3, M210, S20), the composed-gear arithmetic (Iron Ore 10 Battleaxe with
  Diamond 4 → Str 18/Con 18/Char 8/Health 5/Mana 4000), final stats (Str 26 … Mana 4211), all
  four roll decompositions including the fractional Endurance 22.4 → `1D20 + 2`, ATP 1, the
  archetype residue (Int +3, Wis +1, Mana +1 — the sub `+dream` case), points 0/3, spell
  effects (cure wounds 5, Fireball 55/11) — with **duo-skill levels pinned from the corrected
  arithmetic**, not the captured values (systems/06's ruling: Athletics' secondary term is
  Strenght × 0.1), each divergence citing its note.
- **The break is complete**: the corpus regenerates and imports clean at the new shape
  (`sheetImport.test.ts`), `SUPPORTED_SCHEMA_VERSION` rose exactly **once** for the milestone,
  and the old-shape path meets `IncompatibleDataNotice` — asserted, not assumed.

## Acceptance criteria

- [ ] A corpus-wide test walks every fragment's `source` block: v4-touched fragments name the new
      workbook and a post-2026-08-28 `exportedAt`; any still on the old workbook is enumerated in
      [README.md](../../imports/README.md) as deliberately not brought forward.
- [ ] The golden suite reproduces every verified number above through the real engine against the
      regenerated corpus — one failing cell names the calculator and the sheet range it
      contradicts (DX-04's pattern).
- [ ] The duo-skill and Summening fixtures assert the **intent** values and cite the fragment
      notes recording the sheet's two bugs — the suite documents the divergence instead of
      hiding it.
- [ ] `yarn run sheet:import` regenerates byte-identically from the checked-in fragments
      (`git status` clean after a run), and the full import round-trips through
      `importExport.ts` validation.
- [ ] `SUPPORTED_SCHEMA_VERSION` moved exactly once across the milestone (git history check
      recorded in the ticket), and [TEST_STATUS.md](../../../TEST_STATUS.md) is updated with the
      new counts.
- [ ] Verified via the `verifier` subagent, the `fallow` skill, and the `coding-conventions`
      skill, plus a live browser pass over the sample character's sheet (ask the User first).

## Notes

- The two questions the sheet has never answered — the `point_buy` anomalies and the missing XP
  table — remain open and remain the User's; the suite pins the anomalies **as data** exactly as
  v2.0 did.
- If any earlier ticket left a capture caveat (the ladder's `.5` rounding, the tail
  reconciliation), this is the ticket that verifies the recorded answer still holds against the
  xlsx before pinning it.
