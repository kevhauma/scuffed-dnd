# TICKET-RES-03 — Resource pool behaviours

- **Area:** Resources & progression
- **Type:** Feature
- **Traceability:** Concept [20 · Resource & action](../../excel%20export%20summary/concepts/20-resource-and-action.md) (manual controls; current vs. max rules)

## User story

As a Player, I want my pools to behave like pools — quick relative entry, reset to max, and my
tracked value never silently rewritten when a max shrinks — so the sheet is trustworthy at the
table.

## Description

STAT-01 gated current values to resource stats; this ticket adds the spec's pool behaviours on
top: the missing controls, commit semantics, and the "never silently overwrite" rule.

## Current situation (as-is)

- [`StatEditor`](../../../src/components/play/sheet/StatEditor.tsx) offers ±1 steppers and
  absolute entry, and **persists every keystroke** (`handleChange` calls `onChange` mid-typing);
  no relative entry, no reset-to-max.
- [`characterStore.ts`](../../../src/stores/characterStore.ts) clamps to max on write only; if a
  max later drops below the stored current (unequip, formula edit) nothing flags it — the sheet
  silently shows current > max.

## Desired result (to-be)

- **Controls:** reset-to-max per pool (a store action — the "Regain mana to full" seed) and
  relative quick entry (`-7`, `+12`) alongside the steppers; edits commit on blur/enter, not per
  keystroke.
- **Kept-and-flagged:** when a derived max drops below the stored current, the current is kept
  and visibly flagged on the sheet — never rewritten (spec: "a derived max must never silently
  overwrite what the player is tracking"); write-clamping stays.
- Derived stats remain fully gated: no current value, no controls (STAT-03's rule holds through
  the new UI).

## Acceptance criteria

- [ ] Reset-to-max and relative entry go through store actions; relative entry applies deltas against the stored current (tests, including negative results passing per v1.0 Req 14.4).
- [ ] Commit-on-blur/enter tested at the component level (intermediate keystrokes never persist).
- [ ] Kept-and-flagged tested end-to-end: unequip a MAT-02 item so max drops → stored current unchanged, flag renders; writes still clamp to the new max.
- [ ] Derived-stat gating regression stays green.
- [ ] Components compose `ui/` primitives, theme tokens only; no component clamps — the rule lives in the store.
- [ ] Verified via the `verifier` subagent, the `fallow` skill, and the `coding-conventions` skill.
- [ ] Verified live in the browser: spend with relative entry, reset to max, shrink a max and see the flag. (Ask the User first per CLAUDE.md.)

## Notes

- Per-resource `min` / `overflow` / `reset_on` as data are deferred until a ruleset needs them;
  v1.0's negatives-allowed rule stands for writes.
- A mutation log (actor/timestamp/reason) is spec-listed but deferred — session roll history is
  the only log v2.0 keeps.
