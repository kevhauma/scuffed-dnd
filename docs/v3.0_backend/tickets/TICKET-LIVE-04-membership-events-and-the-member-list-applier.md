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

> **Implementation note, 2026-09-02 — the join reads the member list, and only that.** Criterion 3
> says a membership Event schedules *no re-read*. That holds for three of the four:
> `member_removed`, `member_left` and `dm_transferred` carry ids the list can be patched from, and
> nothing is asked of the server. **`member_joined` cannot be patched** — criterion 6 forbids the
> name in the payload, and a member list is a list of names — so it falls back to a re-read, which is
> the *to-be*'s own *"falling back to a re-read where it cannot"*. The narrowing is that the read is
> the **member list alone**: never the characters, never the Snapshot, and never any open sheet. That
> exemption is pinned by a test rather than described (`useRosterFeed.test.ts`, *reads the member
> list and nothing else when somebody joins*), and criterion 2 of the amendment holds without
> exception — `applyEventToCharacter` answers `elsewhere` for **all four**, the join included, so no
> sheet reads anything for a membership change.

- [x] `removeMember`, `transferDm` and both seating paths each append an Event through
      `recordEvent()`, and `eventFanOut.test.ts`'s handler-count **equality is re-derived rather than
      bumped** — the expression names where the four came from, so a fifth cannot be added silently.
      (`removeMember.ts`, `transferDm.ts`, `redeemInvite.ts` and `acceptInvitation.ts` each call
      `recordEvent(`; `eventFanOut.test.ts`'s `NON_SHEET_WRITERS` names all six non-sheet writers and
      the assertion reads `sheetActions + NON_SHEET_WRITERS.length` with each member asserted
      present — *all reach the fan-out, and there are as many as there are actions*.)
- [x] The append stays a single call site: `appendEvent(`/`appendEventWithin(` still appear once in
      `src/server/`, and `eventRepository.ts` still offers exactly two ways in. The seating paths
      write the membership row and its Event **in one transaction**, as `recordPlayerAction` does —
      a seat whose Event failed is a table nobody was told about.
      (`eventFanOut.test.ts`'s *appends from exactly one place outside the repository* and *offers
      exactly two ways in* both still pass unchanged — the three membership writes take an
      `AppendEvent` as `refreshSessionSnapshot` does. The transaction is proven by breaking it:
      `membership.test.ts`'s *should write the seat and its Event together, or neither* passes an
      appender that throws and asserts **no membership row**, and *should keep a seat whose removal
      Event could not be written* is the same property from the other side.)
- [x] `applyEventToCharacter` answers `elsewhere` for a membership Event, and a test drives one
      through `useTableCharacterFeed` and `useRosterFeed` asserting **no re-read is scheduled** — the
      refetch storm named above, tested rather than reasoned about.
      (`liveEvents.ts` answers from an exhaustive `Record<SessionEvent, LiveEventEffect>`;
      `liveEvents.test.ts` asserts `elsewhere` for **all four** and `stale` still for the Snapshot
      refresh. `useTableCharacterFeed.test.ts`'s *reads nothing when somebody joins or leaves the
      table* drives all four through the **real** applier — the only case in that file that does —
      and asserts `reopen` is never called. On the roster, *drops a removed Member from the list,
      with no request at all* and its two siblings assert none of the three reads fires; see the
      dated note above for the join.)
- [x] The roster's member list moves on a membership Event with no refresh: a player removed at one
      browser leaves the list at another, and a handed-over DM role moves its badge.
      (`membershipEvents.ts` + `useRosterFeed.ts`'s members arm, read by `useSessionRoster` for the
      groups **and** for `holdsDmSeat`, so the badge and the controls move together.
      `useRosterFeed.test.ts`: *drops a removed Member from the list*, *drops a Member who left*, and
      *moves the DM's badge on a handover, and puts the new DM first*. The two-browser half of this
      is criterion 11, which is open.)
- [x] A departed Member's characters move to the departed group on the same Event, without a re-read,
      because retention is what removal means (v3 Req 39.3).
      (Nothing new computes it: `toRosterView` already derives *departed* as *owns a character here
      and holds no seat here*, so the patched member list is the whole change.
      `useRosterFeed.test.ts`'s *moves a departed Member's characters to the departed group, on the
      same Event* drives the removal through the feed and asserts the group off the two real modules,
      with no read fired.)
- [x] The Event's payload carries **ids and no names** — the rule `PresenceMessage` and
      `RollLogPayload` both keep — so a rename cannot leave the log calling somebody by a name they
      no longer have.
      (`MembershipEventPayload { accountId }` and `DmTransferEventPayload` adding
      `previousAccountId`, both in `shared/types/api.ts`. `membership.test.ts`'s *should carry no
      name at all, so a rename cannot make the log wrong* performs a handover and a removal between
      two **registered** Accounts and asserts neither profile name appears in any payload — a
      fixture without names would have passed by having nothing to leak.)
- [x] The four new Event types are `SESSION_EVENT` values (dotted, like
      `session.snapshot_refreshed`), not `SheetAction` values: they are things that happened to the
      **table** rather than acts performed on a sheet, and they share the log's one `type` column.
      (`session.member_joined`, `session.member_removed`, `session.member_left`,
      `session.dm_transferred`, with a derived `SessionEvent` type — the no-bare-union rule — which
      is what makes `liveEvents.ts`'s record exhaustive. **Four types over four routes, but not one
      each**: seating has two paths writing the same `member_joined`, and `removeMember` writes
      *removed* or *left* depending on whether the caller gave up their own seat, which
      `membership.test.ts`'s *should tell a leaving apart from a removal* pins.)
- [x] `describeAdjustment` is **not** extended to them — the adjustment log is a character's history,
      and a membership change is not an adjustment to anybody's sheet.
      (`describeAdjustment.ts` is untouched, and its `Record<DmAction, …>` makes adding one a compile
      error rather than a choice. The live half is checked: `useRosterFeed.test.ts`'s *records no
      adjustment for a membership change, which is not anybody's sheet* asserts the newest-seen
      adjustment map stays empty over a removal.)
- [x] Unit tests cover: each of the four routes emitting exactly one Event; the transaction on the
      seating path; `elsewhere` for both feeds; the roster's member list patched from an Event; the
      departed group moving; and the payload carrying no names.
      (+44 tests, +1 file. `membership.test.ts` +7, `invites.test.ts` +1 and `invitations.test.ts` +1
      — the two seating cases assert **one** Event for two clicks, so the idempotence reaches the log
      — `eventFanOut.test.ts` +1 over the real `createSocketRooms()`, `membershipEvents.test.ts` +10
      new, `useRosterFeed.test.ts` +7, `liveEvents.test.ts` +2, `useTableCharacterFeed.test.ts` +1.)
- [x] Verified via the `fallow` skill and the `coding-conventions` skill.
      (`fallow audit --base main`: **verdict pass**, `dead_code_introduced: 0`,
      `complexity_introduced: 0`, `duplication_introduced: 0` across 25 changed files.
      `fallow dead-code`: no new finding — the two reported are inherited (`fallow` itself as a
      dependency, and `RulesetHomeKind` in the untouched `rulesetSync.ts`).
      `fallow health --complexity`: **no finding on any file this ticket touched**, `useRosterFeed`
      and `useCoalescedReads` included. `fallow health --hotspots --since 6m`: the four touched files
      that appear are all **cooling**, so no hotspot row is owed. The `coding-conventions` pass
      caught its own finding and it was fixed rather than argued with: the new test code had
      `expect(idsOf(remaining))` and `applyEventToMembers(makeTable(), …)` nesting, which the
      no-nested-calls rule covers in full for new tests.)
- [ ] Verified live in the browser: two accounts in two browsers — one leaves the table and the
      other's roster notices, with no reload (ask the User first).
      **Open, and deliberately.** The User declined interactive browser checks for the rest of the
      milestone (2026-09-01, restated for this ticket on 2026-09-02), and this criterion asks for
      exactly the two-account, two-browser check they declined. Everything it would observe is proven
      by test above — the member list patched from a real Event, the DM badge moving, the departed
      group following, and no read fired — but *observed in two browsers* is not something a test can
      claim, so the box stays open rather than being ticked on a proxy.

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
