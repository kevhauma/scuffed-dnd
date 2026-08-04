# TICKET-FORM-06 — Error chips on the character sheet

- **Area:** Formula engine (UI surface)
- **Type:** Feature (closes the v1.0 known bug's user-visible half)
- **Traceability:** Concept [00 · Field model §7](../../excel%20export%20summary/concepts/00-field-model.md)

## User story

As a Player, I want a broken value to show as a small red chip explaining what's wrong, while
everything else on my sheet stays usable.

## Description

TICKET-FORM-05 made errors values with provenance; this ticket renders them. One chip primitive,
used wherever a computed value appears.

## Current situation (as-is)

- [`useCharacterSheet`](../../../src/components/play/sheet/useCharacterSheet.ts) has the one
  `calculateCharacter` call; pre-FORM-05 a throw took the whole sheet down. Post-FORM-05 the data
  is there, but nothing renders an error entry.
- The v1.0 bug scenario (add a main skill → every existing character's sheet breaks with
  `Undefined variable`) is the acceptance regression for this pair of tickets.

## Desired result (to-be)

- An errored value renders as a compact **error chip** (crimson theme tokens, `ui/` primitive
  composition) whose detail shows the FORM-05 provenance chain in plain words.
- Healthy values render exactly as before; a sheet with mixed results is fully navigable and
  every non-broken section works.
- Regression pinned: adding a new skill/stat to a config with existing characters leaves every
  character's sheet rendering — worst case, chips on affected values, never a blank page.

## Implementation notes (2026-08-04)

1. **This ticket reverses TICKET-FORM-05's interim gate.** FORM-05 deliberately kept the sheet's
   whole-sheet `formula-error` state so a broken value could not slip through as a silent `0`
   before chips existed. That gate is now gone: `formula-error` is reached only by a genuine
   *throw* from `calculateCharacter` — an engine bug — and a broken formula costs one chip.
2. **The hook interprets, the sections render.** A new `DerivedValue` (`{ value, error }`) is
   produced once in `useCharacterSheet` by a `derived()` helper, and the three breakdown types
   carry it. Sections therefore never import the engine to decide what to draw, and `ErrorChip`
   takes plain strings rather than a `FormulaError` — so it stays a general primitive and survives
   STAT-03's sheet rework, as the ticket's Notes ask.
3. **Scoped to the sheet, deliberately.** The character-creation wizard's review step still
   withholds the whole preview rather than showing chips (added in FORM-05 to close a silent-zero
   regression). Chips there would mean threading `DerivedValue` through `SummaryRow` — a separate
   surface, and outside this ticket's criteria, all of which name the sheet.
4. **The chip is not focusable, and that is a compromise, not an oversight.** `conventions-reviewer`
   asked for keyboard reachability, since `title` is hover-only. Adding `tabIndex={0}` put a tab
   stop on a non-interactive `<span>`, which Biome's `noNoninteractiveTabindex` rejects — correctly,
   because a dead stop in the keyboard order is its own accessibility problem. The detail is
   instead complete in the accessible name (`"max unavailable: Stat "Aptitude": Undefined
   variable: GONE"`), so assistive technology gets everything. **Residual gap:** a sighted
   keyboard-only user cannot read the chain. Fixing that properly means a persistent-detail
   surface — the provenance tree Concept 00 §7 describes — rather than a focusable marker, so it
   is left for that work instead of being papered over with a lint suppression.

## Acceptance criteria

- [x] The chip is one small component in `components/ui/` (intrinsic styling only, crimson family tokens); feature components place it. ([`ErrorChip.tsx`](../../../src/components/ui/ErrorChip/ErrorChip.tsx) + `.style.ts` + `.test.tsx`, exported from the `ui` barrel. `containerStyles` carries colour, padding, border, radius and its own `inline-flex` for icon-and-label — no margin, width or positioning, which `libraryConventions.test.ts` enforces. Tokens are `bg-crimson/10` and `border-crimson`. The four placements are all in feature components: `StatEditor`, `SkillBreakdownRow`, `CombatSkillsSection`.)
- [x] Sheet component test: one broken stat formula → one chip with the provenance text, all other sections render their numbers. (`CharacterSheet.test.tsx` → "a formula that does not evaluate (TICKET-FORM-06)": five tests — the sheet still renders every section heading rather than an error page; exactly **one** chip exists and its accessible name contains `Stat "Health"` and `Undefined variable: NOPE`; the healthy stat still shows `of 12 max` while the main-skill and speciality totals still show their numbers; a broken *speciality* formula chips both its own total and the combat skill reading it, with the combat chip naming `Speciality Skill "Stealth"` as the cause — the FORM-05 provenance chain end-to-end; and a combat skill whose bonus failed has its `Roll MEL` button disabled. The last two were added after `conventions-reviewer` pointed out those paths shipped untested.)
- [x] The v1.0 bug regression test passes and is kept green through STAT-01's model change. (`CharacterSheet.test.tsx` → "should survive the v1.0 bug: a new stat referencing a code no character has" reproduces the original report — the User adds main skill `WIS` and a stat `WIS * 3` to a ruleset with an existing character — and asserts the sheet still renders, Health still calculates, and exactly one chip appears. *Kept green through STAT-01* is a promise this ticket cannot itself discharge; the test is written against sheet behaviour rather than the v1 shape so STAT-01 inherits it.)
- [x] No raw markup, no stock palette classes; chip text uses the `Text` primitive. (Label renders through `<Text variant="caption">`; the only raw elements are the `<span>` root and the `aria-hidden` glyph, which carry theme classes only. `libraryConventions.test.ts` independently asserts no `bg/text/border-white` and no raw hex anywhere under `components/ui/`.)
- [x] Verified via the `verifier` subagent, the `fallow` skill, and the `coding-conventions` skill. (Suite 790 → 801 passing, 0 failing, 0 skipped; `npx tsc --noEmit` at the documented 4-error baseline; `yarn run check` clean. fallow audit on the diff: 0 complexity, 0 duplication, 0 new dead code. `conventions-reviewer` confirmed the primitive obeys the base-component rules, the `DerivedValue` indirection keeps sections engine-free, and the disabled states are right; its five findings — the chip's accessible name dropping its label, the two untested chip paths, `Requirement 16.6` missing from the four sheet modules' traceability lines, three different ways of discriminating the same union, and `MainSkillsSection` building a `DerivedValue` in JSX — are **all fixed here**. Its keyboard-reachability suggestion is answered in implementation note 4 rather than applied.)
- [x] Verified live in the browser: break a formula in config mode, open a character, see one chip and an otherwise working sheet. (2026-08-04: with the Aptitude stat's formula set to `GONE * 5`, the sheet rendered **one** chip whose `aria-label`/`title` read `Stat "Aptitude": Undefined variable: GONE`, while Main Skills showed Speed 6, Speciality Skills showed Stealth 6, and every section header was present — no error page. Computed style confirmed the theme tokens resolve (`border-color rgb(139, 46, 46)`, a crimson-at-10% background) rather than silently producing an unstyled span. Restoring the formula returned the sheet to zero chips and `of 1 max`. The User's standing instruction this session was to do the browser check.)

## Notes

- Keep it per-value rendering only — config-wide reporting stays with VAL-01's
  `ValidationReport`.
- The chip survives the STAT-03 sheet rework; write it as a primitive, not sheet-specific markup.
