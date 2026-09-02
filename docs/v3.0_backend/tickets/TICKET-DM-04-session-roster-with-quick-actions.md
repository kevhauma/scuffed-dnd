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

## Decided while building (2026-09-01)

Four things this ticket inherited by name, each settled before the code was written and recorded here
rather than in a commit message.

**Membership Events are *not* this ticket's, and the ownership moved rather than evaporating.**
[TICKET-LIVE-02](./TICKET-LIVE-02-event-fan-out-and-reconciliation.md)'s criterion 1 handed them here
on a *duplication* argument — a member-list applier built before the roster would be built twice —
and that argument is spent the moment the roster exists. What settles it is a different one that
nobody had made: `applyEventToCharacter` answers **`stale`** for a type it cannot apply, so shipping
membership Events without also deciding what the applier does with them means **every open sheet at
the table refetches on every join and leave**. That is a behaviour change to a hot path, and it
belongs in a ticket whose criteria mention it. v3 Req 49.9 is the supporting half: it asks the roster
to update *from Events*, and membership changes are not in the log at all. LIVE-02's own note is
amended in place, and the work is
[TICKET-LIVE-04](./TICKET-LIVE-04-membership-events-and-the-member-list-applier.md) (User, 2026-09-01).
The decision is **checked rather than written down**: `eventFanOut.test.ts`'s *offers exactly two ways
in* was verified by mutation against an added `appendMembershipEvent`, so it cannot be reversed
quietly.

**The DM's empty roll history defers to the roster rather than widening the sheet's panel.** The note
below poses exactly that choice. Deferring needs neither of the two things the fan-out ticket flagged
as decisions above a ticket's pay grade — no second `json_extract`, no `character_id` column — because
`GET /api/sessions/:id/rolls` **already** answers the table's whole log when nothing narrows it, and
its own docblock says so and names this ticket. So the roster reads it unnarrowed and is complete from
the table's first roll rather than from socket-open, and the sheet's panel stops lying by omission:
`useRoller` hands `RollHistoryPanel` a sentence pointing here instead of drawing an empty list.
**`logRoomFor`'s DM branch and its mutation-verified test are untouched** — the DM still joins no room
for that log.

**`SessionCharacters` is replaced too, which widens criterion 8 below.** That criterion says *exactly
one member list*; a roster with one row per Character **is** the character list, so leaving CHAR-04's
panel beside it would be the two-lists-that-disagree failure one aggregate over. Both components are
deleted and every case from both test files moved.

**A roll moves the roster's log rather than a character's row**, which is criterion 4 read honestly: a
roll changes nothing stored on a character, so no row can move for one. What the criterion asks for —
*the roster updates from another Member's roll without a refresh* — is satisfied by the table log
above, and the criterion is amended to say which.

## Acceptance criteria

- [x] The roster shows every Character in the session with owner, level, unspent points and each
      resource's current/maximum; a Snapshot resource added later appears with no code change.
      (`src/client/components/sessions/roster/rosterView.ts` derives every cell from the Snapshot —
      `calculateCharacterLevel`, `validateStatAllocation` → `toPointBudgetView`, and one pool per
      `isResource` stat in the ruleset's own order. `rosterView.test.ts` — *grows a column when the
      Snapshot grows a resource, with no code change (v3 Req 49.2)* adds a fourth resource to the
      fixture and asserts two more cells **and two more quick actions**;
      `SessionRoster.test.tsx` — *shows each character's level, unspent points and every resource* and
      *reads a pool as current against maximum*. Owner comes from the group the row sits under —
      `MemberGroup.tsx`.)
- [x] Row actions and the DM-03 sidebar render from **one** definition — a test asserts the two
      produce the same action set for the same Snapshot (v3 Req 49.7).
      (The derivation moved out of `useCharacterSheet` to
      `play/shared/characterQuickActions.ts`'s `quickActionsForCharacter`, which **both** placements
      call. `roster/rosterQuickActions.test.tsx` — *derives the same action set on the sheet and on the
      roster (v3 Req 49.7)* compares the real `useCharacterSheet` output against the real
      `toRosterView` output for one fixture Snapshot, and *moves both when the Snapshot gains a
      resource, rather than one of them* makes that a claim about a shared derivation rather than two
      lists that match today.)
- [x] A quick action from a row and the same action from the sidebar issue the identical request.
      (Both render the sidebar's own `play/dm/QuickActionRow` bound to `useQuickActionBindings`.
      `rosterQuickActions.test.tsx` — *issues the identical request for each kind of action
      (v3 Req 49.3)* asserts the two `requests` tables are equal, and *reaches the same store action
      with the same arguments from either placement* drives both and asserts the two calls are
      identical — `[characterId, statId, -7]`, a delta. `quickActionRoutes.test.ts` already checks
      that table against `apiRouter` as text.)
- [x] A player spending points in their own browser moves that row in the DM's roster with no
      refresh; ~~so does another Member's roll~~ **a roll moves the table log rather than a row, for
      the reason recorded above**; and so does the DM's own adjustment.
      (`roster/useRosterFeed.ts` runs every Event through the sheet's own `applyEventToCharacter`.
      `useRosterFeed.test.ts` — *patches a row from a DM's adjustment, with no request at all*,
      *re-reads once for a burst of changes it cannot apply (v3 Req 49.9)* (four point spends → one
      request), and *does nothing at all for a roll, which stores nothing*.
      `useSessionRollLog.test.ts` — *adds a roll that arrives live, spelled from the table's own
      names*.)
- [x] Presence and staleness come from LIVE-03 — the roster shows who is connected, and says so when
      the connection is down rather than presenting stale numbers as live.
      (`SessionRoster.tsx` holds **one** `useLiveRoom` for the whole list and hands each
      `MemberGroup` a state decided by `presenceStateOf`; `LiveStatusNotice` sits above the rows.
      Four `components/live/` modules imported, none redrawn. `SessionRoster.test.tsx` — *says the
      connection is unknown rather than claiming offline, when there is no feed*, *names who is
      connected and who is away, once there is a live feed*, and *goes back to unknown the moment the
      feed is not live*.)
- [x] A `player` viewing the session sees the roster **without** quick actions, and the server
      refuses the requests regardless (v3 Req 49.10).
      (`rosterQuickActions.test.tsx` — *offers a player none at all — absent, not disabled
      (v3 Req 49.10)*, which also asserts the roster still drew, so it cannot pass by rendering
      nothing. **And none on a DM's own character** — *offers a DM none on their own character, whom
      the server refuses them* — because `requireCharacterDM` is `requireCharacterWriter` minus the
      owner. The server half is `routes/dm/dmRules.test.ts`' existing walk, unchanged.)
- [x] A value that cannot be calculated — a level off the end of the XP curve, a resource whose
      formula is broken — chips in its cell rather than showing a confident number, reusing
      `ErrorChip` through `toDerivedValue`.
      (`CharacterRosterRow.tsx`'s `Cell` and `Pool` both draw `ErrorChip` off a `DerivedValue`.
      `rosterView.test.ts` — *chips a resource whose formula is broken rather than showing a number*
      and *chips the level when the curve cannot price it*; `SessionRoster.test.tsx` asserts the
      rendered chips by accessible name. A whole row the engine **threw** on chips too, rather than
      emptying the roster — `RosterCharacter.failure`.)
- [x] The roster replaces GAM-04's lobby rather than sitting beside it; there is exactly one member
      list in the application — **and CHAR-04's `SessionCharacters` with it, see above**.
      (`SessionLobby.tsx`, `SessionLobby.test.tsx`, `SessionCharacters.tsx` and
      `SessionCharacters.test.tsx` are deleted; every case from both moved into
      `roster/SessionRoster.test.tsx`. Enforcement rather than prose:
      `roster/oneMemberList.test.ts` walks the whole client tree and fails on any module outside
      `roster/` naming `SessionMemberListing` or `SessionMemberSummary` — **verified by mutation**,
      adding that import to `SessionsPanel.tsx` turns it red — plus a case asserting the walk found
      >200 modules so it cannot pass by scanning nothing, and one asserting neither retired file
      survives unimported.)
- [ ] Verified via the `verifier` subagent, the `fallow` skill, and the `coding-conventions` skill,
      plus a live browser check with two accounts in two browsers (ask the User first).
      **Open on its live half only.** The User declined interactive browser checks for the rest of the
      milestone on 2026-09-01, as recorded on every ticket in this run. The rest is done: the suite is
      green at 4245 across 256 files, `npx tsc --noEmit` is at the documented 2-error baseline,
      `yarn run check` is clean, and `fallow` charged one complexity finding which was **split rather
      than suppressed** (`useCoalescedReads` out of `useRosterFeed`). The `conventions-reviewer` is the
      caller's to run.

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
  ticket is one of the two that owns fixing it. **Settled by deferring to the roster** — see *Decided
  while building* above.
  [`useRoller`](../../../src/client/components/play/rolls/useRoller.ts) narrows the session's roll log
  with `?rolledBy=<the reader's own accountId>` — right while the only reader was the character's own
  Player, since it is what stops their rolls falling off a busy table's capped window, and wrong for a
  DM, who then asks for *their own* rolls against somebody else's character and gets none. DM-05 made
  the roll **buttons** absent for a DM (`rollDice.ts` refuses them) and deliberately left the log
  alone, because the table-wide view is this roster's and
  [TICKET-LIVE-02](./TICKET-LIVE-02-event-fan-out-and-reconciliation.md)'s — building half of it early
  means building it twice. Whichever lands first should decide whether the sheet's own history panel
  widens for a DM or defers to the roster entirely.
