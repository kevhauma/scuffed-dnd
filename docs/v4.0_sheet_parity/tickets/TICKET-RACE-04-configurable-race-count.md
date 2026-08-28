# TICKET-RACE-04 — The race count is ruleset data

- **Area:** Races / character creation
- **Type:** Feature (reshape, clean break)
- **Traceability:** System [04 · Races](../systems/04-races.md) (gap 2); overview
  [Rulings — ticket review](../overview.md#rulings-user-2026-08-29--ticket-review) ("as many as the
  ruleset says", superseding "exactly two") and
  [D6](../overview.md#d6--no-backwards-compatibility-v40-is-a-clean-break-user-2026-08-29).
  **Needs TICKET-RACE-03** (the identity fields it picks alongside).

> **Scope (overview [D7](../overview.md#d7--seeded-values-and-formula-text-are-a-separate-issue-user-2026-08-29)):**
> the seeded value of the dial, and the deletion of the `Empty` placeholder row from
> [races.json](../../imports/races.json), are the data pass's. It owes this ticket: `race_count` 2
> in [constants.json](../../imports/constants.json), and `Empty` gone with a note naming its
> replacement ("pick the race twice").

## User story

As a User, I want to say how many parent races a character in my ruleset has — the sheet's two, or
one, or four — so ancestry works the way *my* table plays it, with a pure-blood being the same race
picked twice.

## Description

The sheet's Setup form has exactly two race slots and "pure Ducklets" is Ducklets twice. Two is the
sheet's answer, so it is the default — but it stops being the app's rule. `MAX_RACE_COUNT` moves out
of the engine and into the ruleset, a character carries **exactly** that many races (duplicates
legal), and `Empty` — the old sheet's no-race placeholder — stops having a job, because a duplicate
pick expresses a pure-blood without halving anything.

## Current situation (as-is)

- `MAX_RACE_COUNT = 2` is a module constant in
  [statCalculator.ts](../../../src/shared/engine/calculators/statCalculator.ts), read by
  [characterCreation.ts](../../../src/shared/services/characterCreation.ts) (validation),
  [characterStore.ts](../../../src/client/stores/characterStore.ts) (an `at most` guard) and
  [useCharacterCreation.ts](../../../src/client/components/play/creation/useCharacterCreation.ts)
  (`canAddRace`, the wizard's message). All four spell the rule *at most 2*, and the wizard accepts
  a single pick.
- `calculateRaceStatBases` blends `races.slice(0, MAX_RACE_COUNT)` as
  `roundup(Σ / race_blend_divisor)` — `race_blend_divisor` is already a **`Constant`**, i.e. already
  the User's dial. The count is the odd one out.
- Constants are the established home for a per-ruleset number the engine reads:
  `points_per_level`, `bonus_divider`, `race_blend_divisor`, `apt_value` (TICKET-CST-01).
- `Empty` in [races.json](../../imports/races.json) is how a single race is expressed today without
  halving the block.

## Desired result (to-be)

- **The count is a per-ruleset dial** — `const.race_count`, defaulting to **2** when absent
  (the reader's rule, no stored backfill), replacing `MAX_RACE_COUNT` at all four call sites. A
  Configuration field instead of a `Constant` row is a legitimate alternative if the ticket finds
  one; whichever it picks, **the number lives in exactly one place** and the engine holds no copy.
- **`Character.raceIds` is exactly the ruleset's count** — not "at most". The creation rules refuse
  a short pick naming the count, the same id repeated is legal, and the blend returns an unblended
  block for an all-same pick (`MAX(1, ROUNDUP(Σ/divisor))` does this intact once the divisor agrees
  with the count).
- **The divisor and the count are reconciled**: `race_blend_divisor` is 2 because the count is 2.
  The ticket decides whether the divisor **defaults to** `race_count` or stays an independent dial,
  and records the answer here — an independent divisor is what makes a 3-race ruleset able to
  average, weight, or sum, so the smaller change is not automatically the right one.

## Acceptance criteria

- [ ] Creating a character with fewer or more race ids than the ruleset's count is refused by the
      shared creation rules with the count named (server and local through the same Kernel rule);
      the same id repeated is legal and reproduces the unblended block — both pinned by
      `characterCreation` tests.
- [ ] A ruleset with `race_count` 1, 2 and 4 each creates, blends and renders — pinned across all
      three; a ruleset with no `race_count` behaves exactly as a `race_count` of 2.
- [ ] `MAX_RACE_COUNT` exists nowhere: a grep is empty, and every former call site reads the
      ruleset — asserted, because four copies of a rule is how the old one drifted.
- [ ] The wizard renders exactly the ruleset's number of pickers and cannot advance until each is
      filled; picking the same race in every slot works and previews the intact block — component
      test.
- [ ] The divisor decision is implemented and pinned: whichever way it goes, a 3-race ruleset's
      blend is a test with a stated expected value, not an accident.
- [ ] No conversion code exists for the old shape (D6) — the milestone's
      `SUPPORTED_SCHEMA_VERSION` bump covers it; if this ticket lands the bump, say so.
- [ ] Persistence through store actions; the server re-derives the count from the same ruleset and
      trusts no client claim about it.
- [ ] Unit tests cover: refuse-short, refuse-long, allow-duplicate, the blend on a duplicate pair,
      the absent-means-2 default, and the incompatible-data path for a stored character whose
      count no longer matches.
- [ ] Verified via the `verifier` subagent, the `fallow` skill, and the `coding-conventions`
      skill, plus a live browser check of the wizard at two different counts (ask the User first).

## Notes

- The overview flagged this line as "no longer data-only" — the reshape's blast radius is character
  creation and the allocation path, which is why it is split from RACE-03.
- The wizard may caption the slots as the sheet does (Mothers race / Fathers race) at a count of
  two; at any other count it numbers them. Captions are the ruleset's business only if the User
  asks for it later — build the smallest honest thing.
- `Empty`'s job disappears rather than being deleted by this ticket: with duplicates legal, nothing
  needs a placeholder. The row itself leaves the corpus in the data pass.
