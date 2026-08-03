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

## Acceptance criteria

- [ ] CRUD round-trips LocalStorage via store actions; export → import preserves constants.
- [ ] A formula using `const.bonus_divider` evaluates against the configured value; changing it changes dependents on next read (test through the engine).
- [ ] Unknown-constant reference is a named validation error; renaming the identifier breaks no formula (REF-01 test applied).
- [ ] The four seeds exist in a fresh config with descriptions.
- [ ] Verified via the `verifier` subagent, the `fallow` skill, and the `coding-conventions` skill.

## Notes

- Constants-as-formulas (spec allows it) deferred — no seed needs it; note the extension point in
  module JSDoc.
- `points_per_level` is seeded but unread until RES-02 — a constant is data, not behaviour.
