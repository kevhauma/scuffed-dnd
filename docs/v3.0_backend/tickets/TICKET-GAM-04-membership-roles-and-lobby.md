# TICKET-GAM-04 — Membership, roles and the session lobby

- **Area:** Game sessions
- **Type:** Feature
- **Traceability:** v3 [Req 39](../requirements.md#requirement-39-membership-and-roles)

## User story

As a DM, I want to see who is at my table and manage the list, so that the person who left the
campaign in March is not still holding a seat.

## Description

The first surface in the app that shows **other people**. It closes the membership half of game
sessions — remove, leave, transfer the DM role — and gives the session a lobby that GAM-02's join
lands on and LIVE-03 later fills with presence.

## Current situation (as-is)

- GAM-01 records the DM twice on purpose — on the session and as a `session_member` row with role
  `dm` — precisely so this ticket can transfer the role with one update.
- GAM-02 and GAM-03 create `player` memberships; nothing removes one, and there is no surface that
  lists them.
- CHAR-04 has not landed, so there are no Characters to retain yet. The retention rule is written
  and tested here anyway, against seeded character rows.

## Desired result (to-be)

- A DM can remove a `player`; a `player` can leave. In both cases that Account's Characters **stay
  in the session as read-only** rather than being deleted — a character is part of the table's
  history, and deleting it would rewrite the campaign to tidy a list.
- A DM can transfer the role to another Member, after which they hold `player` powers. A DM removing
  or leaving without transferring first is refused, naming the transfer as the way out.
- A session lobby listing every Member with their role, their characters, and a connection column
  that LIVE-03 fills in — showing "unknown" until it does, rather than implying a state we cannot
  yet observe. **TICKET-DM-04 later grows this same surface into the DM's roster** — build it as the
  session's one member list, not as a page that will need a sibling.

## Acceptance criteria

- [x] A removed Member loses every session read and write; their Characters remain readable by the
      remaining Members and are writable by nobody, including the DM's own controls.
      (`removeSessionMember` deletes one `session_member` row and touches `character` not at all;
      every session route is behind `requireMember`, which that row *was*. The writable-by-nobody
      half is [`guards.ts`](../../../src/server/auth/guards.ts)'s `requireCharacterWriter`, which now
      asks about the **owner's** membership before the caller's. `membership.test.ts` — *should keep
      them at the table, writable by nobody once their owner has gone*, which asserts both Accounts
      may write, removes the owner, and asserts neither may.)
- [x] A Member who leaves gets the same treatment, and can rejoin via a valid Invite, regaining
      write access to their retained Characters. (Leaving **is** removing — one route, two actors —
      so the treatment is identical by construction rather than by a second implementation agreeing.
      `membership.test.ts` — *should let a player leave* and *should give write access back on a
      rejoin, with nothing to repair*, which goes through `seatSessionMember`, the function both
      invitation routes end at. Ownership is never moved, so there is nothing to restore.)
- [x] Transferring the DM role updates both the session's `dm` and the two membership rows in one
      transaction; a mid-transfer failure leaves exactly one DM. (`transferDungeonMaster` in
      [`gameSessionRepository.ts`](../../../src/server/repositories/gameSessionRepository.ts) —
      **demote before promote**, because `session_member_one_dm` allows one `dm` row per session, so
      the other order fails on the constraint; a throw anywhere rolls back to exactly one DM.
      `membership.test.ts` — *should move the role and leave both Accounts at the table*, *should
      write the session's own column too, not only the memberships*, and *should let the new DM act
      and the old one no longer*.)
- [x] A DM's attempt to leave or remove themselves is refused and says to transfer first
      (v3 Req 39.6). (`removeMember.ts` refuses with a 409 naming both ways out — hand it over, or
      archive it if the game is finished, since a DM alone at their table has nobody to hand it to.
      `membership.test.ts` — *should refuse the DM their own seat, and say how to get out*, which
      asserts the wording rather than only the status.)
- [x] Exactly one `dm` per session is enforced by a database constraint, not only by application
      code — asserted by attempting a direct second insert. (`membership.test.ts` — *is the
      database's rule, not the route's*, which inserts a second `dm` row straight past every route
      and every guard and asserts it throws; plus *survives a transfer, which is when there would be
      two*. The route never attempts one, so a test that only drove routes would have been proving
      the route's own caution.)
- [x] The lobby renders from `components/ui/` primitives on theme tokens, shows each Member's role,
      and shows connection as "unknown" pending LIVE-03.
      ([`SessionLobby.tsx`](../../../src/client/components/sessions/SessionLobby.tsx) — `Card`,
      `Text`, `Button` and `Dialog`, on `dmBadgeStyles` / `playerBadgeStyles` / `stone-400`, with no
      raw hex and no stock Tailwind colour. There is deliberately **no `presence` field on the
      wire**: the server cannot observe one until LIVE-01, so the client says *Connection unknown*
      rather than the server sending a value it invented. `SessionLobby.test.tsx` — *says the
      connection is unknown rather than claiming offline*.)
- [ ] Verified via the `verifier` subagent, the `fallow` skill, and the `coding-conventions` skill,
      plus a live browser check with two accounts (ask the User first).

      **Everything but the second account is done.** `npx vitest run` 2754 passed / 0 failed /
      0 skipped; `npx tsc --noEmit` at the documented 2-error baseline; `yarn run check` clean; the
      `conventions-reviewer` subagent reviewed the diff with `fallow` folded in, and its findings
      are applied — including a real one, that giving up your own seat re-read a route the caller
      had just stopped being able to see and showed the 404 as a failure.

      **Verified live at `localhost:3000`, signed in as one account (`player2@example.com`):**
      - Every row now offers *Who is here*, a **player's included** — it used to be the DM's alone.
      - Reading a table this Account **plays** at: the DM's row is badged *Runs this game* in amber
        and this Account's is *Player* in royal and marked *(you)*; both say *Connection unknown*;
        *Leave* is on this Account's row and **nothing** is on the DM's.
      - *Leave* opens the `ui/Dialog` confirmation carrying the *Nothing is deleted* sentence, and
        *Cancel* leaves the table alone.
      - Reading a table this Account **runs**: its own row carries no *Leave* at all (v3 Req 39.6),
        and the two invitation panels sit below the lobby rather than replacing it.
      - No console errors on a fresh load.

      **What is not verified: anything that needs a second person at the table** — *Remove*, *Hand
      over*, and the departed-characters section. All three need a second Account, and creating one
      means typing a password into a sign-up form, which this agent may not do. Covered by
      `membership.test.ts`'s 23 cases against real rows; open here until somebody drives it by hand.

## Notes

- **Retention over deletion** is the decision worth arguing with later if anyone wants to. The
  alternative — deleting a departing player's characters — makes the Event log reference rows that
  no longer exist and makes a rejoin lossy. Read-only retention costs a `WHERE` clause.
- The connection column showing "unknown" rather than "offline" matters: the app cannot distinguish
  them until LIVE-03, and showing "offline" would be a claim we cannot support. This is the same
  discipline as chipping a formula that cannot be evaluated instead of showing a confident zero.
- Rejoining restores write access because ownership is by Account id and never moved. Do not
  reassign character ownership on removal.

### Decided while building

- **Remove and leave are one route**, `DELETE /api/sessions/:id/members/:accountId`. They are one act
  with two actors: what happens to the table is identical, and two routes would be two places for the
  retention rule to drift apart. Who may ask is three comparisons in the handler — the DM may take
  any player's seat, anybody may give up their own, and the DM may not take their own.
- **`requireCharacterWriter` had to be reordered, not extended.** It used to return early for the
  owner, which would have let a removed player keep writing to their own sheet, and it asked only
  about the caller, which would have let the DM edit a departed player's. The owner's membership is
  now checked before either branch. Two of AUTH-03's guard tests seeded a character whose owner had
  never been seated — the *orphan* case under the new rule — and were corrected to seat them, with
  the orphan case given a test of its own.
- **The lobby has no `presence` on the wire.** v3 Req 39.7 asks for a connection state and the server
  cannot observe one until LIVE-01, so the column is the client's *Unknown* rather than a field whose
  only possible value the server invents. LIVE-03 adds it when there is something real to send.
- **Nothing in `docs/imports/` changed**: no `Configuration` entity is added or reshaped, and the
  source spreadsheet has nothing to say about who sits at a table.
- **The keyed-on-the-open-row hook became its third instance, so it was extracted.**
  `useSessionInvite` (GAM-02), `useSessionInvitations` (GAM-03) and this ticket's
  `useSessionMembers` had grown the same staleness guard and the same write wrapper three times —
  `fallow audit` measured the two halves at 22 and 15 identical lines — which is where the house
  rule says to abstract. `useSessionResource` owns the mechanism; what each hook keeps is what a
  write *means*. It also settled the 404 question once for all three: a route behind
  `requireMember` refusing a table you were reading a moment ago means *you cannot see this any
  more*, which is a state and not a fault.
- **Observed and deliberately not fixed:** a player opening their row still fires
  `GET /api/sessions/:id/invitations`, which is `requireDM`'s and 404s. It is silent and harmless
  now, and gating it would mean threading the caller's role into the manager for one request.
