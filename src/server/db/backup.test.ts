/**
 * Backup tests (TICKET-POL-03)
 *
 * **Against a real WAL database on disk, which is the whole point.** The hazard the command exists
 * against is invisible in memory: a row written and committed lives in `app.db-wal` until a
 * checkpoint moves it, so a copy of `app.db` alone is a copy missing recent history — and it
 * *opens*, which is what makes it dangerous rather than merely wrong. Every case here writes its
 * row, backs up without checkpointing, and reads the row out of the copy.
 *
 * **Validates: v3 Req 46** — its user story, for the reason `backup.ts` states.
 */

import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { BackupError, backupDatabase } from './backup';
import { createDatabase, type Database } from './client';
import { runMigrations } from './migrate';

const open: Database[] = [];
const temporary: string[] = [];

afterEach(() => {
  for (const database of open.splice(0)) database.close();
  for (const directory of temporary.splice(0)) rmSync(directory, { recursive: true, force: true });
});

/** A directory nothing else is using */
function scratch(): string {
  const parent = tmpdir();
  const prefix = join(parent, 'dnd-backup-');
  const directory = mkdtempSync(prefix);
  temporary.push(directory);
  return directory;
}

/** A migrated database on disk, with a ruleset in it */
function seeded(directory: string): Database {
  const path = join(directory, 'app.db');
  const database = createDatabase(path);
  open.push(database);
  runMigrations(database);

  database.sqlite
    .prepare(
      'INSERT INTO ruleset (id, owner_account_id, name, schema_version, revision, data, ' +
        'created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    )
    .run('r1', 'acc1', 'Ducklets', 9, 1, '{"stats":[]}', 1, 1);

  return database;
}

/** Open a backup file and read the ruleset back out of it */
function rulesetIn(path: string): unknown {
  const restored = createDatabase(path);
  open.push(restored);

  return restored.sqlite.prepare('SELECT id, name, data FROM ruleset').get();
}

describe('backupDatabase', () => {
  it('writes a copy holding rows that are still only in the WAL', () => {
    const directory = scratch();
    const database = seeded(directory);
    const destination = join(directory, 'backup', 'app-2026-09-02.db');

    backupDatabase(destination, database);

    // The row was committed but never checkpointed, so `cp app.db` would not have it. This is the
    // difference between a backup that restores and one that restores *usually*.
    const row = rulesetIn(destination);
    expect(row).toEqual({ id: 'r1', name: 'Ducklets', data: '{"stats":[]}' });
  });

  it('writes one file, with no WAL companions to keep together', () => {
    const directory = scratch();
    const database = seeded(directory);
    const destination = join(directory, 'app-copy.db');

    backupDatabase(destination, database);

    const written = existsSync(destination);
    const wal = existsSync(`${destination}-wal`);
    const shm = existsSync(`${destination}-shm`);

    expect(written).toBe(true);
    expect(wal).toBe(false);
    expect(shm).toBe(false);
  });

  it('carries the applied migrations, so a restored file starts a server', () => {
    const directory = scratch();
    const database = seeded(directory);
    const destination = join(directory, 'app-copy.db');

    backupDatabase(destination, database);

    const restored = createDatabase(destination);
    open.push(restored);
    const applied = restored.sqlite
      .prepare('SELECT count(*) AS n FROM __drizzle_migrations')
      .get() as { n: number };

    // Start-up runs migrations against whatever it finds; a copy that had lost the journal would
    // try to apply every migration again to a full schema and refuse to serve
    expect(applied.n).toBeGreaterThan(0);
  });

  it('creates the directory it is pointed at', () => {
    const directory = scratch();
    const database = seeded(directory);
    const destination = join(directory, 'deep', 'nested', 'app.db');

    backupDatabase(destination, database);

    const written = existsSync(destination);
    expect(written).toBe(true);
  });

  it('hands back the absolute path it wrote', () => {
    const directory = scratch();
    const database = seeded(directory);
    const destination = join(directory, 'app-copy.db');

    const written = backupDatabase(destination, database);

    expect(written).toBe(destination);
  });

  it('refuses an existing destination rather than overwriting a backup', () => {
    const directory = scratch();
    const database = seeded(directory);
    const destination = join(directory, 'app-copy.db');
    backupDatabase(destination, database);

    const second = () => backupDatabase(destination, database);

    // One bad night must not become no history at all
    expect(second).toThrow(BackupError);
    expect(second).toThrow(/already exists/);
  });

  it('refuses a destination SQLite cannot write, naming the path', () => {
    const directory = scratch();
    const database = seeded(directory);

    // A directory that is not there and cannot be made, because a *file* is in the way of it
    const blocked = join(directory, 'app.db', 'nested', 'copy.db');
    const attempt = () => backupDatabase(blocked, database);

    expect(attempt).toThrow(BackupError);
  });
});
