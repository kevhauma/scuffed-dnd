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

- [x] Reset-to-max and relative entry go through store actions; relative entry applies deltas against the stored current (tests, including negative results passing per v1.0 Req 14.4). (`characterStore.adjustCurrentStatValue` and `resetCurrentStatValueToMax`; `src/stores/characterStore.test.ts` → *adjustCurrentStatValue* and *resetCurrentStatValueToMax*, including `should apply the delta to what is stored, not to a clamped reading of it` and `should allow a delta to take a pool below zero` (−130 off 100 → −30, Req 14.4). Sheet-level: `CharacterSheet.test.tsx` → *resource pool behaviours (TICKET-RES-03)*, `should apply -7 / +12 as a delta against the stored value` and `should refill a spent pool to its calculated maximum`.)
- [x] Commit-on-blur/enter tested at the component level (intermediate keystrokes never persist). (`src/components/play/shared/useNumericDraft.test.ts` → *holding a draft* / *committing*: `should commit nothing while the Player is still typing`, `should commit the finished entry on blur`, `should commit on Enter, and swallow the key so no surrounding form submits`, `should commit only once per finished entry`. Through the real sheet: `CharacterSheet.test.tsx` → `should not persist the digits typed on the way to a value (TICKET-RES-03)`.)
- [x] Kept-and-flagged tested end-to-end: unequip a MAT-02 item so max drops → stored current unchanged, flag renders; writes still clamp to the new max. (`CharacterSheet.test.tsx` → *kept-and-flagged when a maximum falls*: `should keep the tracked value rather than rewriting it`, `should flag the mismatch on the sheet`, `should clamp to the new maximum on the next write`, `should not flag a pool that is merely below its maximum`. **Divergence on how the maximum is dropped, see implementation note 3**: the fixture lowers the invested STR that `STR * 10` reads rather than unequipping an item — same cause, one fewer fixture.)
- [x] Derived-stat gating regression stays green. (`CharacterSheet.test.tsx` → *resource gating*, unchanged and passing: `should give a non-resource stat no current-value controls at all` and `should stop offering current-value controls when a stat stops being a resource`.)
- [x] Components compose `ui/` primitives, theme tokens only; no component clamps — the rule lives in the store. (`StatEditor` composes `Button`/`Input`/`Label`/`Text`; the steppers and the quick entry both send a **delta**, "To full" sends no number, so no arithmetic on a pool happens in the component. `yarn run check` clean.)
- [x] Verified via the `verifier` subagent, the `fallow` skill, and the `coding-conventions` skill. (See the Verification section below.)
- [ ] Verified live in the browser: spend with relative entry, reset to max, shrink a max and see the flag. (**Left open — the User declined the live check for this run and the remaining v2 tickets**, asked and answered 2026-08-16.)

## Implementation notes

1. **A leading `+`/`-` means a delta; absolute negative entry is no longer typeable.** Concept 20
   spells quick entry as `-7` / `+12`, which collides head-on with v1.0's typeable negative absolute
   (`-5` meaning "set to −5"). One spelling cannot mean both. Relative wins because it is what a
   table actually does — damage and healing are deltas — and the absolute negative is still
   reachable: `−` steps down one at a time, and `-70` off a pool of 60 lands on −10. Requirement
   14.4 is about what may be **stored**, and a pool still goes below zero; only the keying changed.
   The `Input` also had to stop being `type="number"`, which rejects a leading `+` outright.
2. **Commit-on-blur landed in the shared `useNumericDraft`, so it fixed a live bug in the *other*
   editor.** The `conventions-reviewer` found it on TICKET-RES-02: `updateCurrentStatValue` clamps,
   so an intermediate commit was harmless on a pool, but `setInvestedStatPoints` **refuses** — typing
   `20` over a `6` persisted the `2` on the way past and then refused the `20`, quietly unspending
   four points. Both editors now commit once, on blur or Enter.
3. **The kept-and-flagged fixture lowers a stat rather than unequipping an item.** The criterion
   named a MAT-02 unequip as the way to drop a maximum; the sheet fixture's `Health` is `STR * 10`,
   so lowering the invested STR produces the identical state — a stored current above a fallen
   derived maximum — without a second material/item/slot fixture. The rule under test is "a derived
   maximum never silently overwrites what the Player is tracking", and it does not care which term
   of the formula moved.
4. **`resetCurrentStatValueToMax` leaves a pool alone when the maximum cannot be calculated.**
   Writing 0 would make "restore to full" the one control that empties a pool, so the action returns
   without writing and the button is disabled — the reasoning the sheet already applies to a broken
   formula everywhere else.
5. **Per-resource `min` / `overflow` / `reset_on` as data stay deferred**, per the ticket's own note.
   Nothing here reads a per-resource rule; the behaviours are uniform across every resource stat.

## Sheet data

Nothing to land: no persisted entity or configuration field changed. `Character.currentResourceValues`
keeps the same shape — this ticket changes *how* it is written, not *what* is stored — so no
`docs/imports/` fragment moves and `ducklets.json` is untouched.

## Verification

- `npx vitest run` — see the run recorded in [TEST_STATUS.md](../../../TEST_STATUS.md).
- `npx tsc --noEmit` — the documented 2-error baseline, unchanged.
- `yarn run check` — clean.

## Notes

- Per-resource `min` / `overflow` / `reset_on` as data are deferred until a ruleset needs them;
  v1.0's negatives-allowed rule stands for writes.
- A mutation log (actor/timestamp/reason) is spec-listed but deferred — session roll history is
  the only log v2.0 keeps.
