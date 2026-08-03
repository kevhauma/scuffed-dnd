# TICKET-CST-02 — Constants panel

- **Area:** Constants configuration
- **Type:** Feature
- **Traceability:** Concept [05 · Constant](../../excel%20export%20summary/concepts/05-constant.md) (editor requirements)

## User story

As a User, I want a Constants section in configuration mode showing each constant with where it's
used, so tuning a balance lever is one edit with its blast radius visible.

## Description

The UI for TICKET-CST-01's entity, following the established config-domain shape.

## Current situation (as-is)

- CST-01 lands the entity, resolution, and seeds with no editor; the config dashboard
  ([`ConfigDashboard`](../../../src/components/config/dashboard/)) has no constants card and no
  route exists.

## Desired result (to-be)

- A Constants panel at `/config/constants` in the standard four-part shape
  (`ConstantsConfigPanel` / `ConstantCard` / `ConstantFormDialog` / `useConstantManager`), plus
  the dashboard card and nav entry.
- Each card shows the constant's value, description, and **where it's used** (reverse index from
  REF-01's machinery — the spec's editor requirement).
- Delete goes through REF-02's guarded action; the dialog renders the reference list.

## Acceptance criteria

- [ ] Panel CRUD works end-to-end through the manager hook and store actions; route + dashboard card wired (route test per the configRoutes pattern).
- [ ] The usage list on a card matches actual references (test with a formula naming the constant).
- [ ] Deleting a referenced constant surfaces REF-02's refusal with the list; an unreferenced one deletes.
- [ ] Components compose `ui/` primitives, own their layout, theme tokens only; required-description enforced in the form.
- [ ] Verified via the `verifier` subagent, the `fallow` skill, and the `coding-conventions` skill.
- [ ] Verified live in the browser: edit `bonus_divider`, see a dependent value move. (Ask the User first per CLAUDE.md; fully visible once SKL-02 lands — before that, any formula naming a constant demonstrates it.)

## Notes

- Copy the panel shape from an existing domain (`materials/` is the closest size) rather than
  inventing structure.
