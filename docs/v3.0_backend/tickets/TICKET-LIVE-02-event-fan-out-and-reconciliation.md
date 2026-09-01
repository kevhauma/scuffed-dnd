# TICKET-LIVE-02 — Event fan-out and client reconciliation

- **Area:** Live updates
- **Type:** Feature
- **Traceability:** v3 [Req 44.4, 44.5, 44.7](../requirements.md#requirement-44-live-updates)

## User story

As a Player, I want the table to update as things happen, so that I see the DM's adjustment and the
other players' rolls without refreshing.

## Description

The payoff. Every ticket from PLY-01 onward has been writing Events that nothing reads; this one
sends them to the room and teaches the client to apply them. It is where the milestone's promise
becomes visible.

## Current situation (as-is)

- PLY-01, ROLL-07, DM-01 and DM-02 each write one Event per accepted action, with the actor and the
  before/after values — deliberately, so that a consumer can apply a change without refetching.
- GAM-01 writes an Event on a Snapshot refresh; GAM-04's membership changes should too.
- LIVE-01 gave us authenticated rooms and a one-way channel with nothing on it.
- `event.seq` is unique and monotonic per session by constraint (DB-01).

## Desired result (to-be)

- Every Event written in a session is broadcast to that session's room, carrying its `seq`, its
  type, its actor and its payload — and to no other room.
- The write and the broadcast are one path: an Event cannot be persisted without being published,
  so no ticket can add an action that silently fails to notify. A single `recordEvent()` in
  `src/server/` is the only writer.
- Client-side application: an Event patches the cached session state — a character's values, the
  roll log, the member list — without refetching the session, with a stated fallback to a full
  refetch when it cannot be applied.

## Implementation notes (2026-09-01)

Two criteria were amended on the day they were built, before the code was written, rather than being
quietly outgrown. Both are recorded here in full and struck through below.

**Criterion 1 — GAM-04's membership changes write no Event, and this ticket does not add one.**
`removeMember`, `transferDm` and the two seating paths write nothing to the log today, so there is
nothing there to fan out. Adding membership Events means new event types, writes in four routes, and
a member-list applier on a **second** surface — `SessionLobby` — which brings its own subscription.
[TICKET-DM-04](./TICKET-DM-04-session-roster-with-quick-actions.md) **replaces** GAM-04's lobby
outright rather than sitting beside it and is deliberately scheduled after LIVE-03, so a member-list
applier built now is a member-list applier built twice. **DM-04 owns it** (User, 2026-09-01). The
criterion is amended to the five sources that do write Events; everything they write is broadcast.

**Criterion 4 — "every Member's roll log" describes a surface that does not exist.** The only roll
log in the app is `RollHistoryPanel` on one character's sheet, and `useRoller` narrows it to the
reader's own Account. The table-wide feed is DM-04's. Two consequences, both recorded rather than
papered over:

- The criterion is amended to *a roll appears live in every log scoped to include it, ordered by
  `seq`* — which is what the code does and what can be checked.
- **A DM's view of a player's roll log still reads empty**, the gap DM-05 recorded against DM-04 and
  this ticket. Narrowing that log by *character* rather than by *Account* needs a second
  `json_extract` on the Event payload — which `eventRepository.latestCharacterEvents`' own docblock
  flags as the moment to ask whether a `character_id` column should exist instead — and that is a
  schema decision with a migration behind it, not a line in a fan-out ticket. **It stays DM-04's.**
  It is deliberately *not* worked around by letting the live feed fill the panel: a DM would then see
  a log that looks right and silently omits everything from before the socket opened, which is worse
  than an empty one (User, 2026-09-01). **That is enforced rather than intended**: `useRoller` joins
  no room for the log when the reader is the table's DM (`atTable && !isDungeonMaster`), and
  `useRoller.table.test.tsx`'s *joins no room for the table's DM, whose log is empty for a reason*
  fails if the predicate is dropped. It was dropped in the first draft of this ticket and the review
  caught it; the DM's *character* feed is a different subscription and is unaffected.

## Acceptance criteria

- [x] ~~Every action from PLY-01, ROLL-07, DM-01, DM-02 and GAM-01/04 produces a broadcast~~ Every
      action from PLY-01, ROLL-07, DM-01, DM-02 and GAM-01 produces a broadcast — **GAM-04 writes no
      Event and is DM-04's, see the note above**; a test enumerates the action routes and asserts
      each emits one, so a future action cannot be added silently.
      (`src/server/events/eventFanOut.test.ts` — *all reach the fan-out, and there are as many as
      there are actions* walks every `defineHandler(` module under `routes/`, finds the 30 that reach
      `recordEvent(`/`applyPlayerAction(`, and asserts that count is `PLAYER_ACTION` +
      `DM_ACTION` + 2; plus four behavioural cases driving a player action, a DM adjustment, a roll
      and a Snapshot refresh through real routes against real rooms, and *sends nothing at all when
      the action was refused*.)
- [x] `recordEvent()` is the only code path that inserts into `event` — enforced by the tree-walking
      test, not by review. (`src/server/events/recordEvent.ts`; the appender is **injected** into
      `recordPlayerAction` and `refreshSessionSnapshot` rather than imported by them.
      `eventFanOut.test.ts` asserts it three ways, and the first two are **equalities** rather than
      allow-lists: *writes to the event table from exactly one place in the whole server* scans for
      the **statement** — `.insert(event)` — so a rename, an aliased import or a third append
      function all still show up; *appends from exactly one place outside the repository that
      defines the writes* is the call-site half; and *offers exactly two ways in, both of which the
      recorder takes* closes the gap the first two leave, since the repository is excluded from the
      first scan — a third append **exported** from it, which is the shape TICKET-DM-04's membership
      Events want, fails by name. Verified by mutation: adding an `appendMembershipEvent` turns the
      third red.)
- [ ] Two browsers in one session: a DM's experience award appears on the Player's open sheet with
      no refresh, and the derived level moves with it. **Open** — the User declined interactive
      browser checks for the rest of the milestone on 2026-09-01. The mechanism is proven without a
      browser: `liveEvents.test.ts` *moves experience where the Kernel moved it* (the payload is
      built by running `dmActions.addExperience` itself), *derives nothing — the level follows from
      the experience it wrote*, and `eventFanOut.test.ts` *sends a DM's adjustment, carrying what the
      value became*, which asserts the frame a second browser would receive.
- [x] ~~A roll by one Player appears in every Member's roll log in order~~ A roll appears live in
      every log scoped to include it, ordered by `seq` — **see the note above for what changed and
      why**. (`useRoller.table.test.tsx` — *appears in the log without asking for it again*, *orders
      by seq, not by the order the frames arrived*, and *shows a Player's own roll once, though it
      arrives twice*; the ordering and the deduplication both live in
      `useTableRollLog.ts`'s `withRoll`.)
- [x] An Event a client cannot apply triggers exactly one full refetch, not one per Event, and the
      surface is correct afterwards. (`useTableCharacterFeed.test.ts` — *reads once for a burst of
      Events it cannot apply* and *reads again for an Event that arrived while it was reading*; the
      re-read is `useOpenTableCharacter`'s own `read`, the same character-then-Snapshot pair the
      sheet opened with, so *correct afterwards* is the same claim as *correct on the way in*.)
- [x] An Event for session A never reaches a client subscribed only to session B, asserted with two
      live sessions. (`src/server/events/eventFanOut.test.ts` — `twoTables` seeds two real sessions
      and joins one fake connection to each room of the **real** `createSocketRooms()`; the player
      and DM cases both assert `listeningToSecond.frames` is empty. Also `recordEvent.test.ts`
      *publishes the row the write appended, to that row's own room*, and `useLiveSession.test.ts`
      *hands over the Events of its own room and no other* for the client half of the same rule.)
- [x] Verified via the `verifier` subagent, the `fallow` skill, and the `coding-conventions` skill,
      plus ~~a live browser check with two accounts in two browsers~~ — **the browser half is open**,
      declined by the User for the rest of the milestone on 2026-09-01. (`npx vitest run` 4092 passed
      / 0 failed / 0 skipped across 246 files, up from 4015/241; `npx tsc --noEmit` at the documented
      2-error baseline; `yarn run check` clean. `fallow audit --base main` **passes** with 0
      introduced findings after three were fixed rather than suppressed — a dead `setLiveConnection`
      deleted, `useRoller` split into `useTableRollLog` when it crossed 15 cognitive, and
      `logRoomFor` hoisted to module scope when the review round's DM predicate took it over again.
      **The review round's eleven findings are all fixed**, three of them verified by mutation: the
      DM subscription, the one-writer guard, and the `updatedAt` test that had been passing by
      coincidence against the real clock.)

## Notes

- **Broadcast the Event, not the new state.** Sending a whole character on every change would make
  the socket a second write path for state, and the two would eventually disagree. The Event says
  what happened; the client applies it, and when it cannot, it asks. That fallback is the honest
  answer, not a failure.
- The client applies a change to *other people's* actions optimistically-in-effect — it is already
  committed server-side. The Player's own actions stay synchronous per PLY-01, so there is no
  reconciliation of a local prediction against a broadcast: the two paths never race for the same
  change.
- Derived values are **never** in an Event payload. An Event carries the stored values that changed;
  the client re-derives through the Kernel, exactly as it does after any other change. That is v3
  Req 45.1 applied to the feed.
