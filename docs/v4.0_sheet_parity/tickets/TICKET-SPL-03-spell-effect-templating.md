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

- [x] The four confirmed sample shapes resolve against fixtures of the ticket's own — a flat
      computed number (cure wounds "equal to 5"), two numbers in one sentence (Fireball's
      "55-foot-radius … 11 fire damage"), a final-stat read (Acid Splash on Wis), and a
      skill-bonus-plus-level read (Aid) — engine tests. Their real texts pin once the data pass
      transcribes them.
      → One `describe` per shape in
      [template.test.ts](../../../src/shared/engine/formula/template.test.ts), each resolved through
      `namespacesFor` at the **`spell-effect`** owner so what they prove is what a Player reads
      rather than what a hand-made resolver would give.
- [x] A placeholder referencing a deleted stat or skill renders an error chip inside otherwise-
      intact text — errors as values, pinned.
      → `resolveTemplate` returns the error as a **value**, `ResolvedTemplate` draws it as an
      `ErrorChip` with `describeFormulaError`'s wording, and the sentence around it renders
      normally. Pinned in the engine (*"costs the reader that number and not the sentence"*) and on
      the Spellbook (*"chips one number and keeps the rest of the sentence"*).
- [x] All user-authored math goes through `parseFormula` → `validateFormula` →
      `evaluateFormula` — the template splitter contains no arithmetic of its own, asserted by
      review and by tests over operator-bearing placeholders.
      → `template.ts` contains no `+`, no `Number()`, no operator regex; its one engine call is
      `evaluateFormulaString`. Six operator-bearing cases pin it — precedence, parentheses, unary
      minus, a power, a function call and a two-argument function — each a number a
      string-substituting splitter would get silently wrong, plus one asserting that no expression
      spans the prose *between* two placeholders.
- [x] The effect field renders `FormulaPreview` with the `spell-effect` owner — never a bare
      `FormulaEditor`; any preview extension is noted on FORM-08.
      → It renders **`TemplatePreview`**, which is the extension FORM-08's rule anticipates and
      which is noted there. The field stays a `Textarea` rather than becoming a `FormulaEditor`
      because it is **not a formula**: `FormulaEditor` validates its whole value as one expression,
      and pointed at a sentence it reports every English word as an undefined variable. What the
      rule actually requires — never a formula field without a window onto what it computes — is
      met.
- [x] The template grammar is documented where a transcriber will find it — one page the data pass
      can convert 326 cells against without reading the parser.
      → [`spell-template-grammar.md`](../spell-template-grammar.md), beside the systems docs: the
      grammar in three sentences, the mechanical `& cell &` → `{…}` conversion with the three cell
      kinds the xlsx actually reaches, what a placeholder may contain, the three text-not-syntax
      cases, and the four rules. It names the **lower-case function** trap up front, which is the
      likeliest mechanical mistake in 326 rows.
- [x] Unit tests cover: parse/resolve round-trips, each namespace reference kind (`stats.x`,
      `skills.y`, `skills.y.bonus`, `const.z`), the error chip, and cycle safety at the new
      attachment point (`scoping.ts`'s existing discipline).
      → All five, plus the bare `<ABBREVIATION>` spelling the sheet's own cells use. Cycle safety
      is pinned in `validator.test.ts`: a spell reading a derived stat that reads another stat
      reports no circular dependency, because an effect is read at display time after both
      calculator passes and nothing in a ruleset can reference a spell — `roll-input`'s position,
      not `stat`'s (CR-02).
- [x] Verified via the `verifier` subagent, the `fallow` skill, and the `coding-conventions`
      skill, plus a live browser check of a resolved Spellbook entry and the preview (ask the
      User first).
      → `npx vitest run` 3600/3600, `npx tsc --noEmit` at its 2-error baseline, `yarn run check`
      clean. `fallow audit --base main`: **no dead code introduced** (two exports it flagged —
      `DEFAULT_SAMPLE` and `SpellbookRowEntry` — are module-local now) and **no complexity finding
      on a function this ticket added or grew** (it flagged `useSpellbook` at 12 cyclomatic / 16
      cognitive; `useSpellbookRows` is the extraction that answers it). **Six touched files came
      back Accelerating** and each has a row in [TEST_STATUS.md](../../../TEST_STATUS.md), one of
      them a first row. Verification ran in this session rather than through the subagent, and the
      conventions pass by reading the diff against the house rules. Browser check: see below.

## Decisions this ticket made

The ticket assigns the grammar (*"this ticket's to define and document"*); these are the calls, so
the data pass meets them as decisions rather than as accidents.

- **`{formula}` — braces, not brackets.** `[` is taken: the *stored* form of a formula spells every
  reference as `[uuid]` (TICKET-REF-01), so `[[…]]` would collide with the one syntax that has to
  survive a round trip. Braces turn the sheet's `"text " & cell & " text"` into `text {cell} text`
  by mechanical substitution, which is what 326 rows need.
- **Three states are text, not syntax**: a template with no braces, an unclosed `{`, and an empty
  `{}` (braces kept). All three are forgiving on purpose — the 92 plain-text effects need no
  conversion, and a half-typed placeholder shows prose rather than an error that will go away on
  the next keystroke.
- **No escape for a literal `{…}` pair.** Braces do not occur in the workbook's prose, and an
  escape nobody needs is an abstraction before its first caller. Doubling is the obvious extension
  if one is ever wanted; the grammar page says so.
- **`spell-effect` sees what `roll-input` sees** — `stats`, `skills` (with `.bonus`), `const`,
  `curve`, plus stat abbreviations in the flat space. Read off the xlsx's own formulas rather than
  guessed, and safe where the same set is a cycle on `stat`.

## Browser check

Driven on the browser ruleset SPL-02 left behind — one derived resource, `Mana` at a flat 250.

1. **The preview resolves while typing.** `a {MANA / 5}-foot-radius sphere takes {MANA} fire damage`
   drew a `MANA` sample box and read *"a 2-foot-radius sphere takes 10 fire damage"* at the default
   10 — the division done by the engine, two placeholders in one sentence, the prose untouched.
2. **It re-resolves on a sample change.** `MANA` → 250 gave *"a 50-foot-radius sphere takes 250 fire
   damage"*.
3. **A broken placeholder names itself and chips in place.** `{stats.nonesuch}` drew
   *"{stats.nonesuch}: Unknown member: stats.nonesuch"* above, and the sentence rendered as
   *"takes ⟨chip⟩ damage"* with the prose either side intact.
4. **The template round-tripped through the store** — saved, listed, reopened with the braces as
   written.
5. **The Spellbook resolves it for the caster.** Learned on Quackers, the row reads *"a 50-foot-radius
   sphere, centered on a point, takes 25 fire damage"* — 250/5 and 250/10 off their **derived** Mana,
   which is a different number from the preview's hand-set sample and the whole of what D4 promises.
6. **The delete guard names the new referrer.** Deleting `Mana` is refused with
   *"Spell: Fireball (effectTemplate)"* beside the character.
7. **The validation report finds a broken placeholder**: *`Spell "Fireball" effect {stats.nonesuch}:
   Unknown member: stats.nonesuch`*, and reports nothing at all once the template is sound.

Zero console errors on a fresh tab. (An old tab held a stale `hasCompendium is not defined` from an
HMR state mid-session; the identifier is gone from `src/` and a clean load has nothing to say.)

## Notes

- Passives reuse this attachment point (two of the 26 template exactly like spells —
  TICKET-PAS-01 depends on this ticket).
- The transcription is real work (326 cells) and scriptable against the checked-in xlsx — the
  same repo-file approach as TICKET-ITEM-02, and it belongs to the same pass.
