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

- [ ] A removed Member loses every session read and write; their Characters remain readable by the
      remaining Members and are writable by nobody, including the DM's own controls.
- [ ] A Member who leaves gets the same treatment, and can rejoin via a valid Invite, regaining
      write access to their retained Characters.
- [ ] Transferring the DM role updates both the session's `dm` and the two membership rows in one
      transaction; a mid-transfer failure leaves exactly one DM.
- [ ] A DM's attempt to leave or remove themselves is refused and says to transfer first
      (v3 Req 39.6).
- [ ] Exactly one `dm` per session is enforced by a database constraint, not only by application
      code — asserted by attempting a direct second insert.
- [ ] The lobby renders from `components/ui/` primitives on theme tokens, shows each Member's role,
      and shows connection as "unknown" pending LIVE-03.
- [ ] Verified via the `verifier` subagent, the `fallow` skill, and the `coding-conventions` skill,
      plus a live browser check with two accounts (ask the User first).

## Notes

- **Retention over deletion** is the decision worth arguing with later if anyone wants to. The
  alternative — deleting a departing player's characters — makes the Event log reference rows that
  no longer exist and makes a rejoin lossy. Read-only retention costs a `WHERE` clause.
- The connection column showing "unknown" rather than "offline" matters: the app cannot distinguish
  them until LIVE-03, and showing "offline" would be a claim we cannot support. This is the same
  discipline as chipping a formula that cannot be evaluated instead of showing a confident zero.
- Rejoining restores write access because ownership is by Account id and never moved. Do not
  reassign character ownership on removal.
