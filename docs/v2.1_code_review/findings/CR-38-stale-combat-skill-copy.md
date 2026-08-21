# CR-38 — Stale combat-skill / skill-code copy survives across the app after TICKET-ROLL-06

**Severity:** Low · **Area:** routes, config dashboard, engine validator, doc comments · **Type:** stale content
**User-visible in two places**

## Summary

Combat skills and skill codes were retired (TICKET-SKL-02, TICKET-ROLL-06), but user-visible copy
and internal docs still describe the old model — in one case directly under a comment claiming
the text reflects "the app as it now stands".

## Evidence

- `src/routes/index.tsx:23-40` — landing page advertises "Define custom skills with 3-letter
  codes" and "Roll combat skills with simulated dice"; both retired. The comment above says
  "What each mode actually does, as the app now stands."
- `src/components/config/dashboard/useConfigDashboard.ts:28` — dashboard card for
  `/config/skills` reads "Speciality and combat skills".
- `src/engine/validator.ts:435-441` — the abbreviation-uniqueness check uses loop variable
  `skills` and message `Duplicate skill code "…"` for what is now a stats-only check (it builds
  `allCodes` from `config.stats` alone).
- Doc-comment references to removed modules: `RollDefinitionFormDialog.tsx:5-6` and
  `useRollManager.ts:5` still cite `CombatSkillFormDialog` / `useCombatSkillManager`.

## Impact

The landing page — the first thing a new user reads — describes features that don't exist; the
validator message misnames what it checks, which will confuse the first user who hits it.

## Suggested direction

One copy-sweep commit: fix the two user-visible strings, the validator message (see
[CR-19](CR-19-engine-validator-needs-decomposition.md) — same block), and the stale doc comments.
