# TICKET-ARC-02 — Curve-routed stat gains

- **Area:** Archetypes configuration (point-buy)
- **Type:** Feature (replaces 1:1 allocation)
- **Traceability:** Concept [03 · Archetype](../../excel%20export%20summary/concepts/03-archetype.md) (exchange rates); Concept [06 · Curve](../../excel%20export%20summary/concepts/06-curve.md) (`point_buy`)

## User story

As a Player, I want points spent on my archetype's main stats to buy more than points spent
off-type — 15 points buying 12 main / 7 sub / 5 non — so specialisation shapes growth the way the
sheet's Funny archetype produces Char 39.

## Description

The spec's archetype "changes the exchange rate between points spent and stats gained". This
ticket replaces STAT-01's provisional 1:1 invested term with the curve-routed gain, using
ARC-01's affinities and CRV-03's `point_buy` seed.

## Current situation (as-is)

- STAT-01's composition adds `investedStatPoints` 1:1, archetype-blind — the spread the sheet
  confirms (2.4× at 15 points) has no representation.
- RES-02's validator reports points spent/available but knows nothing of gains.

## Desired result (to-be)

- **Gain = `curve.point_buy(pointsSpentOnStat, affinityColumn)`** replaces the 1:1 invested term
  in the composition; `investedStatPoints` explicitly means *points spent* (the curve maps points
  → levels gained).
- The allocation validator additionally reports **per-stat gains**, so wizard and sheet render
  "7 points in Char → +9" from the engine, mapping nothing themselves.
- A character without an archetype (mid-creation) routes every stat through the `non` column —
  defined, tested behaviour rather than an accident.

## Acceptance criteria

- [x] The confirmed rates reproduce: 15 points → 5 / 7 / 12 by affinity column against the seed curve (engine test; DX-04 re-pins). (`src/engine/calculators/pointBuy.test.ts` → *Concept 03's confirmed rates*: the `it.each` over non/sub/main at 15 points, plus `should read the whole main column off its generator` — `0.75 × (points + 1)` at five keys — and `should give a main-type stat more than a sub-type, and sub more than non`.)
- [x] Composition test through `calculateCharacter`: gains replace raw points; race base and equipment terms unchanged. (`src/engine/calculator.test.ts` → *curve-routed stat gains (TICKET-ARC-02)*: `should replace the raw points with what the affinity's column buys` — the same 15 points reading 12 / 7 / 5 across three stats — and `should leave the race base and equipment terms untouched`, which asserts `base + gain` against the fixture's elf block.)
- [x] Validator's per-stat gains match the curve for mixed allocations (test with a spread of affinities). (`src/engine/skillAllocation.test.ts` → *per-stat gains*: `should report what each stat's spend bought, through its own column` covers all three affinities at one key; `should handle a mixed allocation, pricing each stat at its own key` covers three different keys. Also pinned: every investable stat gets a row including the untouched ones, a derived stat gets none, and the stat is named so a caller needs no second lookup.)
- [x] The no-archetype fallback is pinned by a test. (Three levels. Engine: `pointBuy.test.ts` → `should route every stat through non when the character has no archetype`. Composition: `calculator.test.ts` → `should route every stat through non for a character with no archetype` **and** `should route every stat through non when the archetype was deleted`. Validator: `skillAllocation.test.ts` → `should route every stat through non for a character with no archetype`.)
- [x] Verified via the `verifier` subagent, the `fallow` skill, and the `coding-conventions` skill. (See the Verification section below, and the *Conventions review* section — it found this ticket was not the pure-engine change it claimed to be.)
- [ ] **Added during the ticket** — Verified live in the browser: a main-type stat's breakdown reads `invested 15 → +12` and adds up to its total. (**Left open — the User declined the live check for this run and the remaining v2 tickets**, asked and answered 2026-08-16. The ticket's own note called this pure engine; the `conventions-reviewer` showed otherwise, so the criterion exists rather than being absent — see review finding 1.)

## Implementation notes

1. **Three rules the table does not state, and would be wrong to have to.** They live in
   [`pointBuy.ts`](../../../src/engine/calculators/pointBuy.ts)'s header, and each is a real
   decision rather than defensive coding:
   - **Spending nothing gains nothing.** The seed's `main` column is the generator
     `0.75 * (key + 1)`, which reads **0.75 at zero points**. That is a curve fitted over the range
     a Player actually spends in, not a claim that an untouched stat drifts upward — so zero is
     answered in code rather than looked up. Without this, every main-type stat on every character
     would start 0.75 above where it should.
   - **No `point_buy` curve means 1:1.** Every ruleset written before this ticket is that ruleset,
     and they keep working. A ruleset that defines archetypes *without* the curve is ARC-01's
     validation error, so the quiet fallback only covers the case where nothing is being routed.
   - **A failed lookup is an error value, not a number.** The seed's `outOfRange` is `error` and its
     last row is 15 points, so a character past the table is entirely reachable — and answering with
     a confident 1:1 would hand them **more** than the main column ever grants (20 points → 20,
     against a main-column ceiling of 12). The stat chips instead.
2. **`investedValue` now returns a `FormulaResult`**, which is what makes rule 3 expressible. A
   spend the table cannot price becomes the stat's value directly — clamping and rounding an error
   would be answering a question that has no answer — and the composition attaches the stat as the
   error's `source`, so the sheet's chip says *which stat* rather than only which curve.
3. **`investedStatPoints` now means points *spent*, not levels gained.** The curve is the exchange
   rate between the two. Nothing about the stored shape changed, so there is no schema bump; what
   changed is what the number means, which is recorded on the type and in the `data-model` skill.
4. **The archetype and the curve are resolved in `calculator.ts`, not inside the composition.**
   `calculateStatValues` takes them as options like it takes races and equipment, which keeps the
   composed entry point the one place that reads a whole `Configuration` and leaves the calculator
   unit-testable without one.
5. **Skills stay 1:1**, per the ticket's own note. Whether skill investment also routes through
   affinity is a spec open question; nothing here touches `skillCalculator`.

## Conventions review — findings and what was done

The `conventions-reviewer` ran on the diff before it was committed and found fourteen things. All
fourteen are fixed in the same commit. **The first three invalidate this ticket's own framing**: it
was written as a pure engine change, and it was not.

1. **The sheet's stat breakdown stopped adding up.** `StatBreakdown.invested` still carried the raw
   points and `StatsSection` rendered them as a *contribution* of a total that now holds the gain —
   so on a seeded ruleset, 15 points in a main-type stat read `invested +15` against a total of 14.
   Requirement 13.4's contract is that the labelled terms are terms of the total. `StatBreakdown`
   gained `gain`, and the row now reads `invested 15 → +12`, which carries the exchange rate the
   Player is actually deciding against. **The suite could not see this**: no fixture carried a
   `point_buy` curve, so every one took the 1:1 fallback while `createFreshConfiguration` seeds the
   curve — meaning every real ruleset hit it and no test did. Three cases with a curve now exist.
2. **The wizard hand-rolled the same sum.** `SkillAllocationStep` rendered `allocated + racial`,
   correct only while the term was 1:1. It now reads `gains` off the validator — the field this
   ticket added for exactly that — and shows `→ +12` beside the box.
3. **A spend the table cannot price was accepted and persisted.** `isValid` ignored `gains`, so on a
   fresh ruleset a level-6 character could put 16 points into one stat, have it saved, and watch the
   stat become an error chip with nothing having refused. New `unpriceable-gain` violation reason;
   the points still count towards the spend, because they *were* spent.
4. `pointBuy` added to `calculator.ts`'s `export *` list so ARC-03 does not deep-import the one
   calculator the barrel omitted.
5. **Three traceability comments had become false** — `skillCalculator.ts` twice and
   `character.ts` once, all promising that ARC-02 would route the *skill* invested term through the
   curve. It deliberately did not (note 5). Re-pointed at the open spec question.
6. Implementation note 3 claimed the points-spent meaning was "recorded on the type"; it was only in
   the `data-model` skill. Now on `Character.investedStatPoints` too.
7. `statCalculator.ts`'s header still described the invested term as `+ invested points`. Corrected,
   and Concept 03 added to its `**Validates:**` line — the composition implements it now.
8. `useCharacterSheet.ts`'s "an invested one cannot fail" is no longer true; an invested stat's
   `max` can carry the point-buy error.
9. `pointBuy.test.ts` claimed its fixture was "the shipped numbers rather than a copy". It is a
   copy of `POINT_BUY_HAND_ROWS`; the claim is replaced with the honest version and a pointer at
   DX-04, which is what closes the drift.
10. Rule 2's wording implied `validateConfiguration` prevented the 1:1 repricing. It only reports —
    reworded.
11. `TEST_STATUS.md`'s per-file split was wrong (24/8/11 for a +40 total). Corrected to 24/7/9.
12. Requirement 16.6 dropped from `pointBuy.ts` — it is about undefined *skill codes*, which this
    module does not resolve. Concept 00 §7 was already the right citation and is kept.
13. Property tests added (`fast-check`), which the conventions prefer for a calculator: a
    non-positive spend gains nothing, `main ≥ sub ≥ non` at **every** key rather than one, and
    identity under a missing curve.
14. A negative allocation produced an out-of-range error row *beside* its `negative-points`
    violation, which would have put a chip where that message belongs. `statGain` now answers a
    non-positive spend with 0 — the same rule as zero, since a negative is separately refused.

## Sheet data

Nothing to land: no persisted entity or field changed. The archetype shape and the `point_buy`
table were already imported by [`archetypes.json`](../../imports/archetypes.json) (ARC-01) and
[`curves.json`](../../imports/curves.json) (CRV-03) respectively — this ticket only makes the app
*read* them together. `investedStatPoints` keeps its shape; what changed is what the number means,
recorded on the type and in the `data-model` skill rather than in a fragment.

## Verification

- `npx vitest run` — see the run recorded in [TEST_STATUS.md](../../../TEST_STATUS.md).
- `npx tsc --noEmit` — the documented 2-error baseline, unchanged.
- `yarn run check` — clean.
- `fallow audit` — no dead code, no new duplication, no new complexity attributed to this diff.

## Notes

- Pure engine ticket — UI reads the validator's new fields when ARC-03 lands the wizard step.
- Whether *skill* investment also routes through affinity is a spec open question — skills stay
  1:1 (SKL-02's note); don't build it silently.
