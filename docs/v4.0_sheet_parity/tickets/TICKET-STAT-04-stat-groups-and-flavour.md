# TICKET-STAT-04 — Stat groups on the character sheet

- **Area:** Stats configuration
- **Type:** Feature (presentation + one optional field)
- **Traceability:** System [03 · Stats and vitals](../systems/03-stats-and-vitals.md); overview
  [Rulings 2026-08-29](../overview.md#rulings-user-2026-08-29) (Temp means nothing; Speed stays a
  plain stat) and [Rulings — ticket review](../overview.md#rulings-user-2026-08-29--ticket-review)
  (**APT is not renamed**).

> **Scope (overview [D7](../overview.md#d7--seeded-values-and-formula-text-are-a-separate-issue-user-2026-08-29)):**
> this ticket builds the `group` field and the grouped rendering. The *values* — which stats carry
> which group, the sheet's flavour descriptions, re-sourced ranges in
> [stats.json](../../imports/stats.json) — are the data pass's. It owes this ticket:
> Physical/Mental/Vitals on the nine stats, and the flavour line per stat ("Kachow" included).

## User story

As a User, I want my character sheet to read in the sheet's stat groups — Physical, Mental,
Vitals — so the columns my table already knows are the columns the app draws.

## Description

The sheet lays its stats out in three named groups; the app draws one flat list. This ticket gives
`Stat` an optional, User-named group and teaches the character sheet to render by it. The Temp
column is deliberately not built and Speed stays a plain stat — both ruled 2026-08-29.

**APT keeps its name.** The new workbook writes *ATP* and the app does not follow it: the sheet is
mistaken there rather than idiosyncratic, and the User has ruled the app keeps `APT` ("Actions per
turn"). `const.apt_value` keeps its name with it. This is the milestone's one deliberate exception
to D1's *the sheet wins*, and the exception is named so nobody "fixes" it back later.

## Current situation (as-is)

- Ten stats in one flat ordered list (TICKET-STAT-01); no grouping concept on
  [`Stat`](../../../src/shared/types/config.ts) and the sheet renders one column set.
- The derived stat is `APT`, `max(1, round(SPEED / const.apt_value))` with `apt_value` = 30 — and
  the new sheet's constant is the same 30, so nothing about it moves.
- Renames are safe since TICKET-REF-01 (stable ids; formulas re-slug) — the mechanism exists, this
  ticket just has no rename to spend it on.

## Desired result (to-be)

- **`Stat.group?`** — optional, User-named free string (their ruleset, not a closed set). Absent
  means ungrouped.
- **The character sheet renders by group** — a column per distinct group in the stats' own order,
  ungrouped stats rendering exactly as today. A ruleset that names no groups is visually unchanged.
- **The group is editable** where a stat is edited, and validated against nothing: a misspelling is
  the User's to keep.

## Acceptance criteria

- [ ] A `Stat` with a `group` renders in that group's column on the character sheet; a ruleset with
      no groups renders exactly as before — pinned by component tests both ways.
- [ ] Three groups render as three columns and a fourth group would render as a fourth — the render
      is driven by the distinct values present, not by a list of three names.
- [ ] `APT` is unchanged everywhere — name, abbreviation, `const.apt_value`, and the formula text
      that reads it; a grep for `ATP` in `src/` stays empty, and the exception is noted where the
      stat is defined.
- [ ] No `tempStatValues`, no third box: a grep of the persisted shapes for `temp` stays empty, and
      `currentResourceValues` remains the only "current" (TICKET-RES-03's discipline untouched).
- [ ] Derived values still come from the engine — grouping is presentation; no calculator change,
      asserted by an unchanged [statCalculator.ts](../../../src/shared/engine/calculators/statCalculator.ts)
      test suite.
- [ ] Additive-optional field: a ruleset with no groups round-trips import/export unchanged, so no
      version bump of its own.
- [ ] Feature components compose `components/ui` primitives; base components gain no layout.
- [ ] Verified via the `verifier` subagent, the `fallow` skill, and the `coding-conventions`
      skill, plus a live browser check of the grouped sheet (ask the User first).

## Notes

- **Fractional final stats**: the workbook applies no rounding to the final SUM, and gains can be
  fractional once ARC-04 lands (`main(0) = 0.75 × dreamLevel`). Default is to mirror the sheet —
  display what the engine returns; if the ticket surfaces the ruleset's `rounding` mode instead,
  record the decision here (systems/03's one open question).
- The group values come from the User's sheet, so misspellings are theirs to keep or fix — the app
  validates nothing about the strings.
- Grouping is the whole reason the field exists; nothing derives from a group and no rule reads
  one. If a later system wants to (a group total, a group cap), that is a new decision.
