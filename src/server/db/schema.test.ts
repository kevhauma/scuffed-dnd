/**
 * Schema constraint tests (TICKET-DB-01)
 *
 * Two things the criteria ask to be **pinned rather than assumed**: which way each relation goes
 * when its parent is deleted, and that `event.seq` is unique per session by constraint rather than
 * by application code being careful. Both are decisions the schema records in prose; these are what
 * make a silent change to one a failing test.
 *
 * They exercise the tables through raw SQL rather than through a repository on purpose — the
 * subject here is what the *database* enforces, and going through a repository would leave open
 * whether the repository was the thing being careful.
 *
 * **Validates: v3 Req 46.4, 46.5**
 */

import { afterEach, describe, expect, it } from 'vitest';
import { createDatabase, type Database } from './client';
import { runMigrations } from './migrate';

const open: Database[] = [];

/**
 * A migrated in-memory database
 *
 * Deliberately four lines here rather than a shared harness: **TICKET-DX-06 owns that**, and
 * building it now would be building it against two callers instead of the whole server suite.
 */
function migratedDatabase(): Database {
  const database = createDatabase(':memory:');
  open.push(database);
  runMigrations(database);
  return database;
}

/** A minimal session with a ruleset behind it, so the foreign keys have something to point at */
function seedSession(database: Database, sessionId = 's1', rulesetId: string | null = 'r1'): void {
  if (rulesetId) {
    database.sqlite
      .prepare(
        'INSERT INTO ruleset (id, owner_account_id, name, schema_version, revision, data, ' +
          'created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
      )
      .run(rulesetId, 'dm', 'Ducklets', 9, 1, '{}', 1, 1);
  }

  database.sqlite
    .prepare(
      'INSERT INTO game_session (id, ruleset_id, dm_account_id, name, status, snapshot, ' +
        'snapshot_schema_version, snapshot_taken_at, created_at, updated_at) ' +
        'VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    )
    .run(sessionId, rulesetId, 'dm', "Tuesday's game", 'active', '{}', 9, 1, 1, 1);
}

function count(database: Database, table: string): number {
  return (database.sqlite.prepare(`SELECT COUNT(*) c FROM ${table}`).get() as { c: number }).c;
}

afterEach(() => {
  for (const database of open.splice(0)) database.close();
});

describe('the server schema', () => {
  it('enforces foreign keys at all, which SQLite does not do by default', () => {
    const database = migratedDatabase();

    // The pragma is per *connection*, so a schema full of REFERENCES clauses enforces nothing
    // until `client.ts` says so — this is the test that catches its removal
    expect(database.sqlite.pragma('foreign_keys', { simple: true })).toBe(1);

    expect(() =>
      database.sqlite
        .prepare(
          'INSERT INTO session_member (id, session_id, account_id, role, joined_at) ' +
            'VALUES (?, ?, ?, ?, ?)'
        )
        .run('m1', 'no-such-session', 'a1', 'player', 1)
    ).toThrow(/FOREIGN KEY/i);
  });

  describe('what happens to a session when its ruleset is deleted', () => {
    it('keeps the session and nulls the pointer, because the snapshot is a copy (D7)', () => {
      const database = migratedDatabase();
      seedSession(database);

      database.sqlite.prepare('DELETE FROM ruleset WHERE id = ?').run('r1');

      const session = database.sqlite
        .prepare('SELECT ruleset_id, snapshot FROM game_session WHERE id = ?')
        .get('s1') as { ruleset_id: string | null; snapshot: string };

      // What is lost is provenance, not rules — a live game must not end because the DM tidied up
      expect(session.ruleset_id).toBeNull();
      expect(session.snapshot).toBe('{}');
    });
  });

  describe('what happens to a session’s contents when the session is deleted', () => {
    it('cascades to members, invites, characters and events', () => {
      const database = migratedDatabase();
      seedSession(database);

      database.sqlite
        .prepare(
          'INSERT INTO session_member (id, session_id, account_id, role, joined_at) ' +
            'VALUES (?, ?, ?, ?, ?)'
        )
        .run('m1', 's1', 'a1', 'player', 1);
      database.sqlite
        .prepare(
          'INSERT INTO session_invite (id, session_id, code, expires_at, created_at) ' +
            'VALUES (?, ?, ?, ?, ?)'
        )
        .run('i1', 's1', 'CODE1', 2, 1);
      database.sqlite
        .prepare(
          'INSERT INTO character (id, session_id, owner_account_id, name, revision, data, ' +
            'created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
        )
        .run('c1', 's1', 'a1', 'Aria', 1, '{}', 1, 1);
      database.sqlite
        .prepare(
          'INSERT INTO event (id, session_id, seq, actor_account_id, type, payload, created_at) ' +
            'VALUES (?, ?, ?, ?, ?, ?, ?)'
        )
        .run('e1', 's1', 1, 'a1', 'joined', '{}', 1);

      database.sqlite.prepare('DELETE FROM game_session WHERE id = ?').run('s1');

      // A membership of a session that no longer exists grants nothing, and an event about it
      // describes nothing — the game is the unit, deliberately
      expect(count(database, 'session_member')).toBe(0);
      expect(count(database, 'session_invite')).toBe(0);
      expect(count(database, 'character')).toBe(0);
      expect(count(database, 'event')).toBe(0);
    });
  });

  describe('the constraints that hold rather than the code being careful', () => {
    it('refuses a second membership for the same Account in the same session', () => {
      const database = migratedDatabase();
      seedSession(database);

      const insert = database.sqlite.prepare(
        'INSERT INTO session_member (id, session_id, account_id, role, joined_at) ' +
          'VALUES (?, ?, ?, ?, ?)'
      );
      insert.run('m1', 's1', 'a1', 'player', 1);

      expect(() => insert.run('m2', 's1', 'a1', 'dm', 2)).toThrow(/UNIQUE/i);
    });

    it('refuses two events claiming the same sequence number in one session', () => {
      const database = migratedDatabase();
      seedSession(database);

      const insert = database.sqlite.prepare(
        'INSERT INTO event (id, session_id, seq, actor_account_id, type, payload, created_at) ' +
          'VALUES (?, ?, ?, ?, ?, ?, ?)'
      );
      insert.run('e1', 's1', 1, null, 'rolled', '{}', 1);

      expect(() => insert.run('e2', 's1', 1, null, 'rolled', '{}', 2)).toThrow(/UNIQUE/i);
    });

    it('lets two sessions each have their own event 1', () => {
      const database = migratedDatabase();
      seedSession(database, 's1', 'r1');
      seedSession(database, 's2', null);

      const insert = database.sqlite.prepare(
        'INSERT INTO event (id, session_id, seq, actor_account_id, type, payload, created_at) ' +
          'VALUES (?, ?, ?, ?, ?, ?, ?)'
      );
      insert.run('e1', 's1', 1, null, 'rolled', '{}', 1);
      insert.run('e2', 's2', 1, null, 'rolled', '{}', 1);

      // The sequence is per session, not global — LIVE-03 replays one room at a time
      expect(count(database, 'event')).toBe(2);
    });

    it('refuses a second DM in one session, while allowing any number of players', () => {
      const database = migratedDatabase();
      seedSession(database);

      const insert = database.sqlite.prepare(
        'INSERT INTO session_member (id, session_id, account_id, role, joined_at) ' +
          'VALUES (?, ?, ?, ?, ?)'
      );
      insert.run('m1', 's1', 'dm', 'dm', 1);
      insert.run('m2', 's1', 'p1', 'player', 1);
      insert.run('m3', 's1', 'p2', 'player', 1);

      // v3 Req 39.2, as a partial unique index rather than as a check a handler has to remember
      expect(() => insert.run('m4', 's1', 'p3', 'dm', 1)).toThrow(/UNIQUE/i);
    });

    it('lets each session have its own DM', () => {
      const database = migratedDatabase();
      seedSession(database, 's1', 'r1');
      seedSession(database, 's2', null);

      const insert = database.sqlite.prepare(
        'INSERT INTO session_member (id, session_id, account_id, role, joined_at) ' +
          'VALUES (?, ?, ?, ?, ?)'
      );
      insert.run('m1', 's1', 'dm1', 'dm', 1);
      insert.run('m2', 's2', 'dm2', 'dm', 1);

      expect(count(database, 'session_member')).toBe(2);
    });

    it('refuses two invites sharing a code, whichever session they belong to', () => {
      const database = migratedDatabase();
      seedSession(database, 's1', 'r1');
      seedSession(database, 's2', null);

      const insert = database.sqlite.prepare(
        'INSERT INTO session_invite (id, session_id, code, expires_at, created_at) ' +
          'VALUES (?, ?, ?, ?, ?)'
      );
      insert.run('i1', 's1', 'DUCK42', 2, 1);

      // A code is how a table actually joins, so it has to identify one session and not two
      expect(() => insert.run('i2', 's2', 'DUCK42', 2, 1)).toThrow(/UNIQUE/i);
    });
  });
});
