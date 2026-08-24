/**
 * Event repository tests (TICKET-DB-01)
 *
 * The log is append-only and its sequence numbers are per session, gapless and unrepeatable —
 * LIVE-02's fan-out and LIVE-03's replay both rest on that, so it is worth pinning here rather than
 * discovering later that two events shared a number under load.
 *
 * **Validates: v3 Req 46.5, 44.5, 44.6**
 */

import { afterEach, describe, expect, it } from 'vitest';
import { createDatabase, type Database } from '../db/client';
import { runMigrations } from '../db/migrate';
import { appendEvent, eventsSince } from './eventRepository';

const open: Database[] = [];

/** A migrated in-memory database. TICKET-DX-06 replaces this with the shared harness. */
function migratedDatabase(): Database {
  const database = createDatabase(':memory:');
  open.push(database);
  runMigrations(database);
  return database;
}

/** Two sessions, so "per session" can actually be tested */
function seedSessions(database: Database): void {
  const insert = database.sqlite.prepare(
    'INSERT INTO game_session (id, ruleset_id, dm_account_id, name, status, snapshot, ' +
      'snapshot_schema_version, snapshot_taken_at, created_at, updated_at) ' +
      'VALUES (?, NULL, ?, ?, ?, ?, ?, ?, ?, ?)'
  );
  insert.run('s1', 'dm', 'Tuesday', 'active', '{}', 9, 1, 1, 1);
  insert.run('s2', 'dm', 'Thursday', 'active', '{}', 9, 1, 1, 1);
}

function append(database: Database, id: string, sessionId: string, type = 'rolled') {
  return appendEvent(database, {
    id,
    sessionId,
    actorAccountId: 'a1',
    type,
    payload: '{"total":17}',
    now: 1,
  });
}

afterEach(() => {
  for (const database of open.splice(0)) database.close();
});

describe('eventRepository', () => {
  describe('appendEvent', () => {
    it('numbers the first event in a session 1', () => {
      const database = migratedDatabase();
      seedSessions(database);

      expect(append(database, 'e1', 's1').seq).toBe(1);
    });

    it('numbers each following event one higher, with no gaps', () => {
      const database = migratedDatabase();
      seedSessions(database);

      const seqs = ['e1', 'e2', 'e3'].map((id) => append(database, id, 's1').seq);

      // A gap would make LIVE-03's "what have I missed since 41?" unanswerable
      expect(seqs).toEqual([1, 2, 3]);
    });

    it('counts per session rather than globally', () => {
      const database = migratedDatabase();
      seedSessions(database);

      append(database, 'e1', 's1');
      append(database, 'e2', 's1');

      expect(append(database, 'e3', 's2').seq).toBe(1);
    });

    it('carries the payload back unchanged', () => {
      const database = migratedDatabase();
      seedSessions(database);

      expect(append(database, 'e1', 's1').payload).toBe('{"total":17}');
    });

    it('accepts a null actor, for what the server itself did', () => {
      const database = migratedDatabase();
      seedSessions(database);

      const row = appendEvent(database, {
        id: 'e1',
        sessionId: 's1',
        actorAccountId: null,
        type: 'snapshot_pulled',
        payload: '{}',
        now: 1,
      });

      expect(row.actorAccountId).toBeNull();
    });

    it('refuses an event for a session that does not exist', () => {
      const database = migratedDatabase();

      expect(() => append(database, 'e1', 'no-such-session')).toThrow(/FOREIGN KEY/i);
    });
  });

  describe('eventsSince', () => {
    it('returns everything after the sequence number the caller has', () => {
      const database = migratedDatabase();
      seedSessions(database);
      append(database, 'e1', 's1');
      append(database, 'e2', 's1');
      append(database, 'e3', 's1');

      expect(eventsSince(database, 's1', 1).map((row) => row.seq)).toEqual([2, 3]);
    });

    it('returns the whole log for 0', () => {
      const database = migratedDatabase();
      seedSessions(database);
      append(database, 'e1', 's1');
      append(database, 'e2', 's1');

      expect(eventsSince(database, 's1', 0)).toHaveLength(2);
    });

    it('returns nothing when the caller is already up to date', () => {
      const database = migratedDatabase();
      seedSessions(database);
      append(database, 'e1', 's1');

      expect(eventsSince(database, 's1', 1)).toEqual([]);
    });

    it('never returns another session’s events', () => {
      const database = migratedDatabase();
      seedSessions(database);
      append(database, 'e1', 's1');
      append(database, 'e2', 's2');

      expect(eventsSince(database, 's1', 0).map((row) => row.id)).toEqual(['e1']);
    });
  });
});
