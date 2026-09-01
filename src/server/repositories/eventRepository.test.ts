/**
 * Event repository tests (TICKET-DB-01, TICKET-DX-06)
 *
 * The log is append-only and its sequence numbers are per session, gapless and unrepeatable —
 * LIVE-02's fan-out and LIVE-03's replay both rest on that, so it is worth pinning here rather than
 * discovering later that two events shared a number under load.
 *
 * TICKET-DX-06 replaced this file's own `migratedDatabase()`, its `afterEach` bookkeeping and its
 * hand-written `INSERT INTO game_session` with the shared harness. Nothing it asserts changed —
 * and the raw SQL going is the point of the harness rather than a tidy-up: it was a second
 * definition of what a session row looks like, which a migration would have had to remember.
 *
 * **Validates: v3 Req 46.5, 44.5, 44.6**
 */

import { describe, expect, it } from 'vitest';
import type { Database } from '../db/client';
import { seedSession, withTestDatabase } from '../testing';
import { appendEvent, eventsSince, latestEventSeq } from './eventRepository';

/** Two sessions, so "per session" can actually be tested. Every case below refers to them by id. */
function seedTwoSessions(database: Database): void {
  seedSession(database, { id: 's1', name: 'Tuesday' });
  seedSession(database, { id: 's2', name: 'Thursday' });
}

function append(database: Database, id: string, sessionId: string, type = 'rolled') {
  return appendEvent(
    {
      id,
      sessionId,
      actorAccountId: 'a1',
      type,
      payload: '{"total":17}',
      now: 1,
    },
    database
  );
}

describe('eventRepository', () => {
  describe('appendEvent', () => {
    it('numbers the first event in a session 1', () =>
      withTestDatabase((database) => {
        seedTwoSessions(database);

        expect(append(database, 'e1', 's1').seq).toBe(1);
      }));

    it('numbers each following event one higher, with no gaps', () =>
      withTestDatabase((database) => {
        seedTwoSessions(database);

        const seqs = ['e1', 'e2', 'e3'].map((id) => append(database, id, 's1').seq);

        // A gap would make LIVE-03's "what have I missed since 41?" unanswerable
        expect(seqs).toEqual([1, 2, 3]);
      }));

    it('counts per session rather than globally', () =>
      withTestDatabase((database) => {
        seedTwoSessions(database);

        append(database, 'e1', 's1');
        append(database, 'e2', 's1');

        expect(append(database, 'e3', 's2').seq).toBe(1);
      }));

    it('carries the payload back unchanged', () =>
      withTestDatabase((database) => {
        seedTwoSessions(database);

        expect(append(database, 'e1', 's1').payload).toBe('{"total":17}');
      }));

    it('accepts a null actor, for what the server itself did', () =>
      withTestDatabase((database) => {
        seedTwoSessions(database);

        const row = appendEvent(
          {
            id: 'e1',
            sessionId: 's1',
            actorAccountId: null,
            type: 'snapshot_pulled',
            payload: '{}',
            now: 1,
          },
          database
        );

        expect(row.actorAccountId).toBeNull();
      }));

    it('refuses an event for a session that does not exist', () =>
      withTestDatabase((database) => {
        expect(() => append(database, 'e1', 'no-such-session')).toThrow(/FOREIGN KEY/i);
      }));
  });

  describe('eventsSince', () => {
    it('returns everything after the sequence number the caller has', () =>
      withTestDatabase((database) => {
        seedTwoSessions(database);
        append(database, 'e1', 's1');
        append(database, 'e2', 's1');
        append(database, 'e3', 's1');

        expect(eventsSince('s1', 1, database).map((row) => row.seq)).toEqual([2, 3]);
      }));

    it('returns the whole log for 0', () =>
      withTestDatabase((database) => {
        seedTwoSessions(database);
        append(database, 'e1', 's1');
        append(database, 'e2', 's1');

        expect(eventsSince('s1', 0, database)).toHaveLength(2);
      }));

    it('returns nothing when the caller is already up to date', () =>
      withTestDatabase((database) => {
        seedTwoSessions(database);
        append(database, 'e1', 's1');

        expect(eventsSince('s1', 1, database)).toEqual([]);
      }));

    it('never returns another session’s events', () =>
      withTestDatabase((database) => {
        seedTwoSessions(database);
        append(database, 'e1', 's1');
        append(database, 'e2', 's2');

        expect(eventsSince('s1', 0, database).map((row) => row.id)).toEqual(['e1']);
      }));
  });

  describe('latestEventSeq', () => {
    it('answers 0 for a session nothing has happened in', () =>
      withTestDatabase((database) => {
        seedTwoSessions(database);

        // Zero rather than null, because it is compared against a client's *last seen* on the very
        // next line of the replay — and *I have seen nothing* is the same number
        const head = latestEventSeq('s1', database);

        expect(head).toBe(0);
      }));

    it('answers with the highest sequence number in the session', () =>
      withTestDatabase((database) => {
        seedTwoSessions(database);
        append(database, 'e1', 's1');
        append(database, 'e2', 's1');
        append(database, 'e3', 's1');

        const head = latestEventSeq('s1', database);

        expect(head).toBe(3);
      }));

    it('counts per session, like the numbers themselves', () =>
      withTestDatabase((database) => {
        seedTwoSessions(database);
        append(database, 'e1', 's1');
        append(database, 'e2', 's1');
        append(database, 'e3', 's2');

        const other = latestEventSeq('s2', database);

        // A global maximum here would make every reconnecting client of a quiet table look
        // catastrophically behind, and send them all to a full resynchronise
        expect(other).toBe(1);
      }));

    it('answers 0 for a session that does not exist', () =>
      withTestDatabase((database) => {
        const head = latestEventSeq('no-such-session', database);

        expect(head).toBe(0);
      }));
  });
});
