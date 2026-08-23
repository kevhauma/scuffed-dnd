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

## Acceptance criteria

- [ ] Every action from PLY-01, ROLL-07, DM-01, DM-02 and GAM-01/04 produces a broadcast; a test
      enumerates the action routes and asserts each emits one, so a future action cannot be added
      silently.
- [ ] `recordEvent()` is the only code path that inserts into `event` — enforced by the tree-walking
      test, not by review.
- [ ] Two browsers in one session: a DM's experience award appears on the Player's open sheet with
      no refresh, and the derived level moves with it.
- [ ] A roll by one Player appears in every Member's roll log in order, and the order matches `seq`
      even when two arrive together.
- [ ] An Event a client cannot apply triggers exactly one full refetch, not one per Event, and the
      surface is correct afterwards.
- [ ] An Event for session A never reaches a client subscribed only to session B, asserted with two
      live sessions.
- [ ] Verified via the `verifier` subagent, the `fallow` skill, and the `coding-conventions` skill,
      plus a live browser check with two accounts in two browsers (ask the User first).

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
