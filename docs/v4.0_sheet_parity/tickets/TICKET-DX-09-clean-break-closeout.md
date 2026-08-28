# TICKET-DX-09 — The clean break, proven complete

- **Area:** Developer experience / milestone closeout
- **Type:** Feature (verification closeout)
- **Traceability:** System [01 · Sheet source and capture](../systems/01-sheet-source-and-capture.md);
  overview [D6](../overview.md#d6--no-backwards-compatibility-v40-is-a-clean-break-user-2026-08-29)
  / [D7](../overview.md#d7--seeded-values-and-formula-text-are-a-separate-issue-user-2026-08-29).
  **Last of the shape pass — needs every other v4.0 ticket.**

> **Scope (overview [D7](../overview.md#d7--seeded-values-and-formula-text-are-a-separate-issue-user-2026-08-29)):**
> the corpus audit and the golden suite move to the data pass, because the numbers they pin are the
> numbers that pass lands. What that pass owes this milestone, when it closes: every v4-touched
> fragment citing the new workbook with a post-2026-08-28 `exportedAt` and its ranges (typos and
> truncations intact); a README naming the fragments deliberately *not* brought forward; and a
> golden suite on **Thomas the test more** — races Ducklets + Ducklets, archetype Science, focus
> Arcane/Summening/Arcane, level 1, Dream level 1 — pinning the race blend, the composed-gear
> arithmetic, the final stats, all four roll decompositions including the fractional
> Endurance 22.4, the archetype residue, the points readout and the resolved spell effects, with
> **duo-skill levels pinned from the corrected arithmetic** and each divergence citing its note.

## User story

As a developer, I want the old shape to be genuinely gone — one version bump, one honest error
path, a green suite — so v4.0 closes as a milestone rather than trailing half-migrated data behind
it.

## Description

The shape pass's closeout. Every reshaping ticket in this milestone claimed the D6 break; this one
proves the claim as a whole: the version rose exactly once, an old-shape file meets
`IncompatibleDataNotice` with its backup offer rather than a shape error, no conversion code was
smuggled in, and the documentation the milestone invalidated has moved.

## Current situation (as-is)

- [sheetImport.test.ts](../../../src/shared/services/sheetImport.test.ts) asserts the corpus
  regenerates and imports clean — the test that will fail loudest if a reshape left the corpus
  behind, and the reason the data pass has a safety net waiting for it.
- `RETIRED_FIELDS` in [importExport.ts](../../../src/shared/services/importExport.ts) turns a
  retired key into a sentence naming its replacement; several v4.0 tickets add entries.
- The golden pattern exists — [golden/fixtures.ts](../../../src/shared/engine/golden/fixtures.ts)
  and its [README](../../../src/shared/engine/golden/README.md) (TICKET-DX-04) pin v2.0's sheet
  arithmetic. It stays green through this milestone or its divergences are recorded, whichever the
  reshapes actually did.

## Desired result (to-be)

- **One bump, provable**: `SUPPORTED_SCHEMA_VERSION` moved exactly once across the milestone, with
  the git history recorded here.
- **The old shape errors honestly**: a v3-shape ruleset and a v3-shape character each meet
  `IncompatibleDataNotice` with a backup offer, and every retired key produces its sentence — not a
  shape error, not a silent drop. Asserted, not assumed.
- **No conversion code exists** anywhere in the tree (D6): no dual-read, no key adapter, no
  "if old shape" branch — a review pass plus a grep, recorded.
- **The docs the milestone invalidated have moved**: [TEST_STATUS.md](../../../TEST_STATUS.md)'s
  counts, the `data-model` skill's stored shapes and sanctioned-exceptions list, and
  [CLAUDE.md](../../../CLAUDE.md) where a hard rule changed.

## Acceptance criteria

- [ ] `SUPPORTED_SCHEMA_VERSION` moved exactly once across the milestone — git history check
      recorded in the ticket.
- [ ] An old-shape ruleset and an old-shape character each meet `IncompatibleDataNotice` with the
      backup offer; every `RETIRED_FIELDS` entry added this milestone renders its sentence —
      one test per entry.
- [ ] No conversion path exists: a grep for old keys outside `RETIRED_FIELDS` and the fragments is
      empty, and the review says so explicitly.
- [ ] The existing golden suite (TICKET-DX-04) is green, or every divergence it now has is
      recorded with the ticket that caused it — a silently-updated golden is a bug.
- [ ] `yarn run sheet:import` regenerates byte-identically from the checked-in fragments
      (`git status` clean after a run), and the corpus still imports clean at the new shape.
- [ ] [TEST_STATUS.md](../../../TEST_STATUS.md), the `data-model` skill and CLAUDE.md name what
      this milestone changed — including that D7 suspended the sheet-data rule and when it returns.
- [ ] Verified via the `verifier` subagent, the `fallow` skill, and the `coding-conventions`
      skill, plus a live browser pass over a character built on the new shapes (ask the User
      first).

## Notes

- **The milestone closes twice**: here for the shapes, and again when the data pass lands the
  corpus and the goldens. Say so when closing this ticket — "v4.0 shape pass complete" is the
  honest sentence, not "v4.0 complete".
- The two questions the sheet has never answered — the `point_buy` anomalies and the missing XP
  table — remain open and remain the User's.
- If any earlier ticket left a capture caveat (the ladder's `.5` rounding, the tail
  reconciliation), this is where the recorded answer is checked against the xlsx one last time
  before the data pass pins anything on it.
