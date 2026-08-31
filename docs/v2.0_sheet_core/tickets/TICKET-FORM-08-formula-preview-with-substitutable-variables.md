# TICKET-FORM-08 — Formula preview with substitutable variables

- **Area:** Formula engine (authoring UI)
- **Type:** Feature
- **Traceability:** Concept [00 · Field model §5](../../excel%20export%20summary/concepts/00-field-model.md);
  Requirements 3.1–3.3, 16.4, 21.1–21.7

## User story

As a User, I want to see what a formula actually produces — at values I choose and across a spread
of levels — while I am writing it, so I can tell a working formula from a plausible-looking one
before I save it.

## Description

Every formula in the ruleset is a string the User types and then has to imagine the output of.
`STR * 0.2 + CHA * 0.1` is not obviously "about 6 for a Char-heavy character" until something
evaluates it. This ticket builds one preview component — sample values you can set, plus a ladder
showing the result as the inputs scale — and puts it under the stat formula field. TICKET-FORM-09
takes it to the rest.

## Current situation (as-is)

- **One surface has a preview, and it is on the wrong side of the edit.**
  [`StatCard`](../../../src/components/config/stats/StatCard.tsx) evaluates the saved formula with
  a `sampleValues` map (every referenced variable defaulted to 10), renders a number-input per
  variable and one "Calculated Value". It reads a formula you have already committed; while you are
  typing one in [`StatFormDialog`](../../../src/components/config/stats/StatFormDialog.tsx) there
  is nothing.
- **Everywhere else there is no preview at all.**
  [`FormulaEditor`](../../../src/components/ui/FormulaEditor/FormulaEditor.tsx) — the shared input
  behind all four formula fields — validates syntax and offers completions, and stops there.
- The engine already has every piece: `validateFormula` returns `referencedVariables` and
  `namespacedReferences`; `evaluateFormulaString` takes `{ variables, namespaces }`; `asNumber`
  turns an error value into "no number" instead of a throw;
  [`scopeFor`](../../../src/engine/formula/scoping.ts) / `namespacesFor` answer *which* references
  a formula at a given `FormulaOwner` may make. `StatCard` wires them together by hand — that
  wiring is what has no home.

## Desired result (to-be)

- A **`FormulaPreview` feature component** rendering, for a formula and a `FormulaOwner`:
  - one editable sample value per referenced variable (default 10), and the single result for
    exactly those values;
  - a **level ladder** — 1, 2, 3, 4, 5, 10, 15, 20, 50 — one row each, showing the result with
    **every referenced variable set to that level**, so the shape of the formula is visible at a
    glance;
  - nothing at all when the formula is empty, and the validator's message instead of numbers when
    it does not parse.
- **`StatFormDialog` renders it live** beneath the formula field, scoped through
  `scopeFor(config, 'stat')` / `namespacesFor(source, 'stat')` so `const.*` and `curve.*(x)`
  resolve exactly as they will at play time.
- **`StatCard`'s inline preview is removed.** A card shows the formula; the dialog shows what it
  does. One preview, one place, no second copy of the wiring to drift.

## Acceptance criteria

- [x] `FormulaPreview` lives in `components/config/shared/`, composes `ui/` primitives (`Input`,
      `Label`, `Text`, `Card`) and owns its own layout; ~~no raw `<input>`/`<table>` controls~~
      **no raw form controls** — the ladder *is* a raw `<table>`, see the amendment below — no base
      component gains a margin. Theme tokens only. (`src/components/config/shared/FormulaPreview.tsx`
      plus its `FormulaPreview.style.ts`, barrelled in that folder's `index.ts`; `yarn run check`
      clean and the conventions review confirmed the base-component contract holds.)
- [x] Sample values are supplied to the evaluator as **both** `variables` and `statValues` on the
      `NamespaceSource`, so a formula written `STR` and one written `stats.strenght` preview from
      the same box rather than disagreeing. (`evaluateAt` in `FormulaPreview.tsx` maps each
      abbreviation to its stat id; `FormulaPreview.test.tsx` → "should read a dotted stat reference
      from the same box as its bare abbreviation" — `STR + stats.strength` renders **one**
      spinbutton, and setting it to 7 gives 14.)
- [x] The ladder rows are 1, 2, 3, 4, 5, 10, 15, 20, 50 with every referenced variable at that
      level; a formula with no variables (`const.apt_value * 2`) shows its constant result and no
      ladder. (`FormulaPreview.test.tsx` → "should walk the nine ladder levels…" asserts all nine
      pairs for `STR * 0.2 + CHA * 0.1`, and "should show a constant-only formula as one result
      with no ladder" asserts 60 with no ladder and no boxes.)
- [x] All arithmetic goes through `evaluateFormulaString`; a value that is not a number renders as
      the validator's message or a dash, never `NaN`, never a silent `0`. (`formatResult` is the
      only formatter and it goes through `asNumber`; `FormulaPreview.test.tsx` → "should show a
      dash rather than NaN…" (`STR / 0`) and "should name an undefined variable rather than
      pretending it is zero".)
- [x] `StatFormDialog` shows the preview as the User types, and it survives an unparseable
      intermediate state (`STR *`) without unmounting the field or losing focus.
      (`StatsConfigPanel.test.tsx` → "should preview the formula as the User types it
      (TICKET-FORM-08)" and "should survive an unparseable intermediate state without losing the
      field" — the second asserts `document.activeElement` is still the formula field across
      `STR *` and then reads 30 for `STR * 3`.)
- [x] `StatCard` no longer evaluates anything — the engine imports and `sampleValues` state are
      gone from it, and its test no longer asserts a calculated value. (`StatCard.tsx` imports only
      `Stat` and three `ui/` primitives now; `StatCard.test.tsx` → "should compute nothing — the
      formula is shown, not evaluated (TICKET-FORM-08)" locks it shut.)
- [x] Unit tests cover: the ladder's nine rows for `STR * 0.2 + CHA * 0.1`; a changed sample value
      changing the single result; an invalid formula showing the error and no numbers; a
      no-variable formula rendering without a ladder; `const.*` resolving from the configuration.
      (All five in `FormulaPreview.test.tsx`, 12 tests total — plus empty/whitespace rendering
      nothing at all, and the ladder holding steady when a sample box changes.)
- [x] Verified via the `verifier` subagent, the `fallow` skill, and the `coding-conventions` skill.
      (1183 passing / 0 failing / 0 skipped, tsc at the documented 2-error baseline, `yarn run
      check` clean. `fallow review`: no unused exports. conventions-reviewer's findings applied —
      the `21.1-21.7` traceability trimmed to `21.1-21.5`, `previewInputs`' JSDoc corrected to its
      real signature, the redundant `aria-label` dropped so the `Label`/`useId` association is the
      accessible name, `StatCard`'s stale `3.2` citation dropped, and `useStatManager` now takes
      its available codes from `scopeFor` so the editor and the preview cannot drift — see
      implementation notes 1 and 2 for the two it raised that were kept as-is.)
- [ ] Verified live in the browser: open a stat's edit dialog, type `STR * 0.2 + CHA * 0.1`, set
      STR and CHA, and read both the single result and the nine ladder rows. — **not run**: the
      User asked for no browser verification on this run. Left open rather than ticked.

## Notes

- **No requirement covers a formula preview.** The closest are 3.3 and 16.4, which are about
  *validating* a formula rather than showing its output. Proposed wording for a future
  requirements pass: *THE Application SHALL show the User the value a formula produces, for sample
  input values the User controls, before the formula is saved.* Cited here as a proposal, not as an
  existing number.
- **The ladder sweeps every variable together on purpose** (User decision, 2026-08-09). Per-variable
  columns and a pick-one-variable dropdown were both considered; scaling everything at once answers
  "is this formula roughly the right size" in one read, and the editable boxes answer the exact
  case. If a per-variable view is wanted later it is an addition to this component, not a redesign.
- **Placement is the dialog only** (User decision, 2026-08-09) — hence the removal from `StatCard`
  rather than a second preview living beside it.
- The ladder is a fixed list, not configurable. It is display-only, so a User who wants a different
  point just types the value into the sample box.
- Curve generators reference `key` rather than stat codes, and the `stats` namespace has no
  resolver without `statValues`. Both are TICKET-FORM-09's problem; keep `FormulaPreview` taking a
  `FormulaOwner` and a `NamespaceSource` so that ticket is a wiring change, not a rewrite.

## Implementation notes

1. **`FormulaPreview` takes a `Configuration`, not a `NamespaceSource`** — a divergence from the
   last note above, and TICKET-FORM-09 should plan against this shape. Two things need more than
   a `NamespaceSource`: `scopeFor(config, owner)` requires the whole ruleset to build its member
   sets, and mapping a dotted `stats.strength` back to the `STR` box requires `config.stats`. The
   `NamespaceSource` is still what reaches the engine — it is assembled inside the component,
   `{ ...config, statValues }` — so FORM-09 remains a wiring change: pass a different `owner`, get
   a differently scoped preview. What FORM-09 will have to add is `key` for `curve-generator`,
   which is a context code rather than a namespace and has no home in either prop today.
2. **The dialog shows a parse error twice**, once from `FormulaEditor`'s own inline message and
   once from the preview — in all four dialogs as of TICKET-FORM-09, which asserts the duplication
   rather than leaving it to surprise someone. Left as-is: silencing the editor's half means
   changing a base primitive four dialogs share, and the right fix is to give `FormulaEditor` a
   `FormulaScope` so it stops needing its own weaker check at all. The two can
   no longer *disagree* about bare codes — `useStatManager` now feeds the editor the same
   `scopeFor` set the preview validates against — but the editor still has no `FormulaScope`, so
   `const.typo` is silent there and reported here. That gap closes when FORM-09 gives the editor
   a scope.
2b. **The preview resolves `skills.*` as of TICKET-SKL-02** — the third change to this component,
   recorded here under the same rule. `skills` was in scope for a combat formula from FORM-04 on
   but had no resolver, so `STR + skills.stealth` previewed as `Unknown namespace` once SKL-02 made
   it a real reference. The component now runs the sample stat values through `calculateSkills`,
   the same function the sheet reads, and passes `skillLevels` / `skillBonuses` into
   `namespacesFor`. **Skills get no sample boxes of their own**, deliberately: a skill's level is
   `Σ(weight × stat) + invested`, so once the stats are chosen the levels are decided and a box
   could only disagree with them. The character handed to the calculator has invested nothing —
   the preview's claim is about the ruleset, not about one Player's allocation.
3. **The ladder does not react to the sample boxes**, by design: the boxes answer "what does this
   give for *my* character", the ladder answers "what shape is this formula". Asserted, so nobody
   later "fixes" it — `FormulaPreview.test.tsx` → "should leave the ladder alone when a sample
   value changes".
4. **Sheet-import fragment: nothing to land.** Authoring UI only; no persisted shape changed.

### Later changes to this component (recorded here, per FORM-09's rule)

- **TICKET-FORM-09 added the structural-error line.** When the result is an `unknown-namespace` or
  `unknown-member` error, the preview shows that message once in place of the single result and
  suppresses the ladder — a `skills.*` reference has no resolver until SKL-02 and will not acquire
  one at level 15, so nine identical dashes say nothing. **Exactly those two kinds.**
  `division-by-zero`, `out-of-range`, `upstream` and `not-evaluable` all vary with the inputs —
  `not-evaluable` is what an overflow and a curve with no value at one key produce — and
  collapsing on those would hide the levels where the formula works. `FormulaPreview.test.tsx` →
  "a reference nothing can resolve (TICKET-FORM-09)" pins both halves.
- **The ladder is a `<table>`** (User request, 2026-08-09), which **amends the first acceptance
  criterion above**: it forbade a raw `<table>`, and the ladder now is one, with a sibling
  `FormulaPreview.style.ts` following `CurveGrid`'s precedent. The criterion was written to keep
  raw *controls* out of a feature component; a nine-row list of levels and values is tabular data,
  and marking it up as a grid of divs was the mistake. Each row's level is a `<th scope="row">`, so
  a screen reader reads "15, 4.5" rather than two loose numbers. The result column is headed
  **Value**, not Result, so it does not collide with the single-result row's own label. The ban on
  raw form controls stands — the sample boxes are still `ui/Input`.
- **TICKET-FORM-09 also made the sample boxes swallow Enter.** They sit inside the owning dialog's
  `<form onSubmit={onSave}>`, so pressing Enter while typing a sample value saved the entity. A
  bug this ticket introduced with `StatFormDialog` and FORM-09 multiplied by three before fixing
  it in the one place it belongs.

- **TICKET-SPL-03 extended it, which is what this ticket's standing rule asks for.** *Every field a
  User types a formula into ships a preview* met a field that is **not a formula**: a spell effect
  is prose with `{placeholders}` in it (v4 D4), so its preview shows one resolved **sentence** where
  this one shows one number and a nine-level ladder. Nine sentences in a table answers nothing that
  one does not.
  - The extension is a **sibling component**, `config/shared/TemplatePreview.tsx`, rather than a
    flag on this one. A boolean selecting between two renderings would be a prop named after one
    caller, which the house rules refuse.
  - **What they share is shared**: the sample boxes, the skill derivation and the evaluation moved
    to `config/shared/formulaSamples.ts` (`previewInputs`, `useFormulaSamples`) and
    `config/shared/SampleInputs.tsx`. Both previews compute their numbers there, so there is no
    second evaluator and the two cannot disagree about what a stat at 10 gives. **No test of this
    component changed**, which is the evidence the split was behaviour-preserving.
  - The effect field stays a `Textarea` rather than becoming a `FormulaEditor`: that primitive
    validates its whole value as one expression and, pointed at a sentence, reports every English
    word as an undefined variable. *Never a bare `FormulaEditor`* means *never a formula field
    without a window onto what it computes*, and `TemplatePreview` is that window.
