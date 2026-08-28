# TICKET-STAT-04 — Stat identity: ATP, three groups, and the tomato ladder

- **Area:** Stats configuration
- **Type:** Feature (data revision + presentation)
- **Traceability:** System [03 · Stats and vitals](../systems/03-stats-and-vitals.md); system
  [02 · Progression](../systems/02-progression-and-identity.md) (the ATP rename); overview
  [Rulings 2026-08-29](../overview.md#rulings-user-2026-08-29) (Temp means nothing; Speed stays a
  plain stat).

## User story

As a User, I want my stats to carry the sheet's names, flavour text and Physical/Mental/Vitals
grouping, so the app's sheet reads like the workbook my table already knows.

## Description

An identity pass over the ten stats: APT becomes **ATP** ("Actions per turn"), every stat gains
the sheet's flavour line, and the character sheet renders the sheet's three stat groups. The Temp
column is deliberately not built and Speed stays a plain stat — both ruled 2026-08-29.

## Current situation (as-is)

- Ten stats in one flat ordered list (TICKET-STAT-01); no grouping concept on
  [`Stat`](../../../src/shared/types/config.ts) and the sheet renders one column set.
- [stats.json](../../imports/stats.json) names the derived stat **APT** and carries v2.0's own
  descriptions; the formula reads `const.apt_value` = 30
  ([constants.json](../../imports/constants.json)) — the new sheet has the same constant and the
  sample agrees (Speed 20 → 1), so only the *name* is stale.
- Renames are safe since TICKET-REF-01 (stable ids; formulas re-slug).
- Composition already runs base + investment + racial + equipment
  ([statCalculator.ts](../../../src/shared/engine/calculators/statCalculator.ts)) — assembly
  matches the sheet; nothing here changes the math.

## Desired result (to-be)

- **APT → ATP** — stat `name`/`abbreviation` in fragment and seeds, description "Actions per
  turn"; decide in the ticket whether `apt_value` becomes `atp_value` (a constant rename is also
  safe; corpus and seeds move together, and the formula text follows whichever is chosen).
- **`Stat.group?`** — optional, User-named free string (their ruleset, not a closed set), holding
  the sheet's Physical/Mental/Vitals; the character sheet renders the three grouped columns.
  Absent means ungrouped, rendering as today.
- **stats.json refreshed** — the sheet's flavour descriptions (verbatim, "Kachow" included),
  `group` values, re-sourced ranges. The Temp column is **not** modelled, stored, or rendered.

## Acceptance criteria

- [ ] The seeded ruleset's derived stat reads **ATP** everywhere it is displayed, and every
      formula referencing it still evaluates (rename through the store action; TICKET-REF-01's
      re-slugging covers formula text).
- [ ] A `Stat` with a `group` renders in that group's column on the character sheet; a ruleset
      with no groups renders exactly as before — pinned by component tests both ways.
- [ ] No `tempStatValues`, no third box: a grep of the persisted shapes for `temp` stays empty,
      and `currentResourceValues` remains the only "current" (TICKET-RES-03's discipline untouched).
- [ ] Derived values still come from the engine — grouping is presentation; no calculator change,
      asserted by an unchanged [statCalculator.ts](../../../src/shared/engine/calculators/statCalculator.ts)
      test suite.
- [ ] [stats.json](../../imports/stats.json) (and [constants.json](../../imports/constants.json)
      if the constant renames) re-sourced to the new workbook with `source.ranges` cited and new
      `exportedAt`; `yarn run sheet:import` regenerated.
- [ ] Feature components compose `components/ui` primitives; base components gain no layout.
- [ ] Verified via the `verifier` subagent, the `fallow` skill, and the `coding-conventions`
      skill, plus a live browser check of the grouped sheet (ask the User first).

## Notes

- **Fractional final stats**: the workbook applies no rounding to the final SUM, and gains can be
  fractional once ARC-04 lands (`main(0) = 0.75 × dreamLevel`). Default is to mirror the sheet —
  display what the engine returns; if the ticket surfaces the ruleset's `rounding` mode instead,
  record the decision here (systems/03's one open question).
- The `group` values come from the User's sheet, so misspellings are theirs to keep or fix — the
  app validates nothing about the strings.
