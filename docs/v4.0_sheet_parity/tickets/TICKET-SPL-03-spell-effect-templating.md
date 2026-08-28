# TICKET-SPL-03 — Spell effect templating

- **Area:** Spells / formula engine
- **Type:** Feature
- **Traceability:** System [13 · Spells](../systems/13-spells.md) (gap 4); overview
  [D4](../overview.md#d4--spell-effect-text-goes-through-the-formula-engine) (one engine, no
  second evaluator). **Needs TICKET-SPL-01** (the entity) and TICKET-SPL-02 (the Spellbook that
  renders resolved text).

> **Scope (overview [D7](../overview.md#d7--seeded-values-and-formula-text-are-a-separate-issue-user-2026-08-29)):**
> the transcription is formula text, so it is the data pass's — and it is the single biggest reason
> that pass wants a script. It owes this ticket 326 of the 418 effect cells converted from the
> xlsx's `"text " & cell & " text"` concatenation into this ticket's template syntax, each citing
> its cells, the 92 plain-text effects untouched, the `#VERW!` row left an empty template, and the
> Fireball seam (the sheet's own missing text fragment) recorded as-is.

## User story

As a Player, I want my Fireball to read "a 55-foot-radius sphere … takes 11 fire damage" *for my
caster* — numbers computed from my stats and skills — so effects scale the way the sheet's
formulas scale them.

## Description

The D4 attachment point: placeholders inside `effectTemplate` evaluated per caster by the one
formula engine. 326 of the 418 effect cells are live formulas in the xlsx — string concatenation
around engine cells referencing final stats, skill levels and skill **bonuses** — and this ticket
transcribes them into template syntax. No second evaluator, no regex arithmetic.

## Current situation (as-is)

- `effectTemplate` (TICKET-SPL-01) holds raw captured text; nothing evaluates it. The Spellbook
  (TICKET-SPL-02) renders it verbatim.
- Attachment points live in [scoping.ts](../../../src/shared/engine/formula/scoping.ts) — each
  names the namespaces a formula there may read; skills already expose `.bonus` reading
  (TICKET-SKL-02's surface).
- Every User-authored formula field ships
  [FormulaPreview](../../../src/client/components/config/shared/FormulaPreview.tsx) with its
  `FormulaOwner` (TICKET-FORM-08/09) — the standing rule this field must follow.

## Desired result (to-be)

- **A `spell-effect` attachment point** in `scoping.ts`: template text with embedded formula
  placeholders, each placeholder parsed → validated → evaluated by the one engine, with the
  `stats` / `skills` (including `.bonus`) / `const` / `curve` namespaces — the confirmed
  reference set. Errors are values: an unresolvable placeholder chips, the way every formula
  error already renders.
- **Editing and rendering**: the panel's effect field is `FormulaEditor` + `FormulaPreview` with
  the `spell-effect` `FormulaOwner` (editable sample values plus the level ladder — if the
  preview cannot express template-in-text, **extend the component and note it on FORM-08**, never
  a second evaluation); the Spellbook renders the resolved text per caster.
- **A syntax the transcription can target**: the template grammar is this ticket's to define and
  document, chosen so the sheet's `"text " & cell & " text"` shape converts mechanically — the data
  pass writes 326 of them against it, so an awkward grammar is 326 awkward rows.

## Acceptance criteria

- [ ] The four confirmed sample shapes resolve against fixtures of the ticket's own — a flat
      computed number (cure wounds "equal to 5"), two numbers in one sentence (Fireball's
      "55-foot-radius … 11 fire damage"), a final-stat read (Acid Splash on Wis), and a
      skill-bonus-plus-level read (Aid) — engine tests. Their real texts pin once the data pass
      transcribes them.
- [ ] A placeholder referencing a deleted stat or skill renders an error chip inside otherwise-
      intact text — errors as values, pinned.
- [ ] All user-authored math goes through `parseFormula` → `validateFormula` →
      `evaluateFormula` — the template splitter contains no arithmetic of its own, asserted by
      review and by tests over operator-bearing placeholders.
- [ ] The effect field renders `FormulaPreview` with the `spell-effect` owner — never a bare
      `FormulaEditor`; any preview extension is noted on FORM-08.
- [ ] The template grammar is documented where a transcriber will find it — one page the data pass
      can convert 326 cells against without reading the parser.
- [ ] Unit tests cover: parse/resolve round-trips, each namespace reference kind (`stats.x`,
      `skills.y`, `skills.y.bonus`, `const.z`), the error chip, and cycle safety at the new
      attachment point (`scoping.ts`'s existing discipline).
- [ ] Verified via the `verifier` subagent, the `fallow` skill, and the `coding-conventions`
      skill, plus a live browser check of a resolved Spellbook entry and the preview (ask the
      User first).

## Notes

- Passives reuse this attachment point (two of the 26 template exactly like spells —
  TICKET-PAS-01 depends on this ticket).
- The transcription is real work (326 cells) and scriptable against the checked-in xlsx — the
  same repo-file approach as TICKET-ITEM-02, and it belongs to the same pass.
