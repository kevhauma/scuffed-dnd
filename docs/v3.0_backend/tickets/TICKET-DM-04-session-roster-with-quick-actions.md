# TICKET-DM-04 — The session roster with quick actions

- **Area:** Dungeon Master controls
- **Type:** Feature
- **Traceability:** v3
  [Req 49.7–49.10](../requirements.md#requirement-49-dungeon-master-quick-actions),
  [Req 39.7](../requirements.md#requirement-39-membership-and-roles),
  [Req 44](../requirements.md#requirement-44-live-updates)

## User story

As a DM running a fight, I want every character's health and points in one list with the actions
beside them, so that a round of combat is a column of presses rather than five page visits.

## Description

The DM's cockpit, and the milestone's **last feature ticket**. It turns GAM-04's membership lobby
into a live roster — who is here, where their pools stand — and puts DM-03's quick actions on each
row.

**Deliberately last, after LIVE-03.** A roster is the surface that most obviously has to be live: a
DM watching a stale list is worse off than one reading sheets, because the list looks authoritative.
Building it before the event feed and presence exist would mean building it twice.

## Current situation (as-is)

- GAM-04 built the session lobby: every Member with their role, their characters, and a connection
  column reading "unknown" until presence existed.
- LIVE-02 broadcasts every Event to the session's room and taught the client to apply one without
  refetching. LIVE-03 filled in real presence and made a stale surface say so.
- DM-03 derived the quick-action set from the Snapshot and proved it in the character-sheet sidebar.
  This ticket adds a second placement of the same definition — not a second definition.
- There is no surface anywhere showing more than one character's numbers at once.

## Desired result (to-be)

- The lobby becomes a **roster**: one row per Character with its owner, level, unspent points, and
  current-versus-maximum for every `isResource` stat in the Snapshot — derived, like the actions,
  rather than named in the source.
- DM-03's quick actions inline on each row, from the same `quickActionsFor(snapshot)` definition, so
  the roster and the sidebar cannot offer different actions or apply them differently.
- The roster is live: it applies LIVE-02's Events — including another Member's own spends and rolls —
  and carries LIVE-03's presence and staleness treatment rather than a second one.

## Acceptance criteria

- [ ] The roster shows every Character in the session with owner, level, unspent points and each
      resource's current/maximum; a Snapshot resource added later appears with no code change.
- [ ] Row actions and the DM-03 sidebar render from **one** definition — a test asserts the two
      produce the same action set for the same Snapshot (v3 Req 49.7).
- [ ] A quick action from a row and the same action from the sidebar issue the identical request.
- [ ] A player spending points in their own browser moves that row in the DM's roster with no
      refresh; so does another Member's roll and the DM's own adjustment.
- [ ] Presence and staleness come from LIVE-03 — the roster shows who is connected, and says so when
      the connection is down rather than presenting stale numbers as live.
- [ ] A `player` viewing the session sees the roster **without** quick actions, and the server
      refuses the requests regardless (v3 Req 49.10).
- [ ] A value that cannot be calculated — a level off the end of the XP curve, a resource whose
      formula is broken — chips in its cell rather than showing a confident number, reusing
      `ErrorChip` through `toDerivedValue`.
- [ ] The roster replaces GAM-04's lobby rather than sitting beside it; there is exactly one member
      list in the application.
- [ ] Verified via the `verifier` subagent, the `fallow` skill, and the `coding-conventions` skill,
      plus a live browser check with two accounts in two browsers (ask the User first).

## Notes

- **One list, not two.** GAM-04's lobby and this roster answer the same question and must not both
  exist — the eighth criterion is there because "add a new page" is the path of least resistance and
  leaves a DM with two member lists that disagree about who is present.
- **A stale roster is worse than no roster.** A DM reads this list and acts on it without checking,
  which is exactly why it waited for LIVE-03: the staleness treatment is not polish here, it is the
  thing that stops a DM taking 7 off a character who already died four minutes ago.
- Chipping an uncalculable cell rather than showing 0 is the same instinct the engine's error values
  encode, and it matters more in a dense grid than on a sheet — twenty confident numbers with one
  quiet lie in them is harder to catch than one chipped cell.
- A roster wants sorting, grouping and filtering the moment a table has six players. **Not in this
  ticket** — ship the list in a stable order (member, then character name) and let the User ask.
- **Inherited from TICKET-DM-05: a DM reading somebody's sheet sees an empty roll history**, and this
  ticket is one of the two that owns fixing it.
  [`useRoller`](../../../src/client/components/play/rolls/useRoller.ts) narrows the session's roll log
  with `?rolledBy=<the reader's own accountId>` — right while the only reader was the character's own
  Player, since it is what stops their rolls falling off a busy table's capped window, and wrong for a
  DM, who then asks for *their own* rolls against somebody else's character and gets none. DM-05 made
  the roll **buttons** absent for a DM (`rollDice.ts` refuses them) and deliberately left the log
  alone, because the table-wide view is this roster's and
  [TICKET-LIVE-02](./TICKET-LIVE-02-event-fan-out-and-reconciliation.md)'s — building half of it early
  means building it twice. Whichever lands first should decide whether the sheet's own history panel
  widens for a DM or defers to the roster entirely.
