/**
 * The session aggregate's queries (TICKET-GAM-01)
 *
 * The routes prove what a caller gets; this proves the two things a route cannot see. **A session
 * and its DM's seat are one write** — a session whose `session_member` row failed would be a table
 * its own DM is locked out of, because `requireDM` reads that table and not `dm_account_id`. And
 * **the writes report a missing row rather than inventing one**, which is what lets a handler tell
 * *deleted between the guard and the write* from *done*.
 *
 * **Validates: v3 Req 37.1, 37.3, 37.5**
 */

import { describe, expect, it } from 'vitest';
import { MEMBER_ROLE, SESSION_STATUS } from '../db/schema';
import {
  allGameSessions,
  realRulesetJson,
  seedAccount,
  seedMember,
  seedRuleset,
  seedSession,
  withTestDatabase,
} from '../testing';
import { type AppendEvent, appendEventWithin, eventsSince } from './eventRepository';
import {
  archiveGameSession,
  charactersInSession,
  findGameSession,
  findSessionMember,
  insertGameSession,
  listSessionsForAccount,
  refreshSessionSnapshot,
  updateSessionSnapshot,
} from './gameSessionRepository';

describe('insertGameSession', () => {
  it('seats the DM in the same write', () =>
    withTestDatabase((database) => {
      const dm = seedAccount();
      const ruleset = seedRuleset(database, { owner: dm });

      const session = insertGameSession(
        {
          id: 'session-under-test',
          rulesetId: ruleset.id,
          dmAccountId: dm.id,
          name: 'Tuesday night',
          snapshot: realRulesetJson(),
          snapshotSchemaVersion: ruleset.schemaVersion,
          now: 1_700_000_000_000,
          memberId: 'member-under-test',
        },
        database
      );

      expect(session.status).toBe(SESSION_STATUS.ACTIVE);
      expect(findSessionMember(session.id, dm.id, database)?.role).toBe(MEMBER_ROLE.DM);
    }));

  it('writes neither row when the membership cannot be stored', () =>
    withTestDatabase((database) => {
      const dm = seedAccount();
      const ruleset = seedRuleset(database, { owner: dm });
      const input = {
        rulesetId: ruleset.id,
        dmAccountId: dm.id,
        name: 'Tuesday night',
        snapshot: realRulesetJson(),
        snapshotSchemaVersion: ruleset.schemaVersion,
        now: 1_700_000_000_000,
      };

      insertGameSession({ ...input, id: 'session-one', memberId: 'member-clash' }, database);

      // A second session reusing the membership id: the session insert succeeds and the member
      // insert throws on the primary key, which is the shape of every real partial failure here
      expect(() =>
        insertGameSession({ ...input, id: 'session-two', memberId: 'member-clash' }, database)
      ).toThrow();

      // Without the transaction, `session-two` would be sitting here with nobody at it
      expect(allGameSessions(database).map((row) => row.id)).toEqual(['session-one']);
    }));
});

describe('listSessionsForAccount', () => {
  it('joins on the membership rather than on the denormalised DM column', () =>
    withTestDatabase((database) => {
      const dm = seedAccount();
      const player = seedAccount();
      const { session } = seedSession(database, { dm });
      seedMember(database, { session, account: player });

      // A listing that read `dm_account_id` would show the DM their game and the player nothing
      expect(listSessionsForAccount(player.id, database).map((row) => row.role)).toEqual([
        MEMBER_ROLE.PLAYER,
      ]);
      expect(listSessionsForAccount(dm.id, database).map((row) => row.role)).toEqual([
        MEMBER_ROLE.DM,
      ]);
    }));

  it('selects no snapshot, so a listing cannot be played from', () =>
    withTestDatabase((database) => {
      const dm = seedAccount();
      seedSession(database, { dm });

      expect('snapshot' in listSessionsForAccount(dm.id, database)[0]).toBe(false);
    }));

  it('is empty for an Account at no table', () =>
    withTestDatabase((database) => {
      expect(listSessionsForAccount(seedAccount().id, database)).toEqual([]);
    }));
});

describe('the writes that can miss', () => {
  it('reports a snapshot refresh against no such session', () =>
    withTestDatabase((database) => {
      expect(updateSessionSnapshot('never-minted', '{}', 9, 1, database)).toBeNull();
    }));

  it('reports an archive against no such session', () =>
    withTestDatabase((database) => {
      expect(archiveGameSession('never-minted', 1, database)).toBeNull();
    }));

  it('touches only the Snapshot, its version and when it was taken', () =>
    withTestDatabase((database) => {
      const { session } = seedSession(database);

      const refreshed = updateSessionSnapshot(
        session.id,
        '{"schemaVersion":9}',
        9,
        2_000,
        database
      );

      expect(refreshed?.snapshotTakenAt).toBe(2_000);
      // The table is the same table: where it came from and when it started are unchanged
      expect(refreshed?.rulesetId).toBe(session.rulesetId);
      expect(refreshed?.createdAt).toBe(session.createdAt);
      expect(refreshed?.name).toBe(session.name);
    }));

  it('archives without taking anything away', () =>
    withTestDatabase((database) => {
      const { session } = seedSession(database);

      const archived = archiveGameSession(session.id, 2_000, database);

      expect(archived?.status).toBe(SESSION_STATUS.ARCHIVED);
      expect(archived?.snapshot).toBe(session.snapshot);
      expect(findGameSession(session.id, database)?.snapshot).toBe(session.snapshot);
    }));
});

describe('refreshSessionSnapshot', () => {
  /** What a refresh has to be told, with the parts a test does not care about filled in */
  function refreshInput(sessionId: string, overrides: Record<string, unknown> = {}) {
    return {
      sessionId,
      snapshot: '{"schemaVersion":9}',
      schemaVersion: 9,
      now: 2_000,
      ...overrides,
    };
  }

  /**
   * The Event the refresh appends, as `recordEvent` would hand it down (TICKET-LIVE-02)
   *
   * **It refuses to append outside a transaction**, which is the property this whole function pair
   * exists for: the pin and the log entry have to land together, so a repository that called the
   * appender bare would be writing the Event in its own transaction and losing the guarantee. That
   * check costs one line here and would otherwise be untestable.
   *
   * @param sessionId Which table
   * @param id The Event's id — reused deliberately by the clash case below
   * @returns An appender in the shape `recordEvent` binds
   */
  function appender(sessionId: string, id: string): AppendEvent {
    return (tx) => {
      if (!tx) throw new Error('the refresh must append inside its own transaction');

      return appendEventWithin(tx, {
        id,
        sessionId,
        actorAccountId: 'account-under-test',
        type: 'session.snapshot_refreshed',
        payload: '{}',
        now: 2_000,
      });
    };
  }

  it('pins the Snapshot and records that it happened', () =>
    withTestDatabase((database) => {
      const { session } = seedSession(database);
      const append = appender(session.id, 'event-under-test');

      const refreshed = refreshSessionSnapshot(refreshInput(session.id), append, database);

      expect(refreshed?.written.snapshotTakenAt).toBe(2_000);
      expect(refreshed?.event.seq).toBe(1);

      const logged = eventsSince(session.id, 0, database);

      expect(logged).toHaveLength(1);
    }));

  it('writes neither half when the Event cannot be appended', () =>
    withTestDatabase((database) => {
      const { session } = seedSession(database);
      const pinnedBefore = findGameSession(session.id, database)?.snapshot;
      const clashing = appender(session.id, 'clash');

      refreshSessionSnapshot(refreshInput(session.id), clashing, database);

      // A second refresh reusing the event id: the update succeeds and the append throws on the
      // primary key, which is the shape of the failure `eventRepository` documents (it refuses a
      // duplicate `seq` and deliberately does not retry)
      const again = refreshInput(session.id, { snapshot: '{"schemaVersion":9,"x":1}' });
      const retry = () => refreshSessionSnapshot(again, clashing, database);

      expect(retry).toThrow();

      // Without the transaction the rules would have moved under a live table with nothing in the
      // log to say so — and LIVE-02 fans out from that log, so nobody would be told
      const pinnedAfter = findGameSession(session.id, database)?.snapshot;
      const logged = eventsSince(session.id, 0, database);

      expect(pinnedAfter).toBe('{"schemaVersion":9}');
      expect(pinnedBefore).not.toBe('{"schemaVersion":9}');
      expect(logged).toHaveLength(1);
    }));

  it('writes nothing at all against no such session', () =>
    withTestDatabase((database) => {
      const append = appender('never-minted', 'event-under-test');
      const input = refreshInput('never-minted');

      const refreshed = refreshSessionSnapshot(input, append, database);
      const logged = eventsSince('never-minted', 0, database);

      expect(refreshed).toBeNull();
      expect(logged).toHaveLength(0);
    }));
});

describe('charactersInSession', () => {
  it('is empty for a table nobody has made a character at', () =>
    withTestDatabase((database) => {
      const { session } = seedSession(database);

      expect(charactersInSession(session.id, database)).toEqual([]);
    }));
});
