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

## Implementation notes (2026-08-27)

- **The roll's path names the character, not the session.** The to-be drafted
  `POST /api/sessions/:id/characters/:cid/roll`; it is at **`POST /api/characters/:id/roll`**,
  beside TICKET-PLY-01's eleven. The session is a fact the character *row* already carries, so
  taking it from the path as well would create a request that can disagree with itself — session A
  in the URL, a character belonging to session B — and a cross-check to catch that is a check
  somebody has to remember. `redeemInvite` refuses to spell `sessionId` for the same reason.
  Nothing about the behaviour differs. **The log stays session-scoped**, at
  `GET /api/sessions/:id/rolls`, because that half really is about the table.
- **`routes/rolls/` is a folder of its own** rather than a twelfth module in `routes/play/`.
  `playerRules.test.ts` asserts that every route there takes its rule from `playerActions.ts` and
  imports nothing from `#shared/engine/` directly — and a roll's rule *is* the dice engine. It sits
  on the other side of that line rather than as an exception to it, which is also the honest
  description: PLY-01's eleven write the sheet, and a roll writes an Event and nothing else.
- **The RNG seam is a handler factory.** `rollDiceHandler(rng)` builds the route and
  `export const rollDice = rollDiceHandler()` is what the router holds, so a test builds its own
  with a predictable source. No global, and no test spies on `Math.random`.
- **The sheet's history is the table's log filtered to this character.** The route answers the whole
  table's, which is what the criterion asks and what the tests assert; a *table-wide* surface is
  TICKET-DM-04's roster and TICKET-LIVE-02's feed, and inventing one here would be inventing a
  surface nobody has designed.

## Acceptance criteria

- [x] A roll resolves server-side and returns a `RollOutcome`; a request body carrying `total`,
      `results` or `pool` is rejected naming the field.
      (`server/routes/rolls/rolls.test.ts` → *answers with the whole chain rather than a total* and
      *refuses a body that reports its own result, naming the field*, which loops over `total`,
      `results`, `dice`, `flat`, `notation` and `input` — each a 400 naming itself — and then
      asserts **nothing was logged for any of them**.)
- [x] The rolled pool matches what the sheet's button label showed — asserted by deriving the label's
      pool and the server's decomposition from the same Snapshot and comparing, which is
      TICKET-ROLL-06's guarantee carried across the wire.
      (`rolls.test.ts` → *rolls the pool the sheet's button showed, not a pool of its own*: the case
      calls `rollPool` itself against the Snapshot and compares both `input` and `notation` with
      what the route threw. A server that re-evaluated the input, or used a different ladder, passes
      every other case in the file and fails this one.)
- [x] Every Member of the session reads the roll; no Account outside it can.
      (`rolls.test.ts` → *is every Member's to read, and nobody else's*: the **DM**, who did not roll
      it, reads it; anonymous is 401 and a stranger is 404, indistinguishable from an unknown
      session id.)
- [x] Rolls are recorded as Events with the actor, and the log survives a reload — the property
      `useUIStore` never had.
      (`rolls.test.ts` → *records every roll as an Event, so it survives the tab that made it* — the
      whole `RollOutcome` is in the payload, not a total — plus *reads back with who rolled and what
      they were playing, newest first* and *carries no player action into the roll log*, which
      catches the `type` filter missing. Client-side:
      `useRoller.table.test.tsx` → *shows the table's log before anything has been rolled in this
      tab*. **Verified live**: a roll made in one tab is on the sheet in a freshly opened one.)
- [x] The server's RNG is injectable in tests exactly as the Kernel's is; no test spies on
      `Math.random` (the existing rule).
      (`rollDiceHandler(rng)` — a factory, so there is no global to reset;
      `rolls.test.ts` → *uses the randomness it is given, so nothing has to spy on Math.random*
      drives the same pool from both ends of every die and asserts the low one rolled all ones.)
- [x] A roll on a character the Account does not own is refused — a Player rolls their own; a DM
      rolling for a player is out of scope and stated as such.
      (`requireCharacterPlayer`, which is `requireCharacterWriter` minus the DM;
      `rolls.test.ts` → *refuses everybody but the character's own Player — the DM included*.)
- [x] Verified via the `verifier` subagent, the `fallow` skill, and the `coding-conventions` skill,
      plus a live browser check (ask the User first).
      (`npx vitest run` **2932 passing, 0 failing, 0 skipped** across 184 files; `npx tsc --noEmit`
      at the documented 2-error baseline; `yarn run check` clean. Browser: rolling *mele* on a
      session sheet posts `{ rollId }` and nothing else, the answer is the server's, the Event log
      holds `input 11 → 0D20 + 0D12 + 1D6 + 5 → 6` with the per-die chain, the entry is on the sheet
      after a **fresh page load in a new tab** with no console errors, and there is no *Clear
      History* button because an Event log cannot be cleared.)

## What the review found

Four things, none of them a hole in the server's authority — the reviewer confirmed no path lets a
client influence a die — and two of them real:

1. **The cap and the filter disagreed.** The route capped at the *table's* hundred most recent rolls
   and the sheet filtered that window to one character, so on an active table a Player's own rolls
   would drop off their own sheet with nothing saying so. `GET /api/sessions/:id/rolls?rolledBy=`
   narrows **in the query**, before the cap.
2. **The client re-read the whole log after every roll** for the one row it had just created. The
   route answers with the logged entry now, so the hook prepends what came back — one round trip
   instead of two, and no window in which the sheet shows a result its own history lacks.
3. `RESULT_FIELDS` was hand-written: it named `results` and `pool`, which are not fields of
   `RollOutcome`, and omitted `rollName` and `timestamp`, which are — so a body carrying a timestamp
   got a 200 and a server-chosen one. It is typed against `keyof RollOutcome` now.
4. Smaller: the payload was parsed twice per row; `canRoll`'s `atTable ||` could not change any
   outcome; `sendRoll`'s result union was the third spelling in a file whose two siblings tag theirs
   with a const object; and `characterSync.ts`'s "a component never reaches either destination" had
   stopped being true of the roll pair. All four fixed.

## What the browser found

The empty state still said *"Rolls are not saved between visits"* on a table sheet, which stopped
being true the moment the log became Events. It now says the opposite where the opposite is true,
driven by the same signal that withholds *Clear* — a panel with no `onClear` is looking at a log
that is not its to clear and not its to lose.

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
