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
>
> **Seeding `race_count` is the User-facing half of this ticket, not a nicety** (recorded closing
> it, after review). Until the constant is in the corpus *and* in `createSeedConstants`, a User who
> wants three races has to know the string `race_count` and hand-create a constant from the
> constants panel — the shape works, but nothing in the app tells them the dial exists. Seed it
> **beside `race_blend_divisor`**, which is its sibling in every sense (same panel, same blend, and
> the divisor now *defaults to* this number), sourced from **`Setup` A7:B9** — the Mothers and
> Fathers rows, which are the whole of why the default is 2. The reviewer asked for that seeding
> here; it was declined as squarely D7's, which puts the fragment rows, the seeded ruleset's values
> and the formula text those seeds carry in the data pass.

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

### Decisions taken while building (2026-08-29)

1. **A `Constant`, not a `Configuration` field.** Constants are the established home for a
   per-ruleset number the engine reads by name (`points_per_level`, `bonus_divider`,
   `race_blend_divisor`, `apt_value`), the User already tunes the blend's *other* half from the
   constants panel, and a top-level field would be a persisted-shape change for a number that has an
   editor already. The reader owns the default, so nothing is backfilled and a ruleset written
   before this ticket round-trips unchanged.
2. **The divisor defaults to `race_count` and stays an independent dial.** The seeded `2` it fell
   back to was the count wearing another name — the sheet divides by two because it blends two — so
   a ruleset that raised the count to three used to get every base inflated by half for no reason it
   could see. Defaulting to the count keeps *picking the same race in every slot changes nothing*
   true at any count, which is what a pure-blood is; a ruleset that wants its three parents summed
   still writes `race_blend_divisor` 1 and gets it. Nothing about a count of 2 moves.
3. **`racesRequired` has one stated exception: a ruleset that offers no races requires none.**
   `createFreshConfiguration` starts a ruleset with an empty race list, so a rule demanding two picks
   from it would make a brand new ruleset unplayable — v1.0 Req 11.2's raceless character, which is
   where it now lives. A ruleset with *one* race is not an exception: you pick it twice.
4. **`raceIds` left `CharacterPatch`** (`characterStore.updateCharacter`). A patch carries no
   ruleset, so the action could either grow a `Configuration` parameter that one of its three fields
   would read, or stop accepting the field. Nothing has ever patched it — the wizard writes races
   once, through `createCharacter` — so it stops accepting it, and a future *re-pick your ancestry*
   feature arrives as its own action taking the ruleset.
5. **The slot pickers are numbered, not captioned.** The sheet's *Mothers race* / *Fathers race*
   reads well at exactly two and at no other count, and the Notes below make captions the ruleset's
   business only when a User asks. Smallest honest thing: `Race 1`, `Race 2`, …
6. **RACE-03's divergence 2 is deliberately not taken here.** The blend still reaches only the stats
   the blocks mention. Defining it over the ruleset's *stat list* would mean handing
   `calculateRaceStatBases` that list — a signature change at four call sites — and would give every
   stat neither parent names a silent base of 1, which moves every character's numbers rather than
   one rounding term. That is a reshape of what a blend *is*, and it belongs to its own ticket
   rather than to the count ticket.

## Acceptance criteria

- [x] Creating a character with fewer or more race ids than the ruleset's count is refused by the
      shared creation rules with the count named (server and local through the same Kernel rule);
      the same id repeated is legal and reproduces the unblended block — both pinned by
      `characterCreation` tests. (`characterCreationErrors` in
      [characterCreation.ts](../../../src/shared/services/characterCreation.ts) refuses
      `data.raceIds.length !== racesRequired(config)` with *"A character in this ruleset is a blend
      of exactly N races."*; `characterCreation.test.ts` → *refuses more races than the ruleset asks
      for*, *refuses fewer races …*, *accepts the same race in every slot*. The server reaches the
      same function through `routes/sessions/createCharacter.ts` —
      `characters.test.ts` → *should refuse fewer races than the Snapshot asks for, naming the
      count*. The unblended block: `statCalculator.test.ts` → *should keep a pure-blood intact at
      every count*, and the whole 66-case golden suite now builds its sample as
      `['ducklets', 'ducklets']` with **every expected number unchanged**.)
- [x] A ruleset with `race_count` 1, 2 and 4 each creates, blends and renders — pinned across all
      three; a ruleset with no `race_count` behaves exactly as a `race_count` of 2. (Creates:
      `characterCreation.test.ts` → *takes the count from the ruleset at 1 and at 4*;
      `characterStore.test.ts` → *should follow the ruleset's dial rather than the seeded 2*.
      Blends: `statCalculator.test.ts` → *should blend only as many as the count* (1 and 4) and
      *should keep a pure-blood intact at every count* (1, 3, 4). Renders:
      `CharacterCreationWizard.test.tsx` → `it.each([1, 3, 4])` *should render %i pickers…*, with
      the count-2 default covered by every other case in that file. Absent-means-2:
      `races.test.ts` → *reads an absent constant as the sheet's two*, `statCalculator.test.ts` →
      *should read no count at all as the sheet's two, exactly as before*, and
      `characterCreation.test.ts` → *reads an absent race_count as 2*.)
- [x] `MAX_RACE_COUNT` exists nowhere: a grep is empty, and every former call site reads the
      ruleset — asserted, because four copies of a rule is how the old one drifted.
      ([races.test.ts](../../../src/shared/engine/races.test.ts) → *the count lives in exactly one
      place*: each of the four former call sites is read from disk and asserted to contain no
      `MAX_RACE_COUNT`, to import `engine/races`, and to spell the constant's name nowhere — only
      `races.ts` may. `rg MAX_RACE_COUNT src` returns four lines and every one of them is *about*
      its absence: three in that test, and one in `races.ts`'s header explaining what the module
      replaced. No declaration, no import, no reader.)
- [x] The wizard renders exactly the ruleset's number of pickers and cannot advance until each is
      filled; picking the same race in every slot works and previews the intact block — component
      test. ([IdentityStep.tsx](../../../src/client/components/play/creation/IdentityStep.tsx) is a
      `Select` per slot instead of a checkbox list;
      `CharacterCreationWizard.test.tsx` → *should render one picker per slot and block until each
      is filled*, *should render %i pickers…* (1/3/4), and *should preview the intact block when the
      same race fills every slot* — elf twice shows `+2 racial`, not the `+1` a halved pick gives.)
- [x] The divisor decision is implemented and pinned: whichever way it goes, a 3-race ruleset's
      blend is a test with a stated expected value, not an accident. (**Decision 2 above** — the
      divisor defaults to `race_count` and stays a dial. `raceBlendDivisor` in
      [statCalculator.ts](../../../src/shared/engine/calculators/statCalculator.ts) takes the count
      as its fallback; `statCalculator.test.ts` → *should blend three blocks over three when the
      ruleset asks for three* pins `roundup((10 + 12 + 5) / 3) = 9`, and *should let an explicit
      divisor override the count* pins the same three at divisor 1 → 27.)
- [x] No conversion code exists for the old shape (D6) — the milestone's
      `SUPPORTED_SCHEMA_VERSION` bump covers it; if this ticket lands the bump, say so. (**This
      ticket does not land the bump**, and owes none: no persisted field moved, was removed, or
      changed type. `race_count` is a `Constant` row in a collection that already exists, and an
      absent one reads as the old behaviour exactly — so an old ruleset is read *correctly* rather
      than misread, which is the test the bump exists for. A stored character whose count no longer
      matches stays readable and only its *rewrite* is refused — see the last criterion's test.
      TICKET-DX-09 still lands the milestone's single bump. No adapter, no dual-read, no backfill
      was written.)
- [x] Persistence through store actions; the server re-derives the count from the same ruleset and
      trusts no client claim about it. (`characterStore.createCharacter` is still the only writer on
      the browser side and now asks `racesRequired(config)`; no component or engine module reads
      storage. Server side, `POST /api/sessions/:id/characters` calls the same
      `characterCreationErrors` against the **Snapshot** — `characters.test.ts` → *should refuse
      fewer races than the Snapshot asks for, naming the count* asserts the count is derived there,
      and `CharacterCreateRequest` carries no count field for a client to claim one with.)
- [x] Unit tests cover: refuse-short, refuse-long, allow-duplicate, the blend on a duplicate pair,
      the absent-means-2 default, and the incompatible-data path for a stored character whose
      count no longer matches. (All six in `characterCreation.test.ts` and `statCalculator.test.ts`.
      **The last one reads differently than the criterion assumed and the test says so**: there is no
      incompatible-data path to take. A character stored when *at most two* was the rule stays
      readable — the blend is defined for a lone block — so `IncompatibleDataNotice` is not involved
      and nothing is refused at read time. `characterCreation.test.ts` → *leaves a stored character
      whose count no longer matches readable, refusing only the write* pins both halves. **The
      review found the mirror case and it is now covered too**: a character stored with *more* picks
      than the ruleset asks for — which a User creates simply by lowering the dial — had the sheet
      naming three lineages while the blend used two. `resolveRaces` caps the list, so display and
      derivation read one list by construction; `races.test.ts` → *caps a character stored at a
      higher count than the ruleset now asks for* and *drops unresolvable picks before capping*.)
- [x] Verified via the `verifier` subagent, the `fallow` skill, and the `coding-conventions`
      skill, plus ~~a live browser check of the wizard at two different counts~~ (ask the User
      first). (Suite 3198 passing / 196 files / 0 failing / 0 skipped; `npx tsc --noEmit` at its
      documented 2-error baseline; `yarn run check` clean. `fallow audit --base main` → **pass**,
      0 introduced findings of any kind; `fallow dead-code` → 2 issues, both pre-existing and
      neither in this diff. `useCharacterCreation` grew to 16/22 cognitive and was brought back to
      main's 15/21 by extracting `raceSlotsFor`, so the ticket adds no complexity.
      **The browser check was skipped by User instruction for this run** — the strikethrough is that
      clause, not the rest of the criterion.)

## Notes

- The overview flagged this line as "no longer data-only" — the reshape's blast radius is character
  creation and the allocation path, which is why it is split from RACE-03.
- The wizard may caption the slots as the sheet does (Mothers race / Fathers race) at a count of
  two; at any other count it numbers them. Captions are the ruleset's business only if the User
  asks for it later — build the smallest honest thing.
- `Empty`'s job disappears rather than being deleted by this ticket: with duplicates legal, nothing
  needs a placeholder. The row itself leaves the corpus in the data pass.
- **What the data pass will notice first** (added closing this ticket): until `race_count` is seeded
  into [constants.json](../../imports/constants.json), a User who wants a count other than two has
  to add a constant *named* `race_count` by hand from the constants panel. That is exactly how
  `race_blend_divisor` has always worked — the seed is what makes it discoverable — so it is the
  Scope line's job rather than a gap here, but it is the one User-visible rough edge the shape pass
  leaves behind.

### Two consequences on record rather than fixed (added at review, 2026-08-29)

- **Turning the dial re-values existing characters.** A stored two-pick blend divided by 2; raise
  `race_count` to 3 and it divides by 3, because decision 2 made the divisor follow the count.
  Lowering it truncates instead — `resolveRaces` caps the picks, so a 3-pick character on a ruleset
  lowered to 2 both *names* and *blends* its first two, consistently but silently. This is the
  ruleset being the authority working as designed (`race_blend_divisor` and `bonus_divider` have
  always had it), but the count is the first dial that changes what a character **is** rather than
  what a number is worth. Recorded in `raceBlendDivisor`'s JSDoc where the next reader meets it. A
  warning on the constants panel would be its own ticket, and wants the same treatment for the other
  system constants rather than a special case for this one.
- **`race_count` is not part of "would this Snapshot break your character".**
  [snapshotConflicts.ts](../../../src/server/routes/sessions/snapshotConflicts.ts) decides whether a
  refresh is safe from `isReadableCharacter` plus `validateStatAllocation`, and neither knows
  anything about races — so pinning a Snapshot whose `race_count` differs re-values every seated
  character's racial bases with no conflict reported. Defensible, and not new in kind: the same has
  always been true of `race_blend_divisor`. It is new in *reach*, because the count also truncates
  picks rather than only re-weighting them, so it goes on record here rather than being discovered
  at a table. Widening the conflict check to the blend is a decision about what a "conflict" means,
  not a fix to slip into this ticket.
