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

- [ ] `FormulaPreview` lives in `components/config/shared/`, composes `ui/` primitives (`Input`,
      `Text`, `Card`) and owns its own layout; no raw `<input>`/`<table>` controls, no base
      component gains a margin. Theme tokens only.
- [ ] Sample values are supplied to the evaluator as **both** `variables` and `statValues` on the
      `NamespaceSource`, so a formula written `STR` and one written `stats.strenght` preview from
      the same box rather than disagreeing.
- [ ] The ladder rows are 1, 2, 3, 4, 5, 10, 15, 20, 50 with every referenced variable at that
      level; a formula with no variables (`const.apt_value * 2`) shows its constant result and no
      ladder.
- [ ] All arithmetic goes through `evaluateFormulaString`; a value that is not a number renders as
      the validator's message or a dash, never `NaN`, never a silent `0`.
- [ ] `StatFormDialog` shows the preview as the User types, and it survives an unparseable
      intermediate state (`STR *`) without unmounting the field or losing focus.
- [ ] `StatCard` no longer evaluates anything — the engine imports and `sampleValues` state are
      gone from it, and its test no longer asserts a calculated value.
- [ ] Unit tests cover: the ladder's nine rows for `STR * 0.2 + CHA * 0.1`; a changed sample value
      changing the single result; an invalid formula showing the error and no numbers; a
      no-variable formula rendering without a ladder; `const.*` resolving from the configuration.
- [ ] Verified via the `verifier` subagent, the `fallow` skill, and the `coding-conventions` skill.
- [ ] Verified live in the browser: open a stat's edit dialog, type `STR * 0.2 + CHA * 0.1`, set
      STR and CHA, and read both the single result and the nine ladder rows.

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
