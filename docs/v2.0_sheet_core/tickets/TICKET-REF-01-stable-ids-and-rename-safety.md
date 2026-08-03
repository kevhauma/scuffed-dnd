# TICKET-REF-01 — Stable ids and rename-safe formulas

- **Area:** References & identity (new area)
- **Type:** Feature
- **Traceability:** Concept [00 · Field model §6](../../excel%20export%20summary/concepts/00-field-model.md); spec [§3.2](../../excel%20export%20summary/ttrpg-app-spec.md)

## User story

As a User, I want to rename anything — names, abbreviations, codes — without breaking a single
formula, so my ruleset's vocabulary is mine to change.

## Description

The spec's identity rule: references store stable ids and display current names; renaming can
never break anything. The app's formulas store mutable 3-letter codes as raw text with no rename
propagation. This is where the v2.0 decision "every name, abbreviation, formula configurable"
lands. Guarded deletes are the second half — TICKET-REF-02.

## Current situation (as-is)

- Skills have no `id`; the `code` **is** the identity ([`config.ts`](../../../src/types/config.ts)),
  the parser stores the raw token, the evaluator looks it up verbatim — renaming `STR` silently
  invalidates every formula naming it. No rename-propagation code exists anywhere.

## Desired result (to-be)

- Every referenceable entity carries a **stable `id`**; codes/abbreviations become freely
  renamable display data (uniqueness downgraded to a warning).
- **Stored formulas are id-resolved**: the editor reads/writes display syntax (FORM-03), the
  persisted form resolves references to ids; implementation (id-form string vs. stored AST) is the
  implementer's choice — the contract is the rename test.
- **Rename test:** rename any entity's name *and* abbreviation → every formula still validates
  and evaluates to the same numbers, and reopening it in the editor shows the new abbreviation.

## Acceptance criteria

- [ ] All referenceable entities have ids; abbreviation edits are plain data changes.
- [ ] The rename test passes for: a stat in a formula, a constant, a curve, and a link-shaped reference (race on a character, material on an item).
- [ ] Persisted formulas survive renames (round-trip test on stored config JSON).
- [ ] Persistence via store actions only; any reference index is derived, never persisted.
- [ ] Verified via the `verifier` subagent, the `fallow` skill, and the `coding-conventions` skill.
- [ ] Verified live in the browser: rename an abbreviation a formula uses; the dependent value holds and the formula editor shows the new spelling. (Ask the User first per CLAUDE.md.)

## Notes

- Before the entity tickets, so they build on id-references instead of retrofitting.
- Pairs with TICKET-REF-02 (guarded deletes) — same machinery, split for digestibility.
