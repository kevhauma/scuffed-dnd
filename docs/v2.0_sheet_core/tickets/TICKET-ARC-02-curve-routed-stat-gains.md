# TICKET-ARC-02 — Curve-routed stat gains

- **Area:** Archetypes configuration (point-buy)
- **Type:** Feature (replaces 1:1 allocation)
- **Traceability:** Concept [03 · Archetype](../../excel%20export%20summary/concepts/03-archetype.md) (exchange rates); Concept [06 · Curve](../../excel%20export%20summary/concepts/06-curve.md) (`point_buy`)

## User story

As a Player, I want points spent on my archetype's main stats to buy more than points spent
off-type — 15 points buying 12 main / 7 sub / 5 non — so specialisation shapes growth the way the
sheet's Funny archetype produces Char 39.

## Description

The spec's archetype "changes the exchange rate between points spent and stats gained". This
ticket replaces STAT-01's provisional 1:1 invested term with the curve-routed gain, using
ARC-01's affinities and CRV-03's `point_buy` seed.

## Current situation (as-is)

- STAT-01's composition adds `investedStatPoints` 1:1, archetype-blind — the spread the sheet
  confirms (2.4× at 15 points) has no representation.
- RES-02's validator reports points spent/available but knows nothing of gains.

## Desired result (to-be)

- **Gain = `curve.point_buy(pointsSpentOnStat, affinityColumn)`** replaces the 1:1 invested term
  in the composition; `investedStatPoints` explicitly means *points spent* (the curve maps points
  → levels gained).
- The allocation validator additionally reports **per-stat gains**, so wizard and sheet render
  "7 points in Char → +9" from the engine, mapping nothing themselves.
- A character without an archetype (mid-creation) routes every stat through the `non` column —
  defined, tested behaviour rather than an accident.

## Acceptance criteria

- [ ] The confirmed rates reproduce: 15 points → 5 / 7 / 12 by affinity column against the seed curve (engine test; DX-04 re-pins).
- [ ] Composition test through `calculateCharacter`: gains replace raw points; race base and equipment terms unchanged.
- [ ] Validator's per-stat gains match the curve for mixed allocations (test with a spread of affinities).
- [ ] The no-archetype fallback is pinned by a test.
- [ ] Verified via the `verifier` subagent, the `fallow` skill, and the `coding-conventions` skill.

## Notes

- Pure engine ticket — UI reads the validator's new fields when ARC-03 lands the wizard step.
- Whether *skill* investment also routes through affinity is a spec open question — skills stay
  1:1 (SKL-02's note); don't build it silently.
