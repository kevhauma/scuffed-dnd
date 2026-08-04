# TICKET-FORM-04 — Namespace scoping and cycle detection

- **Area:** Formula engine
- **Type:** Feature
- **Traceability:** Concept [00 · Field model §5](../../excel%20export%20summary/concepts/00-field-model.md); v1.0 Req 16.5/16.6 (cycle blocking, preserved)

## User story

As a User, I want each formula to see exactly the namespaces its attachment point provides — and
circular formulas still blocked at save — so the reference rules are data the app enforces, not
folklore per entity kind.

## Description

Which references a formula may use is hardcoded per owner kind today. The spec declares context
by attachment point. This ticket makes that a data table, gives scoping its own validation
errors, and teaches FORM-01's cycle detection to follow namespaced references.

## Current situation (as-is)

- `availableCodesFor` in [`formulaChange.ts`](../../../src/engine/formula/formulaChange.ts)
  hardcodes scope per owner: main codes for stats/speciality, main + speciality for combat.
- [`validator.ts`](../../../src/engine/formula/validator.ts)'s `detectCircularDependencies` walks
  bare-code references only; FORM-03's namespaced nodes would be invisible to it.

## Desired result (to-be)

- A **per-attachment-point namespace table as data** (the Concept 00 §5 table, this milestone's
  slice), consumed by `validateFormula`/`validateFormulaChange`; `availableCodesFor`'s branches
  are replaced, not extended.
- Three distinct, named validation errors: unknown namespace, unknown member, namespace not
  available in this context.
- `detectCircularDependencies` treats namespaced references as graph edges, so save-time cycle
  blocking (FORM-01 behaviour) holds across the new syntax.

## Implementation notes (2026-08-04)

1. **A fourth change was needed to make this ticket's behaviour actually reach the user.**
   [`FormulaEditor`](../../../src/components/ui/FormulaEditor/FormulaEditor.tsx) validated with a
   hand-rolled `/\b[A-Z]{3}\b/g` regex over the raw formula text instead of calling the engine.
   That regex sees a bare `STL` inside `skills.STL` and reported "Undefined variables: STL" next
   to every correct scoping error — so a valid namespaced formula showed a false error, and an
   invalid one showed two errors of which one was nonsense. Confirmed live in the browser before
   and after. It is replaced with a call to `validateFormula`, which also brings the component
   back under the project's "all user-authored math goes through the formula engine" rule. This
   is a regression *surfaced* by this ticket rather than unrelated work, so it is fixed here
   rather than deferred.
2. **The `const` and `curve` namespaces are in scope but empty**, so every member of them reports
   as unknown until TICKET-CST-01 and TICKET-CRV-01 create those entities. That is the honest
   answer while the entity does not exist, and it is pinned by a test.
3. **Scoping rows are this milestone's slice of Concept 00 §5**, not the whole table — a character
   derived field also sees `self`, `equipment`, `archetype`, and `race` in the spec. Listing those
   before they resolve would only let users write formulas that save and then fail.
4. **TICKET-FORM-03's save-then-fail window is narrowed, not closed.** Out-of-scope and
   unknown-member references are now refused at save, which removes most of it. But a reference
   that *is* in scope — `stats.health` in a stat formula — still saves and still throws
   `Unknown namespace: stats` at calculation time, because no calculator supplies a `namespaces`
   resolver map yet. That last piece closes when CST-01/CRV-01/STAT-01 wire resolvers and FORM-05
   turns evaluation failures into error values. Until then the throw is caught by every
   `calculateCharacter` caller, as recorded in FORM-03's note 2.

## Acceptance criteria

- [x] The scoping table is data; no `switch` on owner kind remains for reference scope. (New [`scoping.ts`](../../../src/engine/formula/scoping.ts) holds `NAMESPACE_SCOPES` and `LEGACY_CODE_SCOPES` as `Record<FormulaOwner, …>` literals plus `scopeFor(config, owner)`; `availableCodesFor`'s `if (owner === 'combat-skill')` branch is deleted from `formulaChange.ts`, which no longer decides scope at all. **Both** consumers named in the to-be now read the table: `validateFormulaChange` *and* [`engine/validator.ts`](../../../src/engine/validator.ts), whose three formula loops previously re-hardcoded the same rule and never scope-checked dotted references — caught by `conventions-reviewer`, and now pinned by `validator.test.ts` → "namespace scoping on import (TICKET-FORM-04)", four cases proving the import report and the save guard give the same answer. A `FormulaNamespace` union type links `KNOWN_NAMESPACES`, `NAMESPACE_SCOPES`, and `membersOf` so a mistyped row is a compile error rather than a silent empty member set. `scoping.test.ts` checks both directions: every attachment point has a row, and every known namespace has a member source. **Scoped precisely:** three `change.owner === …` comparisons survive in `formulaChange.ts:55-61`, but they identify *which collection holds the entry being replaced* so the stale one is dropped from the cycle graph — not reference scope. Removing those needs a per-owner collection accessor and belongs with TICKET-STAT-01's reshaping, not here.)
- [x] Each of the three error kinds is produced and named in tests; the save-time guard refuses an out-of-scope namespace. (`formulaChange.test.ts` → "the three scoping errors": `Unknown namespace: wibble`, `Namespace not available here: skills`, `Unknown member: stats.nonexistent`, plus "distinguishes the three from each other in one formula". Verified live in the browser 2026-08-04 — see below.)
- [x] A two-formula cycle written in namespaced syntax is blocked at save with the path shown (FORM-01 parity test). (`formulaChange.test.ts` → "cycle detection across namespaced references": "blocks a two-formula cycle written in namespaced syntax, naming the path" asserts `Circular dependency detected: health → armour → health`; "blocks a self-reference written in namespaced syntax" asserts `health → health`; "catches a cycle that mixes namespaced and bare syntax" proves `skills.STL` and bare `STL` land on one graph node. The shared `dependencyKeysOf` helper is what makes the two spellings converge.)
- [x] Existing bare-code scoping behaviour is unchanged until STAT-01 (regression tests). (`formulaChange.test.ts` → "legacy bare-code scoping is unchanged": a stat may name a main skill but not a speciality code, a speciality skill may not name another speciality code, a combat skill may name both. `scoping.test.ts` asserts the exact code sets per owner against Requirements 2.2/3.3/4.4. The 10 pre-existing `validateFormulaChange` tests pass unedited.)
- [x] Verified via the `verifier` subagent, the `fallow` skill, and the `coding-conventions` skill. (Suite 733 → 762 passing, 0 failing, 0 skipped; `npx tsc --noEmit` at the documented 4-error baseline; `yarn run check` clean. `conventions-reviewer` found the duplicated scope rule in `engine/validator.ts` (finding 1 above), three wrong requirement numbers — the module cited 2.2/3.3/4.4 where the real ones are **3.2** (stat formulas reference main skill codes), **4.3** (speciality bonus formulas reference main skills), **5.4** (combat bonus formulas reference main and speciality skills), verified against `requirements.md` before changing — the unlinked namespace string lists, an unused `FormulaOwner` re-export shim, and two misleading comments. All fixed in this change. fallow: 0 duplication and 0 new dead code after two fixes it prompted — the three duplicated dependency-builder blocks in `engine/validator.ts` were collapsed onto `toFormulaDependency`, and an unused `formulaDependencyKeys` export became the shared `dependencyKeysOf`, which `formulaChange` had been duplicating inline. Browser check 2026-08-04: on `/config/stats`, `stats.nonexistent + wibble.thing + const.divider` produced all three errors at once — "Unknown member: stats.nonexistent", "Unknown namespace: wibble", "Unknown member: const.divider" — and the save was refused with the card keeping its old formula; on `/config/skills`, a speciality skill with `curve.growth(SPD) + 1` produced "Namespace not available here: curve", and one with `skills.STL + 1` produced "Circular dependency detected: STL → STL" **with the spurious "Undefined variables: STL" gone** after implementation note 1's fix.)

## Notes

- Pairs with TICKET-FORM-03 (syntax/resolution); build directly after it.
- New attachment points added by later tickets (constants-as-formulas, curve generators, roll
  inputs) each add a *row* to the table — that being cheap is this ticket's success measure.
