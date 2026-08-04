# TICKET-FORM-03 — Namespaced reference syntax and resolution

- **Area:** Formula engine
- **Type:** Feature
- **Traceability:** Concept [00 · Field model §5](../../excel%20export%20summary/concepts/00-field-model.md); spec [§5.1](../../excel%20export%20summary/ttrpg-app-spec.md)

## User story

As a User, I want formulas to reference things by kind — `stats.speed`, `skills.healing.level`,
`const.bonus_divider` — so one formula language reaches every part of the ruleset instead of a
flat set of skill codes.

## Description

A formula's whole world today is a flat `Record<code, number>`. This ticket adds dotted,
namespaced references and resolver-based contexts. Scoping rules and cycle detection are
TICKET-FORM-04; this lands green with legacy bare codes still working.

## Current situation (as-is)

- A variable is any `[A-Za-z]+` run, uppercased ([`parser.ts`](../../../src/engine/formula/parser.ts));
  `.` is an "Unexpected character" error.
- The evaluation context is `{ variables: Record<string, number> }`
  ([`types/formula.ts`](../../../src/types/formula.ts)) — one flat lookup, no kinds.

## Desired result (to-be)

- Dotted syntax: `namespace.member` and `namespace.member.property`
  (`skills.healing.level` / `.bonus`), plus the call shape `curve.name(x)` (parse only —
  evaluation arrives with TICKET-CRV-01).
- The evaluation context becomes a set of **namespace resolvers** (`stats`, `skills`, `const`,
  `curve`) supplied by callers; the engine defines the shape, calculators build concrete contexts.
- Legacy bare references (`STR`) still resolve via the flat variables — marked deprecated in the
  grammar doc, removed by TICKET-STAT-01.

## Implementation notes (2026-08-04)

Recorded while building, so the boxes below aren't read as more than they are.

1. **No calculator builds a namespace context yet.** The to-be says "the engine defines the shape,
   calculators build concrete contexts"; only the first half is done. `FormulaContext.namespaces`
   is optional and every existing caller still passes `{ variables }` alone. Wiring real resolvers
   is deferred on purpose — the namespaces worth resolving (`const`, `curve`, the unified `stats`)
   are entities that don't exist until CST-01, CRV-01, and STAT-01, and building resolvers over the
   v1 shape now would be thrown away by STAT-01's clean break.
2. **A namespaced formula can be saved but not yet evaluated — a known window, accepted for two
   tickets.** Before this ticket `stats.speed` was a parse error, so `FormulaEditor` refused it at
   save time. Now it parses and validates (scoping is FORM-04's job), so `validateFormulaChange`
   accepts it and it persists — then `calculateMaxStatValues` throws `Unknown namespace: stats`
   when the sheet next computes. **It degrades rather than crashes**: every caller of
   `calculateCharacter` already catches evaluation throws — [`useCharacterSheet.ts:126`](../../../src/components/play/sheet/useCharacterSheet.ts:126)
   turns it into a message on the sheet, [`characterStore.ts:83`](../../../src/stores/characterStore.ts:83)
   falls back to unclamped values, and [`useCharacterCreation.ts:146`](../../../src/components/play/creation/useCharacterCreation.ts:146)
   does the same during the wizard. FORM-04's scoping table closes the window by refusing the save;
   FORM-05/FORM-06 replace the message with a proper error value and chip. Flagged rather than
   patched here because a stopgap in `statCalculator` would be deleted by FORM-05.
   (An earlier draft of this note claimed there was no error boundary and the throw reached
   TanStack's catch screen — that was wrong, corrected after `conventions-reviewer` checked the
   call sites.)
3. **Identifiers now accept digits and underscores** (`const.bonus_divider`, `STR2`), where the
   tokenizer previously took letters only. Bare `STR2` used to be a parse error and is now a
   variable named `STR2`; no existing formula or test depended on the rejection.

## Acceptance criteria

- [x] `ns.member`, `ns.member.prop`, and mixed expressions (`stats.str * 2 + const.base`) parse to namespaced reference nodes; `curve.name(x)` parses. (`parser.test.ts` "Namespaced references (TICKET-FORM-03)" — "should parse a two-segment reference", "should parse a property access as the third segment", "should parse namespaced references inside expressions", "should parse a namespaced call", "should parse expression arguments in a namespaced call"; nodes are `NamespacedRefNode` / `NamespacedCallNode` in `src/types/formula.ts`)
- [x] Evaluation resolves through the supplied resolvers; unknown member is a distinct error from a plain undefined variable. (`evaluator.test.ts` "resolves each namespace" and "reports an unknown member distinctly from an undefined variable" — asserts `Unknown member: stats.nope` against `Undefined variable: XYZ` in the same test; `Unknown namespace: nope` is a third distinct message. Resolver shape is `NamespaceResolver` on `FormulaContext.namespaces` — see implementation note 1: no calculator supplies one yet.)
- [x] Legacy bare-code formulas parse, validate, and evaluate exactly as before (existing suite untouched and green). (`git diff --numstat` on the three formula test files shows insertions and **0 deletions** — pure appends, no existing case edited. Full suite 703 → 733 passing, 0 failing, 0 skipped. One deliberate widening of legacy behaviour is pinned by "should take digits and underscores into a bare identifier": `STR2` was a tokenizer error and is now a variable — see implementation note 3.)
- [x] Unit tests cover: each namespace resolving, unknown member, property access, mixed legacy/namespaced formulas. (`evaluator.test.ts` covers all four — `stats`/`skills`/`const` each resolving, `skills.healing.bonus` property access, `STR + stats.speed` mixing, plus unknown member/property/namespace and a missing-`namespaces`-map case; `validator.test.ts` "Namespaced references (TICKET-FORM-03)" adds that namespace segments never enter `referencedVariables` and so are never misreported as undefined codes.)
- [x] Verified via the `verifier` subagent, the `fallow` skill, and the `coding-conventions` skill. (verifier: 732/0/0 tests, tsc at the documented 4-error baseline with the `evaluator.ts` pair not shifted or multiplied, `yarn run check` clean. fallow audit flagged a 20-line clone between `validator.ts`'s two AST traversals — real, and introduced by this ticket extending both with the same arms — fixed by collapsing them onto one `walkFormula(ast, visit)` helper, after which the clone group is gone; the remaining `evaluateFormula` complexity hotspot (23 cyclomatic) is left for FORM-05, which rewrites that function. conventions-reviewer: found no behavioural violations — layering, the parse→validate→evaluate rule, exhaustiveness and the data model all clean — and three documentation findings, all fixed in this same change: the `Validates:` traceability lines on `evaluator.ts`/`validator.ts` now cite Concept 00 §5 and spec §5.1, the two stale local JSDoc blocks in `parser.ts` (`factor`, `parseIdentifier`) were rewritten, and the `project-map`/`data-model` skills were updated. It also caught a factual error in implementation note 2, corrected there. Browser check 2026-08-04 on `/config/stats`: `max(1, round(stats.speed / 30))` saved and persisted without a parse error, the sample-value preview correctly hid itself because the formula references no legacy codes, and no engine error appeared in the console; formula then restored to the bare-code form and the preview returned with SPD 45 → 2.)

## Notes

- Members are written as abbreviations/identifiers in the editor; the rename-safe *storage* form
  is TICKET-REF-01's concern — don't invent a storage answer here.
- Spec contexts `self`/`owner`/`caster`/`family`/`tier` arrive with the concepts that need them,
  in later milestones.
