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

## Implementation notes (2026-08-29)

Three decisions this ticket made while building, recorded where the criteria can be read against
them:

1. **Dream arrives as a fourth parameter, not as the character.** `statGain(pointsSpent, affinity,
   curve, dreamLevel)`. The engine prices a spend; the three callers that have a `Character` in
   scope (`statCalculator.investedValue`, `skillAllocation.validateStatAllocation`,
   `useCharacterSheet.buildView`) read it with `dreamLevelOf` and pass the number. That is what
   makes criterion 3 structural rather than tested-by-hope: there is no second default to disagree
   with RES-04's reader, because the parameter is **required**.
2. **The shape is hard-wired and the parameter is not optional.** `main × dream`, `sub + dream`,
   `non` untouched, written once in `amplifyByDream`. No constants, no dial — the sheet hard-wires
   it and nobody has asked for a second shape (to-be's own reasoning).
3. **`StatAffinity` became a const object** (`STAT_AFFINITY`, `types/config.ts`), which is the house
   rule's convert-when-touched: the dream term *branches* on the tag, so the engine now spells two
   of those values in code rather than only forwarding them to a column lookup. The derived type is
   the same union, so no existing call site moved.

**One display consequence, found by the `conventions-reviewer` and fixed here.** The breakdown row
labelled its term `invested` when nothing was spent, which was true only while a zero spend bought
zero. It now reads `invested 0 → +0.75` on a main-tagged stat and `invested 0 → +1` on a sub-tagged
one, so the arrow follows the **gain** rather than the spend, and the bare `invested` is kept for the
case it was always about — nothing spent *and* nothing gained. The rule lives in
[investedContribution.ts](../../../src/client/components/play/sheet/investedContribution.ts), shared
by `StatsSection` and `ResourcesSection` so the two cannot drift; it was live on the shipped corpus
(`archetypes.json` is main-only today) and would have reached every sub-tagged stat once the data
pass lands the matrix.

**Two test-fixture consequences, both of them this ticket's behaviour change showing through**, are
recorded here because they read as unrelated edits in a diff:

- **`pointBuyFixtures` (the golden suite) now state a dream level per row** and their `expected`
  numbers are gains rather than table cells: `sub` at 15 points is 8 (the table's 7, plus dream 1)
  and `main` at 0 points is 0.75 rather than 0. The `point_buy` *curve* did not move — criterion 4
  — the formula reading it did.
- **The golden suite's sample character is now archetype-less.** It installs the sheet's whole
  confirmed stat line as a *race stat block* (the export never said how the line splits between race
  base and spend), so an archetype tag that used to contribute exactly zero now contributes
  `0.75 × dream` and every total drifted. The archetype's routing is still pinned, directly, beside
  it. Recorded as the fourth settlement in
  [the golden README](../../../src/shared/engine/golden/README.md), so a reader who re-adds the tag
  finds the reason rather than the failures.

Both fixture points obey the golden README's rule that **a re-derived number's citation moves with
it**: the rows whose value now contains the dream term cite `v4 systems/05`, and only the two that
are still nothing but a table cell keep Concept 06.

## Acceptance criteria

- [x] A sub-affinity stat gains `+dreamLevel` at **zero** points, and raising Dream level moves a
      character's stats with nothing else written — both pinned by `pointBuy` tests against a
      fixture of the ticket's own (the ruling's "pin that in the fixtures").
      (`src/shared/engine/calculators/pointBuy.test.ts` → *the dream term (TICKET-ARC-04)*: *should
      grant a sub-type stat +%i at zero points, on the dream level alone* over 1/2/5/12, and *should
      move a stat when the dream is raised and nothing else is written* — same spend, same curve,
      `after - before === 2`. Composed as well as priced:
      `src/shared/engine/calculator.test.ts` → *should move a character's stats when the dream is
      raised and nothing else changes* (STR 12 → 36, DEX 8 → 10, CON unmoved) and *should grant a
      sub-tagged stat the dream level with nothing spent in it*, plus
      `src/shared/engine/skillAllocation.test.ts`'s two new cases for the allocation readout.)
- [x] `main(0) = 0.75 × dreamLevel` is a real fractional gain that flows through composition
      unrounded — pinned; ARC-02's zero-spend-gains-nothing note is superseded and the module
      header says so.
      (`pointBuy.test.ts` → *should make main(0) a real fractional 0.75 x the dream level* asserts
      0.75, 3 at dream 4, and `Number.isInteger(...) === false`. Unrounded through composition:
      `calculator.test.ts` → *should carry a fractional main gain through the composition unrounded*
      reads `statValues.STR === 1.5` at dream 2 off a generated main column. The supersession is
      written into `pointBuy.ts`'s header rule 1 — ARC-02's exact wording quoted and overturned —
      and into `statCalculator.ts`'s `investedValue` docblock. The golden suite's *spending nothing
      gains nothing* fixture became *spending nothing on a main-type stat still buys the column's
      fractional 0.75*.)
- [x] A character with no `dreamLevel` computes exactly as a dream level of 1 — the neutral default
      is RES-04's reader rule, and this calculator adds no second one.
      (Structural: `statGain`'s fourth parameter is required and has no default, and all three
      production callers read `dreamLevelOf(character)`. Pinned twice: `pointBuy.test.ts` → *should
      compute a character with no dream level exactly as one at level 1* runs the untouched
      character's read against `DEFAULT_DREAM_LEVEL` at all three affinities, and
      `calculator.test.ts` → same name, comparing whole `statValues` maps and the stat total for an
      absent field versus an explicit `dreamLevel: 1`.)
- [x] The `point_buy` curve rows and generator are untouched — asserted by an unchanged
      [curves.json](../../imports/curves.json) (`git diff` clean on the file) and passing curve
      tests.
      (`git status --porcelain` at closeout lists eleven files under `src/`; nothing under
      `docs/imports/`. `curves.test.ts` and `golden.test.ts`'s *the main column is 0.75 × (points +
      1) on every row* both pass — the latter now walks **every** row including key 0, which it
      used to skip.)
- [x] The no-archetype fallback still routes everything through `non` (ARC-02's pinned behaviour,
      now with a dream term to ignore) — unmodified test.
      (`calculator.test.ts` → *should route every stat through non for a character with no
      archetype* and *…when the archetype was deleted* are unedited and green; `pointBuy.test.ts`'s
      `affinityFor` block is unedited. Reinforced by a new invariant, *should leave a non-type stat
      untouched by the dream level*, over 0–15 points × dream 1–20.)
- [x] Derived values still come from the engine, in one place; the server re-derives the same way.
      (The term lives only in `shared/engine/calculators/pointBuy.ts`; `grep` finds no other
      multiplication by a dream level. No file under `src/server/` changed — the server re-derives
      through `#shared/engine` (v3.0 D5), so `dm.test.ts`, `play.test.ts` and `rolls.test.ts` pass
      unedited. `yarn run arch` reports no boundary violation for the new
      `calculators/pointBuy.ts → engine/dreamLevel.ts` edge.)
- [x] Verified via the `verifier` subagent, the `fallow` skill, and the `coding-conventions`
      skill, ~~plus a live browser check: raise Dream level as DM, watch a sub stat move (ask the
      User first)~~.
      (`npx vitest run` **3108 passing / 194 files / 0 failing / 0 skipped** — +20 on RES-04's 3088
      baseline; `npx tsc --noEmit` at the documented 2-error baseline, unchanged; `yarn run lint`
      and `yarn run check` clean, dependency-cruiser 687 modules with no violation. `fallow audit
      --base main` verdict **pass** over 22 changed files, 0 introduced dead-code / complexity /
      duplication findings; `fallow dead-code` introduces nothing new; `fallow health --hotspots
      --since 6m` returns two touched files Accelerating — `useCharacterSheet.ts` 18.4 → 20.8 and
      `CharacterSheet.test.tsx` 7.5 → 8.9 — both recorded in TEST_STATUS.md's hotspot table. The
      `conventions-reviewer` pass raised five items: four fixed here (the `invested` label, four
      golden citations, the nested calls in the new tests, and the `STAT_AFFINITY` conversion
      reaching the call sites) and one recorded as a follow-up, above.
      **The browser half was not run** — browser check skipped by User instruction for this run,
      which is what the strikethrough records rather than an oversight. What it would have shown —
      raising Dream level as DM and watching a sub stat move — is covered by the composed
      assertions above, but not by a live sheet, so the box is ticked for the three checks that
      ran and struck through for the one that did not.)

## Follow-up this ticket opens and does not close

**A `point_buy` curve whose rows start above key 0 now breaks every untouched stat** — recorded by
the `conventions-reviewer` on this ticket, deliberately not fixed here.

The guard went from `pointsSpent <= 0` to `pointsSpent < 0`, which is what systems/05 asks for: zero
is a key like any other now. The consequence is that **zero reaches `lookupCurve`**. On a
User-authored curve whose first row is key 1 with `outOfRange: 'error'` — row deletion is a
supported store action, so this is reachable, not theoretical — every stat with nothing spent in it
returns an out-of-range error; `skillAllocation.ts` turns each into an `unpriceable-gain` violation;
the whole allocation reads invalid and `createCharacter` refuses. One deleted row, and no character
can be made.

**Nothing is broken today**: the seeded curve and the imported corpus both carry a key-0 row, which
is why no test catches it.

The natural home for the fix is [`engine/validator.ts`](../../../src/shared/engine/validator.ts),
beside the existing *every affinity in use needs a `point_buy` column* error — the same shape of
rule, one row lower: **a `point_buy` curve must cover key 0**. That is a config-level report against
the ruleset the User is editing, where it can be acted on, rather than a guard in the calculator
that would quietly re-introduce ARC-02's zeroing under another name.

## Notes

- The renames the data pass brings change what a *character picker* shows mid-creation;
  `Character.archetypeId` does not move, so existing picks survive.
- The old curve anomalies stay the User's decision, unchanged since v2.0.
- The sample's residue — Science, dream 1, 3 points on Int → Int +3, Wis +1, Mana +1 — is the case
  to reproduce, and becomes a golden fixture once the data pass seeds the matrix it needs.
