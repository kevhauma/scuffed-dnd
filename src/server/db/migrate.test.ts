/**
 * Migration tests (TICKET-DB-01)
 *
 * The milestone's forward-only rule: *"Each migration ships a test that applies it to the previous
 * schema and asserts the resulting shape."* For `0000_initial` the previous schema is an empty
 * database, so this file also pins the two properties every later migration inherits — running
 * twice is a no-op, and a failure leaves nothing of itself behind.
 *
 * **Validates: v3 Req 46.2**
 */

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { createDatabase, type Database } from './client';
import { appliedMigrations, MigrationError, runMigrations } from './migrate';

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

afterEach(() => {
  for (const database of open.splice(0)) database.close();
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe('runMigrations', () => {
  describe('0000_initial, applied to an empty database', () => {
    it('creates the six tables the server model needs', () => {
      const database = emptyDatabase();

      runMigrations(database);

      expect(tableNames(database)).toEqual([
        'character',
        'event',
        'game_session',
        'ruleset',
        'session_invite',
        'session_member',
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

    it('records itself, so a second run applies nothing', () => {
      const database = emptyDatabase();

      runMigrations(database);
      const afterFirst = appliedMigrations(database);
      runMigrations(database);

      expect(afterFirst).toHaveLength(1);
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
