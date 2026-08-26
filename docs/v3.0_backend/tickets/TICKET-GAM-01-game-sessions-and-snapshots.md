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

## Implementation notes (2026-08-26)

**This ticket adds no user-visible surface, deliberately.** The to-be is *"`game_session` records with
create / read / archive routes"*, and the milestone's build order puts the first surface that shows
other people in GAM-04 — GAM-02's join-by-code is what a table actually uses, and a lobby before
either would be a lobby with nothing to join. So the five routes exist and nothing in the client
calls them yet. The browser criterion is honoured as *nothing regressed*, which is stated below
rather than left implied.

**`readSession`, not `getSession`.** `pipeline.test.ts` scans every module under `src/server/` for
the word `getSession` and asserts exactly one names it — `auth/currentAccount.ts`, the only place a
request may become an Account. That guard is deliberately blunt, and a route called `getSession`
would have cost the milestone's identity check to save a synonym.

**The Snapshot keeps the ruleset's own name**, which is where this differs from `copyRuleset`. That
route makes a derivative — "Ducklets (copy)" — because the User will see two rulesets in a list. A
Snapshot is not a second ruleset in anybody's list: the table's name is the session's own `name`, and
renaming the rules would make what a player reads disagree with what the DM wrote.

**Refusing a refresh needed `charactersInSession` on the session repository rather than the character
one.** *Which characters are at this table* is a question about the session — it is the thing a
refresh has to ask before it is allowed to happen. TICKET-CHAR-04 brings the reads that are about a
character.

### What the `conventions-reviewer` pass changed (2026-08-26)

Seven findings. **The first is the one to read**, because it was a landmine under the exact thing
this ticket exists to protect and no test in the suite could have found it:

1. **A refresh minted a new `Configuration.id`, orphaning every character at the table.**
   `copyConfiguration` replaces the document's id — correctly, for a *copy* — and the refresh used
   it unchanged. A character says which rules it was built against with `configurationId`, and
   `useCharacterSheet` renders *configuration-mismatch* when that disagrees with the loaded
   document, so a refresh that `snapshotConflicts` had **cleared** would blank every sheet at the
   table. The check could never have caught it: `validateStatAllocation` is about allocations, and a
   document's own id is not one. `CopyOptions` gained an `id` — the caller RUL-03's review said
   would come — and the refresh passes the Snapshot's existing one. Pinned by
   *"leaves the Snapshot's own id alone, so no character is orphaned"* and re-checked in the browser
   across two consecutive refreshes.
2. **`MEMBER_ROLE` and `SESSION_STATUS` existed twice**, in `db/schema.ts` and in the new wire
   contract, with the shared copy's own docblock arguing against second declarations while being
   one. The schema now imports them from `#shared/types/api` and re-exports, so the SQLite enum
   arrays and the partial index's SQL are generated from the same list the client branches on.
3. **The Snapshot write and its Event were two transactions.** `appendEvent` can be refused by its
   unique `seq` index and deliberately does not retry, so a refresh could have moved the rules under
   a live table with nothing in the log to say so — and LIVE-02 fans out from that log.
   `refreshSessionSnapshot` does both in one transaction, with a test that makes the append throw.
4. **`snapshotConflicts` 500'd on an unparseable `data` column** rather than answering with the
   *cannot read* conflict its own reasoning describes.
5. **Two selected columns nothing read** — `dmAccountId` and `snapshotSchemaVersion` on the summary
   query. GAM-04's lobby adds `dmAccountId` back with the surface that reads it.
6. **`nameFrom` had become a one-line wrapper** under a twelve-line docblock while its sibling
   argued against exactly that shape. Both aggregates export the noun now, and the three ruleset
   callers say `requiredName(body, RULESET_SUBJECT)`.
7. **A stale docblock** in `seeds.ts` still explaining the absence of the `findGameSession` this
   ticket added.

**The review also named a gap in this ticket's own to-be, and it is now closed.** D7 was asked to be
*"enforced by … nothing in `src/server/` loading a Ruleset by the session's `ruleset_id` for
gameplay"*, and that half was only prose in docblocks — dependency-cruiser cannot see it, because
`refreshSnapshot` imports `findRuleset` legitimately and the obligation is about *why*.
[`pinnedSnapshot.test.ts`](../../../src/server/routes/sessions/pinnedSnapshot.test.ts) is the source
scan, in `routeGuards.test.ts`'s shape, with a **two-entry** allow-list. Writing it found a second
defect immediately: the first marker list named only the guards and `sessionIdFrom`, so
`createSession` — the one route that unarguably reads a Ruleset — slipped the scan entirely.

## Acceptance criteria

- [x] Creating a session from a corpus ruleset stores a Snapshot deep-equal to it, sharing no object
      identity — the same structural assertion RUL-03 made, run through this path.
      (`sessions.test.ts` *"stores a document deep-equal to the ruleset it came from"* and *"shares
      no object with the source, anywhere in the document"* — the second walks both documents in
      step with `sharedPaths` and expects the list of shared objects to be empty, which is
      `copyConfiguration.test.ts`'s assertion run through this path. The deep-equal one compares
      **display forms**: every document the server writes goes through `serializeConfiguration`, so
      a reference the corpus file spells by name comes back id-resolved — a difference in how a
      reference is written down, not in what it points at, and asserting on stored bytes would pin
      the corpus's spelling rather than the rule.)
- [x] Editing the source Ruleset after creation changes nothing about the session: a character's
      calculated values are identical before and after the edit.
      (`sessions.test.ts` *"leaves a character's calculated values identical after the ruleset is
      edited"* — doubles every `point_buy` row on the ruleset, then calls `calculateCharacter`
      against the session's Snapshot before and after and asserts the same number. Deliberately not
      a document comparison: a session that silently re-read the ruleset would produce a different
      value, and comparing documents could pass while the code that plays the game did not use it.)
- [x] A Snapshot refresh that removes a stat a character has invested in is refused, and the
      response names the stat and the character — not a generic failure.
      (`sessions.test.ts` *"refuses a refresh that removes a stat a character invested in, naming
      both"* — 409, one conflict, `characterName` "Quackers" and the stat's name in the `reason`.
      The name comes from the **old** Snapshot, because a removed stat has none in the new one.
      *"reports every character that would break, not the first"* covers the plural case, and
      *"changes nothing when it refuses"* asserts the pinned column is byte-identical and no Event
      was written.)
- [x] A successful refresh writes an Event and updates `snapshot_taken_at`.
      (`sessions.test.ts` *"writes an Event saying the rules moved"* — one `session.snapshot_refreshed`
      event with the DM as actor — and *"pulls the ruleset's current state in, and stamps when"*,
      which asserts the renamed stat arrives and `snapshotTakenAt` moved.)
- [x] An archived session refuses every write route with a distinct status and still serves reads.
      (`sessions.test.ts` *"refuses every write once archived, with a status of its own"* — **409**
      on both archive and refresh, which is a status neither 404 nor 403: the caller may read this
      table and nothing about their request is malformed, so what refuses them is its state.
      *"leaves the table readable afterwards"* proves the read half, Snapshot included. The rule is
      one function, `requireActive`, called by every write and by none of the reads.)
- [x] Anonymous, non-member, member and DM each get the documented outcome on create, read, archive
      and refresh (Definition of Done rule 2).
      (One case per route in `sessions.test.ts`: create is 401/404-for-non-owner/200; read is
      401/404/200 for **both** Members; archive and refresh are 401/404 for a stranger/404 for a
      *player*/200 for the DM — a player gets the stranger's answer deliberately, because which
      refusal they meet should not depend on how much they already know. `listSessions` refuses an
      anonymous caller and scopes by membership, asserted by a third Account seeing nothing.
      `refreshSnapshot` also refuses a DM who no longer owns the ruleset, which GAM-04's transfer
      makes reachable.)
- [x] Verified via the `verifier` subagent, the `fallow` skill, and the `coding-conventions` skill,
      plus a live browser check (ask the User first).
      (`npx vitest run` 2526 passed / 0 failed / 0 skipped; `npx tsc --noEmit` at the documented
      2-error baseline; `yarn run check` and `yarn run lint --max-diagnostics=1000` both clean;
      `fallow audit --base main` verdict **pass** with 0 introduced dead code, complexity or
      duplication. Everything fallow *did* find was fixed rather than suppressed: an unused
      `SnapshotRefusal` type, duplicate `GameSessionRow`/`SessionMemberRow`/`nameFrom`/`toSummary`
      exports, and the 25-line name-validator clone that produced `entityName.ts`.
      `conventions-reviewer` found seven defects plus a gap in this ticket's own to-be, all closed —
      see the section above. **The browser check has two halves.** This ticket adds no surface, so
      *nothing regressed* is the first: `/rulesets` and the signed-out loop behave as they did
      before. The second is the five routes driven end to end against `yarn dev` with a real session
      cookie — create → read → refresh → archive → **409** on a write to an archived table → still
      readable — plus a re-check of the Snapshot-identity fix, which held its document id across two
      consecutive refreshes.)

## Notes

- ~~**Point `seedSession` at this ticket's repository when it lands** (TICKET-DX-06).~~ **Done.**
  `seedSession` goes through `insertGameSession`, so the seeded row is the row a real
  `POST /api/sessions` produces, and the fixture's own `GameSessionRow` / `SessionMemberRow` /
  `CharacterRow` declarations became re-exports of the repositories' — `fallow` reported the
  re-inferred ones as duplicate exports, which is the same second-definition defect one level down.
  `seedCharacter` still writes raw Drizzle; **TICKET-CHAR-04 is where that stops being temporary.**
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
