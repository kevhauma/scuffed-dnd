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

## Acceptance criteria

- [ ] `ns.member`, `ns.member.prop`, and mixed expressions (`stats.str * 2 + const.base`) parse to namespaced reference nodes; `curve.name(x)` parses.
- [ ] Evaluation resolves through the supplied resolvers; unknown member is a distinct error from a plain undefined variable.
- [ ] Legacy bare-code formulas parse, validate, and evaluate exactly as before (existing suite untouched and green).
- [ ] Unit tests cover: each namespace resolving, unknown member, property access, mixed legacy/namespaced formulas.
- [ ] Verified via the `verifier` subagent, the `fallow` skill, and the `coding-conventions` skill.

## Notes

- Members are written as abbreviations/identifiers in the editor; the rename-safe *storage* form
  is TICKET-REF-01's concern — don't invent a storage answer here.
- Spec contexts `self`/`owner`/`caster`/`family`/`tier` arrive with the concepts that need them,
  in later milestones.
