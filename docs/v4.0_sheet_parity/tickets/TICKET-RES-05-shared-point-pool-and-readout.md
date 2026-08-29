# TICKET-RES-05 — One point pool for stats and skills, with the readout

- **Area:** Progression (point budget)
- **Type:** Feature (budget widening + display)
- **Traceability:** System [02 · Progression and identity](../systems/02-progression-and-identity.md)
  (gaps 3–4); the xlsx's `Points to Use = level × 3 − Points Spend` summing stat *and* skill boxes
  (`Background Charater Sheet Calcu` AK3:AK4).

> **Scope (overview [D7](../overview.md#d7--seeded-values-and-formula-text-are-a-separate-issue-user-2026-08-29)):**
> nothing seeded moves here — `points_per_level` is already 3 and the new sheet confirms it. The
> data pass owes this ticket only the fragment `notes` entry recording the sheet's own double-count
> quirk (its SUM lists `D10` twice), which is a note about the sheet, not a value.

## User story

As a Player, I want my stat points and skill points paid from the one budget the sheet prices —
with Points to Use and Points Spend on my sheet — so a point spent anywhere costs the same pool.

## Description

The sheet has **one shared pool**: `level × 3` (plus DM grants, TICKET-DM-01) pays for both stat
investment and skill investment, and the Character Sheet shows the Points to Use / Points Spend
pair. Today the app budgets stat points only; skill investment is free. The fix is where the spend
is summed, not the refusal discipline.

## Current situation (as-is)

- [skillAllocation.ts](../../../src/shared/engine/skillAllocation.ts)'s `validateStatAllocation`
  prices the pool as `level × const.points_per_level + grantedStatPoints` (TICKET-RES-02,
  TICKET-DM-01) — over **stat** investment only.
- Skill invested points exist (`level = … + invested`, TICKET-SKL-02) but no budget covers them;
  a Player can invest skill points without limit.
- `points_per_level` = 3 in [constants.json](../../imports/constants.json) — the new sheet's
  *Points scaling* is the **same 3**, confirmed unchanged.
- Refusals are the house discipline: an unaffordable spend is refused naming the overspend, never
  clamped (RES-02, DM-01).

## Desired result (to-be)

- **The budget covers the sum**: `level × points_per_level + grants` prices
  `investedStatPoints + investedSkillPoints` together in `validateStatAllocation` (or its widened
  successor — one validator, both spends; the server re-derives through the same Kernel rule).
- **Refusal discipline unchanged**: an unaffordable spend on either side is refused with the
  overspend named; nothing is clamped; existing DM-grant behaviour (raise never refused, revoke
  refused when it strands an overspend) keeps passing.
- **The readout**: Points to Use / Points Spend rendered on the sheet header where the sample
  shows them (`Character Sheet` K1:L3), both read from the widened allocation result — display
  only, nothing recomputed inline.

## Implementation notes (2026-08-29)

Two decisions taken while building, recorded here because neither is visible from the criteria
alone.

1. **One rule was added that no criterion asked for: a change that *lowers* the total spend is never
   refused.** Criterion 2 asks for a no-longer-affordable allocation to be *reported* rather than
   rewritten — and the existing refusal would have reported it and then blocked the only way out,
   because `investInStat` refuses whenever the **proposal** is invalid, which a refund on an
   overspent sheet still is. Every character built while skill investment was free is now such a
   character, so the trap goes from theoretical to ordinary with this ticket.
   [`StatsSection`](../../../src/client/components/play/sheet/StatsSection.tsx) has drawn `−` as
   always-open since RES-02 with a comment saying *a point can always be taken back*; the rule now
   holds in the Kernel where that comment assumed it already did. Refusals are otherwise unchanged.
2. **`validateStatAllocation` keeps its name**, though it now prices both spends — the to-be line
   allowed "or its widened successor". The name and `StatAllocationResult` have **90 references
   across 24 modules**, and a mechanical rename would bury a behavioural diff in churn. The module
   is `skillAllocation.ts` and is finally accurate again; the rename is recorded as
   TICKET-DX-09's, the shape pass's closeout — **and `unknownStatIds` goes with it**, since
   `pointsSpent` now covers both maps while that field is still stat-only. It is a decision rather
   than an omission, and `collectSkillSpend`'s docblock carries the reasoning the rename must keep.
3. **A third reader of the verdict was widened during the `conventions-reviewer` pass**, and it was
   the ticket's one blocking finding — see the criteria below.
   [`snapshotConflicts.ts`](../../../src/server/routes/sessions/snapshotConflicts.ts) read two arms
   of a verdict that now has four, so an over-budget character produced a reason stopping at its own
   colon *and* blocked the Snapshot refresh for good, against every candidate including a
   byte-identical one. It now compares the two verdicts — a character the pinned rules already
   refuse cannot block a refresh it did not cause — which is the refund rule's judgement one layer
   out. The same pass removed `CountRow`'s `canAdjust`, whose stated rationale this ticket had
   falsified.

## Acceptance criteria

- [x] A character whose stat + skill investment together exceed the pool is refused on the next
      spend of either kind, with the overspend named — engine tests covering stat-then-skill and
      skill-then-stat orderings.
      (One shared `affordabilityRefusal` in
      [`playerActions.ts`](../../../src/shared/services/playerActions.ts) serves `investInStat` and
      `investInSkill`, saying *"That spend goes 1 point over the budget"* in `setGrantedPoints`'s
      DM-01 register. Both orderings:
      `src/shared/services/playerActions.test.ts` → *the shared pool* → *refuses a skill spend the
      stat boxes have already eaten* and *refuses a stat spend the skill boxes have already eaten*,
      each asserting the named overspend; plus *sums every skill box rather than only the one being
      changed*. Order-independence at the engine:
      `src/shared/engine/skillAllocation.test.ts` → *should reach the same verdict whichever side
      the last point went into*. Through a request: `src/server/routes/play/play.test.ts` →
      *refuses a spend the budget cannot pay for…* now asserts `over the budget`.)
- [x] A previously-legal allocation that the widened budget can no longer afford is *reported*
      (validation surface), not silently rewritten — the same treatment RES-02 gave overspends.
      (`skillAllocation.test.ts` → *should report an allocation the widened pool can no longer
      afford, not rewrite it*: a character with 20 skill points against a pool of 15 comes back
      `isOverBudget: true`, `pointsSpent: 20`, and the stored map still reads 20. The surface is
      RES-02's — `PointBudgetSummary`'s crimson `20/15` — and nothing anywhere rewrites a stored
      allocation. Its companion is the refund rule in the note above, which is what makes the report
      actionable. **The review found the one place this was still a block rather than a report** —
      the Snapshot refresh — and it is now a comparison:
      `sessions.test.ts` → *an allocation the pool cannot cover* → *does not block on a character the
      pinned rules already refuse* refreshes a table holding a 40-point character and gets a 200,
      while *names the overspend when the refresh makes an affordable spend unaffordable* keeps the
      refusal for the character the refresh actually breaks — asserting the named overspend and that
      the reason does not end on its own punctuation.)
- [x] The sheet header shows Points to Use / Points Spend matching the sample (level 1, 3 spent →
      0 to use, 3 spend), sourced from the allocation result — component test plus engine test.
      ([`PointBudgetSummary.tsx`](../../../src/client/components/play/shared/PointBudgetSummary.tsx)
      renders `pointsSpent`/`pointBudget` and `pointsRemaining` off the one
      `toPointBudgetView(allocation)` — no arithmetic in the component. Engine:
      `skillAllocation.test.ts` → *should report the sample sheet's Points Spend and Points to Use*
      pins exactly the sample (level 1, seeded `points_per_level` 3, 3 spent → budget 3, spent 3,
      remaining 0), with *should count a skill point against that same pair* proving the skill box
      lands in it. Component: `CharacterSheet.test.tsx` → *should print the sheet's Points to Use
      beside Points Spend (TICKET-RES-05)* reads the figure off its own label, and *should move the
      pool when experience moves the level* asserts the `0`.)
- [x] DM grant round-trips still pass unchanged (`dm.test.ts`'s grant/revoke cases now priced over
      the summed spend).
      (`src/server/routes/dm/dm.test.ts` and the grant/revoke block of
      `src/shared/services/dmActions.test.ts` pass **unedited** — raise never refused, revoke
      refused when it strands an overspend, the `1 point` singular. Two cases added beside them to
      prove the pricing actually widened: *prices a revocation over the skill boxes too, not the
      stat boxes alone* (4 stat + 5 skill against a pool of 5 → *"4 points overspent"*) and *still
      lets a grant cover a spend that is all skill-side*.)
- [x] Unit tests cover: sum priced across both spends, refusal naming, readout values, grant
      interaction.
      (**+28 tests, 3108 → 3136, 194 files unchanged** — 24 from the build, 4 from the review.
      `skillAllocation.test.ts` +10 — the sum,
      both orderings, several skills summed, a stale skill id charged nothing, a negative skill
      spend reported rather than refunding, the legacy overspend reported, the grant, and the two
      readout cases. `playerActions.test.ts` +7 — the refusals, the exact fill, the refund accepted
      and the raise on the same character still refused. `CharacterSheet.test.tsx` +3 — the readout
      and the skill row's new spend controls, plus the review's refund-against-an-unpriceable-pool
      case (+4 in all). `characterStore.test.ts` +2, `dmActions.test.ts` +2, and the review's
      `sessions.test.ts` +2 and `CharacterCreationWizard.test.tsx` +1. Two existing assertions were
      **replaced rather than deleted**: *"should accept any whole number, because skills have no pool
      to overspend"* had documented its own retirement in a comment and is now *should refuse a skill
      spend the shared pool cannot pay for*; and RES-02's *"an unpriceable pool refuses a `−` as
      well"* is reversed, because the refund rule made it false. One fixture changed for the same
      reason — *reports every character that would break* seeded its second character over budget,
      so it had stopped covering its own claim.)
- [x] Verified via the `verifier` subagent, the `fallow` skill, and the `coding-conventions`
      skill, ~~plus a live browser check of a refused over-budget skill spend (ask the User
      first)~~.
      (`npx vitest run` **3136 passing / 194 files / 0 failing / 0 skipped** — +28 on ARC-04's 3108
      baseline; `npx tsc --noEmit` at the documented 2-error baseline, unchanged; `yarn run check`
      clean — biome over 666 files with no finding, dependency-cruiser 687 modules / 3375
      dependencies with no violation. `fallow audit --base main` verdict **pass** over 33 changed
      files, **0 introduced** dead-code / complexity / duplication findings; the inherited rows are
      `fallow` in `dependencies`, `RulesetHomeKind` in `rulesetSync.ts` — neither file opened here —
      and a 16-line `CountRow`/`SkillBreakdownRow` clone that surfaced only because the review pulled
      `CountRow` into the changed set. The complexity row that matters is the one that **left**:
      ARC-04 recorded `validateStatAllocation` at 14 cyclomatic / 99 lines and warned a fourth
      concern would push it over, so it was split into `collectStatSpend` / `collectSkillSpend` /
      `derivePointBudget` first and no longer appears in `fallow health` at all.
      `fallow health --hotspots --since 6m` returns eight touched files Accelerating —
      `characterStore.ts` 17.3 → 18.3, `CharacterSheet.tsx` 9.2 → 10.0, `CharacterSheet.test.tsx`
      8.9 → 10.7, and first rows for `skillAllocation.ts` 5.0, `skillAllocation.test.ts` 7.1,
      `characterStore.test.ts` 7.6, `ResourcesSection.tsx` 7.1 and `StatsSection.tsx` 5.0 — all
      eight recorded in TEST_STATUS.md's hotspot table.
      **The `conventions-reviewer` pass raised four items and all four are fixed here**: the
      blocking `snapshotConflicts` finding (an empty refusal sentence, and a refresh blocked for
      good on a character the refresh did not break — now a comparison, with every arm of the
      verdict given a sentence), the wizard's stat-only error path (now `entryBreachError`, split
      out because the added arm took `allocationStepError` to 10 cyclomatic and `fallow` said so,
      plus the skill input's missing `error` flag), the `canAdjust` comment asserting the opposite
      of the code (the prop deleted and RES-02's assertion reversed), and ~25 nested calls in the
      new test blocks (bound). Both deliberate choices in the notes above were reviewed and
      accepted.
      **The browser half was not run** — browser check skipped by User instruction for this run,
      which is what the strikethrough records rather than an oversight. What it would have shown —
      a skill spend refused for want of points — is covered by the store, service and route
      assertions above, but not by a live sheet.)

## Notes

- This lands the rest of plan §14 after TICKET-RES-04 took the Dream level half; the two halves
  are deliberately separate because ARC-04 needs the field and nothing needs the pool.
- Behavioural for every ruleset: skill investment stops being free. The corpus's sample character
  is affordable (3 points, all stat-side); any seeded character that is not becomes a validation
  finding, which is the correct surface for it.
