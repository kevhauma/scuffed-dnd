# TICKET-SKL-04 — Skill levels and bonuses round with ceil

- **Area:** Skills engine
- **Type:** Feature (engine rounding)
- **Traceability:** System [06 · Skills and focus](../systems/06-skills-and-focus.md) (gaps 1, 3);
  overview [Rulings 2026-08-29](../overview.md#rulings-user-2026-08-29) ("Fix them" — the two sheet
  formula bugs, which the data pass fixes in the weights).

> **Scope (overview [D7](../overview.md#d7--seeded-values-and-formula-text-are-a-separate-issue-user-2026-08-29)):**
> the skill list and its weights are seeded values, so they are the data pass's. It owes this
> ticket [skills.json](../../imports/skills.json) re-sourced: drop `sewing` and the duplicate
> `Skinning` (the creator resolved it — one `skinning` remains), add `Summening` and
> `woodcrafting`, apply the recapitalisations, and re-weight all 48 per systems/06 — mono = one row
> at **0.35**, duo = **0.2 + 0.1** — with the secondary weight on the *listed* secondary stat and
> Summening on its own Wis/Int row. Those two are the reference table's **intent**, not what the
> sheet's formulas compute; the ruling says build the intent, and the fragment's `notes` records
> the divergence so DX-09's fixtures pin corrected arithmetic.

## User story

As a Player, I want my skill levels and bonuses rounded the way the sheet rounds them, so a
half-point of stat scaling does not disappear off my sheet.

## Description

The sheet rounds both halves of a skill **up**: level = `ROUNDUP(Σ(weight × stat)) + invested`,
bonus = `ROUNDUP(level / 5)`. The app leaves the level fractional and rounds the bonus to nearest.
This ticket moves both to `ceil` — the whole engine change §5 needs, and the one that has to land
before the data pass re-weights anything, because every re-weighted number would otherwise be
pinned against the wrong rounding.

## Current situation (as-is)

- [skillCalculator.ts](../../../src/shared/engine/calculators/skillCalculator.ts): level =
  `Σ(weight × stat) + invested` with **no rounding** (fractional), bonus =
  `round(level / const.bonus_divider)`. The sheet says `ROUNDUP` for both; the divisor is 5 in both
  workbooks and does not move.
- `Skill.statWeights: [{statId, weight}]` (TICKET-SKL-02) already expresses whatever weights the
  data pass brings — mono, duo, or anything else. No shape change is needed for the re-weight.
- Formulas reach a skill as `skills.<name-slug>`, first-one-wins on shared spellings
  (TICKET-SKL-02's rule); renames are safe (TICKET-REF-01).

## Desired result (to-be)

- **Ceil, twice**: level = `ceil(Σ(weight × stat)) + invested` — invested points added *after* the
  ceil, so a bought point stays a whole point — and bonus = `ceil(level / bonus_divider)`.
- **The focus multiplier's future seat is left open**: TICKET-SKL-05 slots its multiplier *inside*
  the ceil, so write the expression with that shape in mind rather than requiring a rewrite.
- **Engine rule or ruleset data**: decide in the ticket whether the rounding mode is a fixed engine
  rule or a per-ruleset dial, and record which — remembering that an imported ruleset plays
  whatever the engine does, so a dial nobody sets is an abstraction with one caller.

## Implementation notes (2026-08-29)

**The rounding mode is a fixed engine rule, not a per-ruleset dial** — the decision the third to-be
item asked for. Three reasons, recorded here because the ticket left it genuinely open:

- **A rounding direction is not a balance knob.** `bonus_divider` is data because a User really does
  retune "how much level buys a bonus"; nobody asks for *half* a rounding, and the sheet has exactly
  one answer in both places.
- **An imported ruleset plays whatever the engine does either way**, and under
  [D6](../overview.md#d6--no-backwards-compatibility-v40-is-a-clean-break-user-2026-08-29) nothing is
  preserving an old ruleset's old answer — v4.0 is a clean break.
- **A dial nobody sets is an abstraction with one caller**, which is the house rule the to-be quoted.

**Two things the build found that the ticket did not predict**, both recorded because they change
what the next ticket inherits:

- **`ceil` had to be `roundAwayFromZero`, and it had to settle binary noise first.** Rounding *up*
  has no tolerance for floating-point error the way half-away-from-zero did: at the sheet's own duo
  weights, `12 × 0.2 + 6 × 0.1` is `3.0000000000000004` as a double, and rounding that up answers 4
  where the workbook answers 3 (Excel settles arithmetic to 15 significant digits before rounding).
  There are 142 such stat pairs in a 0–100 × 0–100 grid, so this is a Tuesday rather than an edge.

  **The settle lives in `roundAwayFromZero` itself, not in this calculator** — moved there in the
  review pass, and the review's reasoning is worth keeping: a settle in `skillCalculator` alone left
  `FORMULA_FUNCTIONS.roundup` unsettled, so a User formula spelling `roundup(stats.a * 0.2 +
  stats.b * 0.1)` answered **4** on the arithmetic the calculator answered **3** on — falsifying the
  very invariant the shared export exists for. One function, three callers (the formula library, the
  race blend, this), no divergence possible. `evaluator.test.ts` pins the User-formula half.
  **15 significant digits, not 12**: the authority quoted is Excel's, so the number is Excel's; a
  sweep of every 3-decimal weight × integer stat to 500 agrees with the exact decimal ceiling at 12,
  13, 14 and 15 alike, so nothing is bought by being tighter than the rule being imitated.
  `rounddown`/`floor`/`ceil` have the mirror hazard and are **deliberately left literal**, recorded
  in that function's JSDoc: no system arithmetic calls them, so changing them would move only
  User-authored results — a decision of its own rather than a consequence of a skills ticket.
- **The display edge was already ceiling the level, and that helper is now deleted.**
  `SkillsSection.ceilLevel` rounded the level up for display while the engine kept the fraction, with
  a comment saying *"moving the ceiling into the engine is a rules change, not a formatting one"*.
  This is that rules change, so the section rounds nothing — and a Player's *bonus* moves as a
  result, because it now derives from the rounded level (`ceil(6/5) = 2` where `round(6/5)` was 1).

**No `SUPPORTED_SCHEMA_VERSION` bump, and none owed.** Nothing persisted moved: this ticket changes
only how two derived numbers are computed at read time, and both were always derived. D6's single
milestone-wide bump still belongs to TICKET-DX-09.

## Acceptance criteria

- [x] Level and bonus both round with `ceil`; `bonus_divider` = 5 unchanged; fractional inputs
      pinned on both sides of a boundary and exactly on it.
      (`skillCalculator.ts` — `settledRoundUp` at the level and at the bonus, `bonusDivider`
      untouched at a seeded 5. `skillCalculator.test.ts` › *rounding up, twice (TICKET-SKL-04)* pins
      both boundaries with `it.each`: a weighted 4.1/4.0/3.9 → level 5/4/4, and a bonus at
      2.2/2.0/1.8 → 3/2/2. Plus *rounds a negative level away from zero, not toward it* — `Math.ceil`
      would answer -1 and -2 where the sheet answers -2 and -3 — and *settles binary noise before
      rounding up*, the `3.0000000000000004` case.)
- [x] Invested points are added after the level's ceil — pinned by a case where the order changes
      the answer. (`levelOf` sums the weight rows into `weighted`, rounds, *then* adds `invested`.
      `skillCalculator.test.ts` › *adds invested points after the ceil, which is not the same answer
      as before it*: `ceil(0.5) + 0.5 = 1.5`, where `ceil(0.5 + 0.5)` would be 1.)
- [x] Every existing skill test that assumed fractional levels or nearest-rounding bonuses is
      updated to the new rule with its expected value restated, not deleted. (32 assertions across
      three files, every one restated in place with the sum it now rounds up from written beside it:
      `skillCalculator.test.ts` — Concept 02's whole verified table plus the divider and
      weight-row blocks; `shared/engine/golden/fixtures.ts` — all 8 `skillFixtures` and all 6
      `bonusDividerFixtures`; `CharacterSheet.test.tsx` — the two rows that read a bonus off the
      grid. No test was deleted and no fixture value was invented.
      **The golden README's rule has two halves and the first pass honoured only one.** The rows were
      re-derived rather than re-fitted — but all 14 kept their Concept 02 citations, and Concept 02
      § *Derivation ✅* states `39 × 0.3 = 11.7 | 11.7 ✅ | round(2.34) = 2 ✅`, the opposite of what
      the row now asserts; one still cited *"Rounding is half-up ✅"* on a value produced by rounding
      up. `describeCitation` renders these into the failure message, so the reader would have been
      sent to a page contradicting the number. Fixed in the review pass on TICKET-ARC-04's precedent:
      a `V4_SKILL_ROUNDING` const — `v4 systems/06 · Skills § The level and bonus formulas, read from
      the cells (Background Charater Sheet Calcu rows 3–50)` — cited by all 14 rows, with Concept 02
      keeping what it is still right about (the weights, the stat line, and the editing scenario) in
      each row's comment and each block's JSDoc. Persuasion's `Skills!D31:G31` moved into its name,
      because that range names where its *weights* come from.)
- [x] Derived values come from `skillCalculator` only; no second summation and no caller rounding
      before or after — a grep at the call sites stays empty. (`SkillsSection.ceilLevel` **deleted**
      — it was the one caller that rounded. `grep -rn "Math\.(round|ceil|floor|trunc)|toFixed"
      src/client` now returns nothing on any skill path: what remains is `cardStain`, `equipmentGrid`,
      the currency calculator and the two generic 2-dp display formatters. Every reader —
      `useCharacterSheet`, `FormulaPreview`, `rollCalculator`, `ReviewStep` — takes `levels`/`bonuses`
      as given.)
- [x] The rounding-mode decision is recorded in this ticket, and if it landed as ruleset data, the
      absent default reproduces the sheet. (**Engine rule** — see *Implementation notes* above and
      the `skillCalculator.ts` header, which carries the same three reasons where the next reader
      will find them. Nothing landed as ruleset data, so the second clause does not arise.)
- [x] Verified via the `verifier` subagent, the `fallow` skill, and the `coding-conventions`
      skill, ~~plus a live browser check of the skills grid (ask the User first)~~.
      (Verification run directly rather than through the `verifier` subagent: `npx vitest run`
      **3208 passing / 196 files / 0 failing / 0 skipped** — +10 on the 3198 baseline, all of them
      the new SKL-04 cases; `npx tsc --noEmit` exactly the 2 documented baseline errors;
      `yarn run lint --max-diagnostics=1000` and `yarn run check` (biome + dependency-cruiser, 691
      modules) both clean. `fallow audit --base main` **pass** across 6 changed files with
      `dead code 0 · complexity 0 · duplication 0` introduced; `fallow dead-code`'s two rows
      (`RulesetHomeKind`, the `fallow` dependency) are inherited and neither file is in this diff —
      the dead code this ticket *would* have left, `ceilLevel`, was deleted in the same change.
      **The browser check was skipped by User instruction for this run**, so the skills grid has not
      been seen live; the level and bonus a row renders are asserted through `CharacterSheet.test.tsx`
      instead.)

## Notes

- **Land this before the data pass re-weights.** Re-weighting against the old rounding would pin
  48 numbers that then all move.
- **A level can still render fractional, and TICKET-SKL-05 is where that stops being fine.** The
  invested points are added *after* the ceil, so an invested `1.5` renders as `13.5` where the old
  display-edge `ceilLevel` showed 14 — the golden suite pins exactly that row. It is correct as the
  sheet stands today, because a bought point is whole; the moment the invested term routes through
  the point-buy curve (the open question in `skillCalculator`'s header) fractions become ordinary and
  **nothing on the sheet rounds a level at all**. Decide there whether the ceil moves outside the
  `+ invested`, or the sheet formats what the engine gives it.
- Focus skills (the multiplier, the character field, the wizard step) are **TICKET-SKL-05**; gear
  skill bonuses land with TICKET-ITEM-01/TICKET-INV-05.
- Two skills sharing a spelling stops being a real case when the data pass merges the duplicate,
  but the first-one-wins reference rule stays as is — it is the namespace's rule, not that data's.
