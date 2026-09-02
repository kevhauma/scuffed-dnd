# TICKET-LIVE-04 — Membership Events and the member-list applier

- **Area:** Live updates
- **Type:** Feature
- **Traceability:** v3
  [Req 44.3, 44.4, 44.5, 44.7](../requirements.md#requirement-44-live-updates),
  [Req 39.3, 39.4, 39.5](../requirements.md#requirement-39-membership-and-roles)

## User story

As a Player at a table, I want the roster to notice when somebody joins or leaves, so that what it
shows me about who is here stays true without my reloading the page.

## Description

The one part of a Game_Session that changes without writing an Event. Seating somebody, removing
them, and handing the table over are the four acts that alter what
[`SessionRoster`](../../../src/client/components/sessions/roster/SessionRoster.tsx) draws, and none of
them reaches [`recordEvent`](../../../src/server/events/recordEvent.ts) — so every other Member's
roster is stale about the membership until they reload.

**This ticket exists because two earlier ones each looked at it and correctly declined.** It is not a
leftover; it is a scope that was measured twice and found to be its own.

## Current situation (as-is)

- **Four routes change membership and write no Event.**
  [`removeMember`](../../../src/server/routes/sessions/removeMember.ts),
  [`transferDm`](../../../src/server/routes/sessions/transferDm.ts), and the two seating paths —
  [`redeemInvite`](../../../src/server/routes/invites/redeemInvite.ts) and
  `acceptInvitation` in [`routes/invitations/`](../../../src/server/routes/invitations/) — all call
  `gameSessionRepository` directly. There is nothing in the log to fan out.
- **TICKET-GAM-04 built the membership writes** before there was any fan-out to reach.
- **[TICKET-LIVE-02](./TICKET-LIVE-02-event-fan-out-and-reconciliation.md) declined it on a
  duplication argument** — its criterion 1 records the divergence — because DM-04 was scheduled to
  replace the lobby outright, so a member-list applier built then would be built twice.
- **[TICKET-DM-04](./TICKET-DM-04-session-roster-with-quick-actions.md) declined it on a better
  one**, which is the reason this ticket has criteria rather than being folded into that one:
  [`applyEventToCharacter`](../../../src/client/services/liveEvents.ts) answers **`stale`** for any
  type it does not recognise, and both feeds react to `stale` by scheduling a re-read. Shipping a new
  Event type without also deciding what that function does with it means **every open sheet and every
  open roster at the table refetches on every join and leave** — a behaviour change to a hot path,
  arriving as a side effect of a roster.
- **The write path is guarded and the guard is what this must respect.**
  [`eventFanOut.test.ts`](../../../src/server/events/eventFanOut.test.ts) asserts three things, and
  the third — *offers exactly two ways in, both of which the recorder takes* — was **verified by
  mutation against an added `appendMembershipEvent`**, which is precisely the shape this ticket
  wants. It also asserts an **equality**: the count of handler modules reaching `recordEvent(` equals
  `PLAYER_ACTION` + `DM_ACTION` + 2. Four more writers changes that number.
- **The roster's presence column is already live** and is *not* what this fixes:
  [`useLiveRoom`](../../../src/client/components/live/useLiveRoom.ts) reports who is *connected*,
  which is a different fact from who is a *Member*.

## Desired result (to-be)

- The four membership acts each append an Event through `recordEvent()`, so a change to who is at a
  table reaches the table (v3 Req 44.3, 44.4).
- `applyEventToCharacter` answers **`elsewhere`** for a membership Event rather than `stale` — it is
  not about any character — so no sheet and no roster refetches for one.
- The roster applies a membership Event to its **member list** without refetching, falling back to a
  re-read where it cannot (v3 Req 44.7).

## Acceptance criteria

- [ ] `removeMember`, `transferDm` and both seating paths each append an Event through
      `recordEvent()`, and `eventFanOut.test.ts`'s handler-count **equality is re-derived rather than
      bumped** — the expression names where the four came from, so a fifth cannot be added silently.
- [ ] The append stays a single call site: `appendEvent(`/`appendEventWithin(` still appear once in
      `src/server/`, and `eventRepository.ts` still offers exactly two ways in. The seating paths
      write the membership row and its Event **in one transaction**, as `recordPlayerAction` does —
      a seat whose Event failed is a table nobody was told about.
- [ ] `applyEventToCharacter` answers `elsewhere` for a membership Event, and a test drives one
      through `useTableCharacterFeed` and `useRosterFeed` asserting **no re-read is scheduled** — the
      refetch storm named above, tested rather than reasoned about.
- [ ] The roster's member list moves on a membership Event with no refresh: a player removed at one
      browser leaves the list at another, and a handed-over DM role moves its badge.
- [ ] A departed Member's characters move to the departed group on the same Event, without a re-read,
      because retention is what removal means (v3 Req 39.3).
- [ ] The Event's payload carries **ids and no names** — the rule `PresenceMessage` and
      `RollLogPayload` both keep — so a rename cannot leave the log calling somebody by a name they
      no longer have.
- [ ] The four new Event types are `SESSION_EVENT` values (dotted, like
      `session.snapshot_refreshed`), not `SheetAction` values: they are things that happened to the
      **table** rather than acts performed on a sheet, and they share the log's one `type` column.
- [ ] `describeAdjustment` is **not** extended to them — the adjustment log is a character's history,
      and a membership change is not an adjustment to anybody's sheet.
- [ ] Unit tests cover: each of the four routes emitting exactly one Event; the transaction on the
      seating path; `elsewhere` for both feeds; the roster's member list patched from an Event; the
      departed group moving; and the payload carrying no names.
- [ ] Verified via the `fallow` skill and the `coding-conventions` skill.
- [ ] Verified live in the browser: two accounts in two browsers — one leaves the table and the
      other's roster notices, with no reload (ask the User first).

## Notes

- **Nothing here is a schema change.** The `event` table already holds a `type` and a JSON `payload`,
  and `SESSION_EVENT.SNAPSHOT_REFRESHED` is the precedent for a table-level Event with a payload of
  its own. No migration, no new column.
- **Scope caveat: this is not presence.** LIVE-03 answers *is their browser on the room*; this
  answers *are they still a Member*. Both appear in the same roster row and they are different
  claims — a Member can be present and about to be removed, and a removed Member's socket is evicted
  by `rooms.evictMember` whether or not an Event is written.
- **`evictMember` already exists and is not enough on its own.** It tells the *removed* connection it
  lost the room (`ROOM_CLOSED`); it tells nobody else that the roster changed. This ticket is the
  other half of that conversation.
- **Sizing.** Four route modules, one client applier arm, one roster reducer, and the
  `eventFanOut.test.ts` equality. It is a server-side ticket wearing a client-side one's clothes, and
  the DM-04 build is what established that — see that ticket's *Decided while building*.
