# TICKET-CST-01 — Constants concept (`const.*`)

- **Area:** Constants configuration (new area)
- **Type:** Feature
- **Traceability:** Concept [05 · Constant](../../excel%20export%20summary/concepts/05-constant.md)

## User story

As a User, I want named tunable numbers — `bonus_divider`, `apt_value` — that formulas reference
by name, so rebalancing is editing one value, not hunting magic numbers through formula strings.

## Description

The entity and its formula resolution. The editor panel is TICKET-CST-02. Four later tickets
(SKL-02, RACE-02, RES-02, ARC-02) read named constants; this gives them somewhere to live.

## Current situation (as-is)

- No constant entity, no `const` namespace backing. [`Configuration`](../../../src/types/config.ts)
  has two loose scalars (`focusStatBonusLevel`, `mainSkillPointBudget?`) — both retired later by
  ARC-03/RES-02 — and every other tunable lives inline in formula strings.
- FORM-03 parses `const.x` with nothing behind it.

## Desired result (to-be)

- `Constant` entity: `{ id, name (identifier), displayName, description (required — the spec's
  rule), value: number, unit? }`, with CRUD store actions persisting like every config mutation.
- `const.<name>` resolves in evaluation; an unknown constant is a named validation error;
  REF-01 rename-safety applies to the identifier.
- Fresh-configuration seeds with their concept-page descriptions: `bonus_divider = 5`,
  `apt_value = 30`, `points_per_level = 3`, `race_blend_divisor = 2`; export/import shape
  validation covers the entity.

## Implementation notes (2026-08-05)

Recorded while building, so the boxes below aren't read as more than they are.

1. **`Configuration.constants` is optional, and absent stays absent.** A ruleset written before
   this ticket loads unchanged and round-trips without growing an empty array — the same treatment
   `mainSkillPointBudget` gets. Readers write `config.constants ?? []`.
2. **This is the first namespace with a real resolver.**
   [`constantsNamespace`](../../../src/engine/formula/constants.ts) is what the three
   formula-evaluating calculators now pass as `namespaces.const`, closing FORM-03's known window
   for `const.*` specifically — `stats.*`, `skills.*` and `curve.*` still evaluate to
   `unknown-namespace` until STAT-01 and CRV-01. The module is deliberately the exemplar those
   tickets copy.
3. **Constants-as-formulas is deferred**, as the ticket's own note says: `value` is a plain number,
   no seed needs otherwise, and the extension brings a cycle-detection problem that belongs with
   `validator.ts`'s existing detector rather than a second one. The extension point is documented
   on the `Constant` type and in the module JSDoc.
4. **The identifier rule is enforced at the import boundary, not yet in a form.** `name` must match
   `^[a-z][a-z0-9_]*$` and be unique, checked by `validateConfiguration` because import is
   untrusted input. There is no panel yet — TICKET-CST-02 builds it, and that form is where the
   same rule has to be enforced for User input. Until then a constant can only be created
   programmatically, so the gap is not reachable from the UI. Flagging it so CST-02 does not
   treat its form validation as belt-and-braces.
5. **The reference walker became namespace-aware** because constants made an existing latent
   collision material: `dependencyKeysOf` flattens `stats.bonus_divider` and `const.bonus_divider`
   to the same bare key, so a stat slugged like a constant would have blocked the constant's
   delete and vice versa. Matching now keeps the namespace.

## Acceptance criteria

- [x] CRUD round-trips LocalStorage via store actions; export → import preserves constants. (`configStore.test.ts` "adds, updates and deletes through the store, persisting each time" — `addConstant`/`updateConstant`/`deleteConstant` each call `saveConfiguration`, three times in all, and nothing outside the store touches storage; `deleteConstant` reuses TICKET-REF-02's `guardedDelete`, so "refuses to delete a constant a formula names, and says which" holds too. `importExport.test.ts` "survives export then import, formula and all" — the exported JSON holds `10 / const.[id-div]` and re-importing returns the configuration unchanged, constants included.)
- [x] A formula using `const.bonus_divider` evaluates against the configured value; changing it changes dependents on next read (test through the engine). (`constants.test.ts` "resolves a constant by name", "is usable in an expression, alongside the function library" (`max(1, round(60 / const.apt_value))` → 2), and "reads the value it is given, so retuning changes every dependent". End to end through `calculateCharacter`: `integration.test.ts` "moves every dependent value when a constant is retuned (TICKET-CST-01)" — `apt_value` 30 → 20 moves the derived stat 2 → 3 on the next read with nothing stored, while a stat naming no constant is untouched.)
- [x] Unknown-constant reference is a named validation error; renaming the identifier breaks no formula (REF-01 test applied). (**Unknown:** `constants.test.ts` "reports an unknown constant as a named error rather than zero" — `Unknown member: const.nope`, distinct from an undefined variable — plus "refuses a property access — a constant is a single number" and "treats no constants as every constant being unknown". At save time, `scoping.ts`'s `membersOf` now supplies the constant names, so `validateFormulaChange` refuses a formula naming a constant that does not exist, and `engine/validator.ts` reports it on import. **Rename:** `configStore.test.ts` "re-spells every formula naming a constant when its identifier is renamed" — `bonus_divider` → `bonus_scale` rewrites `10 / const.bonus_divider` to `10 / const.bonus_scale` while the persisted form keeps the id, which is REF-01's `applyRenameSafely` applied to the new entity.)
- [x] The four seeds exist in a fresh config with descriptions. (`configStore.test.ts` "seeds a fresh configuration with the concept-page constants, each described" — `apt_value`, `bonus_divider`, `points_per_level`, `race_blend_divisor` with values 5/30/3/2, every one carrying a non-empty description and an id. `createFreshConfiguration` was renamed from `createEmptyConfiguration` because it is no longer empty.)
- [x] Verified via the `verifier` subagent, the `fallow` skill, and the `coding-conventions` skill. (**898 passing, 0 failing, 0 skipped** (from 880), `npx tsc --noEmit` at the documented 4-error baseline, `yarn run check` clean over 231 files. fallow: 0 introduced complexity findings, 0 introduced dead code, 0 introduced duplication. conventions-reviewer: layering, purity, store-owned persistence, derived-vs-stored, formula-engine-only math and the persisted-shape rules all clean, plus seven findings — all fixed here: the `Constant` JSDoc claimed a normalisation that does not happen; the two knowledge skills and the overview line were stale; duplicate names split identity from value (`constantsNamespace` was last-wins where the reference index is first-wins — now both first-wins, and `validateConfiguration` rejects a duplicate); `StatCard`'s formula preview was the one evaluation site not given the resolver, so a `const.*` stat would have previewed blank in Configuration mode while computing correctly on the sheet; the walker's reference match was namespace-blind (implementation note 5); `validateConfiguration` omitted `displayName` and did not say why it omits `id`; and `createEmptyConfiguration` no longer described what it built. The identifier-rule gap is recorded as implementation note 4 rather than closed here.)

## Notes

- Constants-as-formulas (spec allows it) deferred — no seed needs it; note the extension point in
  module JSDoc.
- `points_per_level` is seeded but unread until RES-02 — a constant is data, not behaviour.
