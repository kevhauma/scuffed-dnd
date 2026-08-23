# TICKET-ROLL-07 — Server-resolved rolls and the session roll log

- **Area:** Dice and rolls
- **Type:** Feature
- **Traceability:** v3 [Req 41.6](../requirements.md#requirement-41-player-actions),
  [Req 45.2](../requirements.md#requirement-45-server-authority); Concept
  [08 · Roll definition](../../excel%20export%20summary/concepts/08-roll-definition.md)

## User story

As a Player, I want my rolls resolved by the server and visible to the table, so that a roll is a
shared event rather than a number I report.

## Description

The randomness moves. `rollRollDefinition` stays exactly where it is and keeps its injectable
`RandomSource` — the server becomes its caller, and a client-submitted result becomes invalid input.
The session's roll history stops being tab-local `useUIStore` state and becomes a projection of the
Event log.

## Current situation (as-is)

- `rollRollDefinition(roll, calculatedCharacter, config, rng?, timestamp?)` runs a roll end to end
  and **reads `character.rollInputs` rather than re-evaluating the formula** (TICKET-ROLL-06) — the
  structural guarantee that a roll cannot disagree with the sheet.
- `useRoller` is the one caller, taking the sheet's `CalculatedCharacter` so the roll is not
  calculated twice. Randomness is injectable; production passes nothing.
- `useUIStore` holds roll history in memory and it ends with the tab, by decision (CR-39, and the
  **data-model** skill's "no third key").
- `RollOutcome` is the only dice-result shape and carries the whole chain — input, pool, per-die
  results, flat, total, notation.

## Desired result (to-be)

- `POST /api/sessions/:id/characters/:cid/roll` resolving a roll server-side: recompute the
  character against the Snapshot, call `rollRollDefinition` with the server's RNG, append the
  `RollOutcome` as an Event, and return it. A submitted result field is rejected.
- A session roll log read from Events — every Member sees every roll in their session, with who
  rolled, what, and the whole chain, not just a total.
- `useRoller` calls the server and renders the returned `RollOutcome`; `useUIStore`'s history becomes
  a view over the session log rather than a second store of truth.

## Acceptance criteria

- [ ] A roll resolves server-side and returns a `RollOutcome`; a request body carrying `total`,
      `results` or `pool` is rejected naming the field.
- [ ] The rolled pool matches what the sheet's button label showed — asserted by deriving the label's
      pool and the server's decomposition from the same Snapshot and comparing, which is
      TICKET-ROLL-06's guarantee carried across the wire.
- [ ] Every Member of the session reads the roll; no Account outside it can.
- [ ] Rolls are recorded as Events with the actor, and the log survives a reload — the property
      `useUIStore` never had.
- [ ] The server's RNG is injectable in tests exactly as the Kernel's is; no test spies on
      `Math.random` (the existing rule).
- [ ] A roll on a character the Account does not own is refused — a Player rolls their own; a DM
      rolling for a player is out of scope and stated as such.
- [ ] Verified via the `verifier` subagent, the `fallow` skill, and the `coding-conventions` skill,
      plus a live browser check (ask the User first).

## Notes

- **A client in a session must not roll at all**, not even as a preview. A previewed roll that
  differs from the recorded one is the exact failure this ticket exists to prevent. The button keeps
  showing the *pool* — which is derived, not random — and that is the whole label.
- **A local character still rolls locally** ([D6](../overview.md#d6--local-mode-stays-sign-in-gates-connected-play-only)),
  through `useRoller` and `useUIStore`'s in-memory history, exactly as today. There is nobody to
  disagree with and no server to ask, and gating solo rolling behind an account would be the one
  place this milestone made the app worse. The branch is on where the character lives, and the
  existing roller tests must pass unchanged.
- Recomputing the character server-side before rolling is what keeps `rollInputs` honest. Trusting a
  client-supplied `CalculatedCharacter` would hand the Player a roll bonus field.
- The roll log is the first read of the Event table. Keep the query keyed by `(session, seq)` — it
  is the same index LIVE-03's replay needs, and building it here means that ticket adds no schema.
