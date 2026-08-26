/**
 * Migration tests (TICKET-DB-01, TICKET-AUTH-01)
 *
 * The milestone's forward-only rule: *"Each migration ships a test that applies it to the previous
 * schema and asserts the resulting shape."* For `0000_initial` the previous schema is an empty
 * database, so this file also pins the two properties every later migration inherits — running
 * twice is a no-op, and a failure leaves nothing of itself behind.
 *
 * `0001_auth_tables` is the first migration with a real previous schema, and its own block below
 * applies it to a database sitting at `0000` **with rows in it** — because "the resulting shape" is
 * only half the question, and the half that costs somebody their data is the other one.
 *
 * **Validates: v3 Req 46.2**
 */

import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import { createDatabase, type Database } from './client';
import { appliedMigrations, MigrationError, runMigrations } from './migrate';

/** Where the real migrations live */
const MIGRATIONS = join(dirname(fileURLToPath(import.meta.url)), 'migrations');

const open: Database[] = [];
const temporaryDirectories: string[] = [];

/** A fresh in-memory database, closed when the test ends */
function emptyDatabase(): Database {
  const database = createDatabase(':memory:');
  open.push(database);
  return database;
}

/** The tables a database currently has, excluding SQLite's and Drizzle's own bookkeeping */
function tableNames(database: Database): string[] {
  return database.sqlite
    .prepare(
      "SELECT name FROM sqlite_master WHERE type = 'table' " +
        "AND name NOT LIKE 'sqlite_%' AND name != '__drizzle_migrations' ORDER BY name"
    )
    .all()
    .map((row) => (row as { name: string }).name);
}

/** The columns of one table, by name */
function columnNames(database: Database, table: string): string[] {
  return database.sqlite
    .prepare(`PRAGMA table_info(${table})`)
    .all()
    .map((row) => (row as { name: string }).name)
    .sort();
}

/** A migrations folder holding exactly the SQL given, with the journal drizzle expects */
function migrationsFolderContaining(sql: string): string {
  const directory = mkdtempSync(join(tmpdir(), 'dnd-migrations-'));
  temporaryDirectories.push(directory);

  mkdirSync(join(directory, 'meta'), { recursive: true });
  writeFileSync(join(directory, '0000_probe.sql'), sql, 'utf8');
  writeFileSync(
    join(directory, 'meta', '_journal.json'),
    JSON.stringify({
      version: '7',
      dialect: 'sqlite',
      entries: [{ idx: 0, version: '6', when: 1, tag: '0000_probe', breakpoints: true }],
    }),
    'utf8'
  );

  return directory;
}

/**
 * The real migrations, truncated after the given index
 *
 * Copies the actual `.sql` files rather than a paraphrase of them, so *the previous schema* means
 * the schema the previous release really shipped — a hand-written approximation would be a second
 * copy of the migration, drifting.
 *
 * @param upToIdx The last migration to include, by journal index
 * @returns A folder drizzle's migrator will accept
 */
function migrationsUpTo(upToIdx: number): string {
  const directory = mkdtempSync(join(tmpdir(), 'dnd-migrations-'));
  temporaryDirectories.push(directory);
  mkdirSync(join(directory, 'meta'), { recursive: true });

  const journal = JSON.parse(
    readFileSync(join(MIGRATIONS, 'meta', '_journal.json'), 'utf8')
  ) as Journal;
  const entries = journal.entries.filter((entry) => entry.idx <= upToIdx);

  for (const entry of entries) {
    copyFileSync(join(MIGRATIONS, `${entry.tag}.sql`), join(directory, `${entry.tag}.sql`));
  }
  writeFileSync(
    join(directory, 'meta', '_journal.json'),
    JSON.stringify({ ...journal, entries }),
    'utf8'
  );

  return directory;
}

/** Drizzle's journal, as much of it as this file reads */
interface Journal {
  entries: { idx: number; tag: string }[];
}

/**
 * How many migrations this build carries
 *
 * Read from the journal rather than written as a number, so adding one is a new `describe` block
 * rather than a hunt for the two counts that now disagree — which is exactly what TICKET-AUTH-04
 * found when it added the third.
 */
const MIGRATION_COUNT = (
  JSON.parse(readFileSync(join(MIGRATIONS, 'meta', '_journal.json'), 'utf8')) as Journal
).entries.length;

afterEach(() => {
  for (const database of open.splice(0)) database.close();
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe('runMigrations', () => {
  describe('applied to an empty database', () => {
    it('creates the eleven tables the server needs', () => {
      const database = emptyDatabase();

      runMigrations(database);

      // Six from 0000_initial — the server's own model — four from 0001_auth_tables, which are
      // Better Auth's (TICKET-AUTH-01), and one from 0003_uploaded_characters (TICKET-IO-04).
      // Enumerated rather than counted, so that a table appearing or vanishing is a named
      // difference rather than an off-by-one.
      expect(tableNames(database)).toEqual([
        'account',
        'account_upload_prompt',
        'character',
        'event',
        'game_session',
        'ruleset',
        'session',
        'session_invite',
        'session_member',
        'user',
        'verification',
      ]);
    });

    it('gives a ruleset the two columns the server gates on, beside the document', () => {
      const database = emptyDatabase();

      runMigrations(database);

      // `schema_version` and `revision` are real columns because they are what the server queries
      // on; everything else about a Configuration is inside `data` (D4)
      expect(columnNames(database, 'ruleset')).toEqual([
        'created_at',
        'data',
        'id',
        'name',
        'owner_account_id',
        'revision',
        'schema_version',
        'updated_at',
      ]);
    });

    it('stores every timestamp as an integer rather than as text', () => {
      const database = emptyDatabase();

      runMigrations(database);

      const timestamps = database.sqlite
        .prepare('PRAGMA table_info(game_session)')
        .all()
        .filter((row) => (row as { name: string }).name.endsWith('_at'));

      expect(timestamps.length).toBeGreaterThan(0);
      for (const column of timestamps) {
        const { name, type } = column as { name: string; type: string };
        expect(type.toLowerCase(), name).toBe('integer');
      }
    });

    it('records each one, so a second run applies nothing', () => {
      const database = emptyDatabase();

      runMigrations(database);
      const afterFirst = appliedMigrations(database);
      runMigrations(database);

      // One entry per migration file this build carries, counted from the journal
      expect(afterFirst).toHaveLength(MIGRATION_COUNT);
      expect(appliedMigrations(database)).toEqual(afterFirst);
    });

    it('is a no-op the second time even for the tables it made', () => {
      const database = emptyDatabase();

      runMigrations(database);
      database.sqlite
        .prepare(
          'INSERT INTO ruleset (id, owner_account_id, name, schema_version, revision, data, ' +
            'created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
        )
        .run('r1', 'a1', 'Ducklets', 9, 1, '{}', 1, 1);

      runMigrations(database);

      // A re-run that dropped and recreated would lose this row rather than fail loudly
      expect(database.sqlite.prepare('SELECT COUNT(*) c FROM ruleset').get()).toEqual({ c: 1 });
    });
  });

  describe('0001_auth_tables, applied to a database sitting at 0000', () => {
    /** A database at the previous schema, with a row in it that must survive */
    function atZeroWithData(): Database {
      const database = emptyDatabase();
      runMigrations(database, migrationsUpTo(0));

      database.sqlite
        .prepare(
          'INSERT INTO ruleset (id, owner_account_id, name, schema_version, revision, data, ' +
            'created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
        )
        .run('r1', 'a1', 'Ducklets', 9, 1, '{"stats":[]}', 1, 1);

      return database;
    }

    it('starts from a schema with none of the auth tables', () => {
      // Otherwise the assertions below would pass against a database that already had them, which
      // is the way a migration test quietly stops testing the migration
      expect(tableNames(atZeroWithData())).not.toContain('user');
    });

    it('adds Better Auth’s four tables', () => {
      const database = atZeroWithData();

      runMigrations(database);

      for (const table of ['user', 'session', 'account', 'verification']) {
        expect(tableNames(database), table).toContain(table);
      }
    });

    it('gives them the columns Better Auth reads', () => {
      const database = atZeroWithData();

      runMigrations(database);

      expect(columnNames(database, 'user')).toEqual([
        'created_at',
        'email',
        'email_verified',
        'id',
        'image',
        'name',
        'updated_at',
      ]);
      // `token` is what the cookie carries and `expires_at` is what AUTH-04 rolls forward
      expect(columnNames(database, 'session')).toContain('token');
      expect(columnNames(database, 'session')).toContain('expires_at');
      // …and `password` is where the salted hash goes (v3 Req 30.3)
      expect(columnNames(database, 'account')).toContain('password');
    });

    it('makes an email unique, so the duplicate refusal is a constraint', () => {
      const database = atZeroWithData();
      runMigrations(database);

      const insert = database.sqlite.prepare(
        'INSERT INTO user (id, name, email, email_verified, created_at, updated_at) ' +
          'VALUES (?, ?, ?, ?, ?, ?)'
      );
      insert.run('u1', 'Ada', 'ada@example.com', 0, 1, 1);

      // v3 Req 30.2 as a database constraint rather than a check a handler has to remember
      expect(() => insert.run('u2', 'Someone', 'ada@example.com', 0, 1, 1)).toThrow(/UNIQUE/i);
    });

    it('leaves the rows that were already there', () => {
      const database = atZeroWithData();

      runMigrations(database);

      // The half of "the resulting shape" that costs somebody their data if it is wrong
      expect(database.sqlite.prepare('SELECT data FROM ruleset WHERE id = ?').get('r1')).toEqual({
        data: '{"stats":[]}',
      });
    });

    it('records itself beside 0000 rather than replacing it', () => {
      const database = atZeroWithData();
      const before = appliedMigrations(database);

      runMigrations(database);

      expect(before).toHaveLength(1);
      expect(appliedMigrations(database)).toHaveLength(MIGRATION_COUNT);
      // Forward-only means the earlier entry is still there and still first
      expect(appliedMigrations(database)[0]).toBe(before[0]);
    });
  });

  describe('0002_session_rotation, applied to a database sitting at 0001', () => {
    /** A database at the previous schema, with a session on it that must survive */
    function atOneWithASession(): Database {
      const database = emptyDatabase();
      runMigrations(database, migrationsUpTo(1));

      database.sqlite
        .prepare(
          'INSERT INTO user (id, name, email, email_verified, created_at, updated_at) ' +
            'VALUES (?, ?, ?, ?, ?, ?)'
        )
        .run('u1', 'Ada', 'ada@example.com', 0, 1, 1);
      database.sqlite
        .prepare(
          'INSERT INTO session (id, expires_at, token, created_at, updated_at, user_id) ' +
            'VALUES (?, ?, ?, ?, ?, ?)'
        )
        .run('s1', 2_000_000, 'the-original-token', 1, 1, 'u1');

      return database;
    }

    it('starts from a session table with neither rotation column', () => {
      // Otherwise everything below would pass against a database that already had them
      expect(columnNames(atOneWithASession(), 'session')).not.toContain('previous_token');
    });

    it('adds the two columns the grace window lives in', () => {
      const database = atOneWithASession();

      runMigrations(database);

      expect(columnNames(database, 'session')).toContain('previous_token');
      expect(columnNames(database, 'session')).toContain('previous_token_expires_at');
    });

    it('leaves an existing session signed in, with both columns empty', () => {
      const database = atOneWithASession();

      runMigrations(database);

      // **The half that would sign everybody out if it were wrong.** A session that predates
      // rotation has no previous identifier, and `NULL` is the honest spelling of that — which is
      // why neither column is `NOT NULL`.
      expect(
        database.sqlite.prepare('SELECT token, previous_token FROM session WHERE id = ?').get('s1')
      ).toEqual({ token: 'the-original-token', previous_token: null });
    });

    it('records itself beside the two before it', () => {
      const database = atOneWithASession();

      runMigrations(database);

      expect(appliedMigrations(database)).toHaveLength(MIGRATION_COUNT);
    });
  });

  describe('0003_uploaded_characters, applied to a database sitting at 0002', () => {
    /**
     * A database at the previous schema, with a seated character on it that must survive
     *
     * **This is the migration whose generated SQL the schema file warns about**: making a column
     * nullable in SQLite is a table recreate, and the `PRAGMA foreign_keys=OFF` drizzle-kit emits is
     * a **no-op inside a transaction**, which is where the migrator runs it. So the recreate happens
     * with foreign keys live, and the only honest way to know it survives that is to put a real row
     * behind a real foreign key and run it.
     */
    function atTwoWithACharacter(): Database {
      const database = emptyDatabase();
      runMigrations(database, migrationsUpTo(2));

      database.sqlite
        .prepare(
          'INSERT INTO ruleset (id, owner_account_id, name, schema_version, revision, data, ' +
            'created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
        )
        .run('r1', 'acc1', 'Ducklets', 2, 1, '{}', 1, 1);
      database.sqlite
        .prepare(
          'INSERT INTO game_session (id, ruleset_id, dm_account_id, name, status, snapshot, ' +
            'snapshot_schema_version, snapshot_taken_at, created_at, updated_at) ' +
            'VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
        )
        .run('g1', 'r1', 'acc1', 'Tuesday night', 'active', '{}', 2, 1, 1, 1);
      database.sqlite
        .prepare(
          'INSERT INTO character (id, session_id, owner_account_id, name, revision, data, ' +
            'created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
        )
        .run('c1', 'g1', 'acc1', 'Quackers', 1, '{"name":"Quackers"}', 1, 1);

      return database;
    }

    it('starts from a schema with neither the prompt table nor a nullable session', () => {
      const database = atTwoWithACharacter();

      // Otherwise everything below would pass against a database that already had them
      expect(tableNames(database)).not.toContain('account_upload_prompt');
      expect(() =>
        database.sqlite
          .prepare(
            'INSERT INTO character (id, session_id, owner_account_id, name, revision, data, ' +
              'created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
          )
          .run('c2', null, 'acc1', 'Unseated', 1, '{}', 1, 1)
      ).toThrow();
    });

    it('adds the table the once-per-Account prompt is claimed in', () => {
      const database = atTwoWithACharacter();

      runMigrations(database);

      expect(tableNames(database)).toContain('account_upload_prompt');
    });

    it('keeps the seated character, still pointing at its session', () => {
      const database = atTwoWithACharacter();

      runMigrations(database);

      // The row survived a `DROP TABLE character` performed with foreign keys enforced — the exact
      // thing the schema docblock says to test rather than assume
      expect(
        database.sqlite.prepare('SELECT id, session_id, name FROM character WHERE id = ?').get('c1')
      ).toEqual({ id: 'c1', session_id: 'g1', name: 'Quackers' });
    });

    it('lets a character exist at no table afterwards', () => {
      const database = atTwoWithACharacter();

      runMigrations(database);

      database.sqlite
        .prepare(
          'INSERT INTO character (id, session_id, owner_account_id, name, revision, data, ' +
            'created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
        )
        .run('c2', null, 'acc1', 'Unseated', 1, '{}', 1, 1);

      expect(
        database.sqlite.prepare('SELECT session_id FROM character WHERE id = ?').get('c2')
      ).toEqual({ session_id: null });
    });

    it('keeps the cascade, so deleting a session still takes its characters', () => {
      const database = atTwoWithACharacter();

      runMigrations(database);
      database.sqlite.prepare('DELETE FROM game_session WHERE id = ?').run('g1');

      // The recreate rewrote the foreign key; a migration that dropped the `ON DELETE cascade`
      // would leave a character behind pointing at a session that is gone
      expect(database.sqlite.prepare('SELECT id FROM character').all()).toEqual([]);
    });

    it('keeps both indexes on the recreated table', () => {
      const database = atTwoWithACharacter();

      runMigrations(database);

      const indexes = database.sqlite
        .prepare("SELECT name FROM sqlite_master WHERE type = 'index' AND tbl_name = 'character'")
        .all()
        .map((row) => (row as { name: string }).name);

      expect(indexes).toContain('character_session_idx');
      expect(indexes).toContain('character_owner_idx');
    });

    it('records itself beside the three before it', () => {
      const database = atTwoWithACharacter();

      runMigrations(database);

      expect(appliedMigrations(database)).toHaveLength(MIGRATION_COUNT);
    });
  });

  describe('a migration that fails', () => {
    it('refuses with a MigrationError naming the cause', () => {
      const database = emptyDatabase();
      const folder = migrationsFolderContaining('CREATE TABLE broken (');

      expect(() => runMigrations(database, folder)).toThrow(MigrationError);
    });

    it('leaves nothing of itself behind, so the schema is never half-applied', () => {
      const database = emptyDatabase();
      const folder = migrationsFolderContaining(
        'CREATE TABLE good_one (id TEXT);--> statement-breakpoint\nCREATE TABLE broken ('
      );

      expect(() => runMigrations(database, folder)).toThrow(MigrationError);

      // The first statement succeeded and the second did not; the transaction took both back
      expect(tableNames(database)).not.toContain('good_one');
      expect(appliedMigrations(database)).toEqual([]);
    });

    it('does not report itself as applied, so a fixed build retries it', () => {
      const database = emptyDatabase();
      const folder = migrationsFolderContaining('CREATE TABLE broken (');

      expect(() => runMigrations(database, folder)).toThrow(MigrationError);
      expect(appliedMigrations(database)).toEqual([]);
    });
  });
});
