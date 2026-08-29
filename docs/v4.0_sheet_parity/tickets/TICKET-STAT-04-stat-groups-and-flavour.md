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

> **Implementation note (2026-08-29).** Two criteria are amended below rather than silently
> outgrown, both struck through where the original wording no longer describes what was built.
> Criterion 3's *"grep for `ATP` stays empty"* could not survive criterion 3's own second half —
> a note forbidding the sheet's spelling has to name it. Criterion 8's browser half was declined
> for this run by the User.

- [x] A `Stat` with a `group` renders in that group's column on the character sheet; a ruleset with
      no groups renders exactly as before — pinned by component tests both ways.
      (`StatsSection.test.tsx` — *should draw a heading per group, with each stat under its own* and
      *should render a ruleset with no groups exactly as before — every stat, no heading*;
      `ResourcesSection.test.tsx` pins the same pair for the pools, since the sheet's *Vitals*
      column spans both sections. Rendered by
      [StatGroupColumns.tsx](../../../src/client/components/play/sheet/StatGroupColumns.tsx).)
- [x] Three groups render as three columns and a fourth group would render as a fourth — the render
      is driven by the distinct values present, not by a list of three names.
      ([statGroups.ts](../../../src/client/components/play/sheet/statGroups.ts) builds one column
      per distinct value in first-appearance order and the grid is `grid-flow-col auto-cols-fr`, so
      no breakpoint and no module names a count. `statGroups.test.ts` — *should render a fourth
      group as a fourth column, with nothing naming the three*; `StatsSection.test.tsx` — *should
      draw as many columns as there are distinct groups, a fourth included*.)
- [x] `APT` is unchanged everywhere — name, abbreviation, `const.apt_value`, and the formula text
      that reads it; ~~a grep for `ATP` in `src/` stays empty~~ **a grep for `ATP` in `src/` returns
      exactly one hit — the comment forbidding it** — and the exception is noted where the stat is
      defined. (`git diff` touches no `APT`/`apt_value` spelling in the seeds, the constants or the
      calculators; `grep -rn ATP src/` returns
      [config.ts:134](../../../src/shared/types/config.ts) alone, the `Stat` JSDoc naming this as
      v4.0's one deliberate exception to D1 so nobody "fixes" it back.)
- [x] No `tempStatValues`, no third box: a grep of the persisted shapes for `temp` stays empty, and
      `currentResourceValues` remains the only "current" (TICKET-RES-03's discipline untouched).
      (`grep -rniE "temp(orary|Stat|Value)?"` over `types/config.ts` and `types/character.ts`
      returns nothing; neither file gained a field beyond `Stat.group`, and no Temp column is
      rendered.)
- [x] Derived values still come from the engine — grouping is presentation; no calculator change,
      asserted by an unchanged [statCalculator.ts](../../../src/shared/engine/calculators/statCalculator.ts)
      test suite. (Neither the calculator nor its test appears in `git diff --stat`; the whole
      engine is untouched by this ticket. `statGroups.ts` reads `Stat.group` and computes nothing.)
- [x] Additive-optional field: a ruleset with no groups round-trips import/export unchanged, so no
      version bump of its own. (`importExport.test.ts` → *stat groups (TICKET-STAT-04)*:
      *should round-trip a ruleset that names no groups unchanged* asserts `imported.stats` equals
      the fixture and that no stat gained a `group` key. `SUPPORTED_SCHEMA_VERSION` is untouched —
      D6's single milestone bump is still TICKET-DX-09's to spend.)
- [x] Feature components compose `components/ui` primitives; base components gain no layout.
      (`StatGroupColumns` composes `Text` and owns its own grid; nothing under `components/ui/`
      was touched, and `libraryConventions.test.ts` passes.)
- [ ] Verified via the `verifier` subagent, the `fallow` skill, and the `coding-conventions`
      skill, ~~plus a live browser check of the grouped sheet (ask the User first)~~.
      (3066/3066 tests, `npx tsc --noEmit` at the documented 2-error baseline, `yarn run check`
      clean, `yarn run arch` clean. `fallow audit --base main` reported one introduced finding — a
      13-line clone between the two sections — which became `StatGroupColumns`; duplication is now
      0 and the remaining complexity/dead-code findings are inherited. **The browser check was
      skipped by User instruction for this run**, so the box stays open: the grouped sheet has not
      been seen in a browser.)

## Notes

- **Fractional final stats: mirror the sheet, decided.** The workbook applies no rounding to the
  final SUM, and gains can be fractional once ARC-04 lands (`main(0) = 0.75 × dreamLevel`). This
  ticket **changed nothing about display** — `CountRow` still prints whatever the engine returns
  through `readableNumber`, and the ruleset's per-stat `rounding` mode stays the one place a
  fraction is deliberately removed. systems/03's open question is closed: the sheet wins, and
  ARC-04 will meet a display surface that already prints a fraction rather than one that hides it.
- **A group that spans the resource split draws a column on each side.** The sheet's *Vitals*
  column holds Health, Mana and Speed; this app puts pools in `ResourcesSection` and plain stats in
  `StatsSection`, so a *Vitals* heading appears in both rather than one section swallowing the
  other's rows. That is the honest rendering of two arrangements that genuinely disagree, and it is
  why `statGroups.ts` is a shared mapper rather than logic inside one section. If a later ticket
  wants one true Vitals column, it has to merge the two sections, which is a different decision.
- **One hairline change to the ungrouped sheet.** Each column is a `<div>`, so `CountRow`'s
  `last:border-b-0` now drops the rule under the *last* stat instead of leaving it above the stat
  total's own `border-t`. One fewer doubled line; every row, order and control is otherwise
  identical, which is what the both-ways test pins.
- The group values come from the User's sheet, so misspellings are theirs to keep or fix — the app
  validates nothing about the strings.
- Grouping is the whole reason the field exists; nothing derives from a group and no rule reads
  one. If a later system wants to (a group total, a group cap), that is a new decision.
