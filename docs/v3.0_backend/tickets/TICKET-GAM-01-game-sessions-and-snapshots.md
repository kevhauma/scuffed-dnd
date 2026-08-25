# TICKET-GAM-01 — Game sessions and pinned Snapshots

- **Area:** Game sessions (new area)
- **Type:** Feature
- **Traceability:** v3 [Req 37](../requirements.md#requirement-37-game-session-lifecycle); overview
  [D7](../overview.md#d7--a-game-session-plays-against-a-pinned-snapshot)

## User story

As a DM, I want to start a session from one of my rulesets, so that my table plays against a fixed
set of rules that my later tinkering cannot disturb mid-campaign.

## Description

The second owned resource, and the room everything after it is scoped to. Its defining decision is
D7: the session copies the ruleset at creation and plays against that copy. A DM renaming a stat on
Thursday does not re-price every character at Friday's table.

## Current situation (as-is)

- No concept of a table, a group, or more than one person. A `Character` carries `configurationId`
  and is read against "the" configuration.
- RUL-03 gave us `copyConfiguration()` in the Kernel — the Snapshot is that function with a
  different destination.
- AUTH-03's `requireMember`/`requireDM` guards exist and have had no rows to guard until now.

## Desired result (to-be)

- `game_session` records with create / read / archive routes: created from a Ruleset the Account
  owns, recording the creator as DM, with a `snapshot` document and `snapshot_taken_at`. Archived
  sessions read but accept no writes.
- Every rule evaluated in a session reads the **Snapshot**, never the live Ruleset — enforced by the
  session's read path returning the Snapshot and by nothing in `src/server/` loading a Ruleset by
  the session's `ruleset_id` for gameplay.
- An explicit `POST /api/sessions/:id/snapshot` refresh, recorded as an Event, **refused** when the
  new Snapshot would leave an existing Character invalid, naming what breaks.

## Acceptance criteria

- [ ] Creating a session from a corpus ruleset stores a Snapshot deep-equal to it, sharing no object
      identity — the same structural assertion RUL-03 made, run through this path.
- [ ] Editing the source Ruleset after creation changes nothing about the session: a character's
      calculated values are identical before and after the edit.
- [ ] A Snapshot refresh that removes a stat a character has invested in is refused, and the
      response names the stat and the character — not a generic failure.
- [ ] A successful refresh writes an Event and updates `snapshot_taken_at`.
- [ ] An archived session refuses every write route with a distinct status and still serves reads.
- [ ] Anonymous, non-member, member and DM each get the documented outcome on create, read, archive
      and refresh (Definition of Done rule 2).
- [ ] Verified via the `verifier` subagent, the `fallow` skill, and the `coding-conventions` skill,
      plus a live browser check (ask the User first).

## Notes

- **Point `seedSession` at this ticket's repository when it lands** (TICKET-DX-06).
  `src/server/testing/seeds.ts` writes `game_session` and `session_member` with raw Drizzle,
  because no session repository existed when the harness was built. That is a second definition of
  what a session row looks like — the same defect DX-06 removed from `eventRepository.test.ts` —
  and it is only tolerable while it is temporary. This ticket is where it stops being temporary.
- **The refusal in criterion three is the ticket's real content.** Without it, D7 only defers the
  problem: the DM eventually refreshes and breaks the table anyway, just later and with less
  warning. Reuse the Kernel — a character is invalid against a Snapshot exactly when
  `validateStatAllocation` rejects it or an invested stat id is absent — rather than writing a new
  notion of validity.
- Storing the whole Snapshot per session duplicates a ruleset per table. That is accepted: a
  ruleset is tens of kilobytes, a table is a long-lived thing, and the alternative (a
  content-addressed ruleset-version table) is a versioning system, which
  [overview.md](../overview.md#d0--no-backend-is-reversed-deliberately) put out of scope.
- The DM is recorded on the session **and** as a `session_member` row with role `dm`. Two places is
  a denormalisation, and it is deliberate: GAM-04 transfers the role, and a single membership table
  is what makes "who is in this session" one query.
