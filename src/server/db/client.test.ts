/**
 * Connection tests (TICKET-DB-01)
 *
 * Small, and each one is here because getting it wrong is silent or fatal rather than obvious:
 * a missing pragma makes every `REFERENCES` clause decorative, and a missing directory stops the
 * server before it serves anything.
 *
 * **Validates: v3 Req 46.1, 46.4**
 */

import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { createDatabase, type Database } from './client';

const open: Database[] = [];
const temporaryDirectories: string[] = [];

/** A path inside a directory that does **not** exist yet */
function pathInMissingDirectory(): string {
  const root = mkdtempSync(join(tmpdir(), 'dnd-db-'));
  temporaryDirectories.push(root);
  return join(root, 'nested', 'deeper', 'app.db');
}

afterEach(() => {
  for (const database of open.splice(0)) database.close();
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe('createDatabase', () => {
  it('turns foreign keys on, which SQLite does not do by itself', () => {
    const database = createDatabase(':memory:');
    open.push(database);

    expect(database.sqlite.pragma('foreign_keys', { simple: true })).toBe(1);
  });

  it('creates the directory the file goes in', () => {
    // The default DATABASE_URL points into `data/`, which is gitignored — so on a fresh clone the
    // directory does not exist, and `new Database()` does not make one. Without this, the first
    // `yarn dev` on a clean machine dies at start-up with a raw SqliteError.
    const path = pathInMissingDirectory();

    const database = createDatabase(path);
    open.push(database);

    expect(existsSync(path)).toBe(true);
  });

  it('journals a real file in WAL mode', () => {
    const database = createDatabase(pathInMissingDirectory());
    open.push(database);

    // Readers do not block the writer — and the database becomes three files, which is why the
    // README says to back up the directory rather than the .db
    expect(database.sqlite.pragma('journal_mode', { simple: true })).toBe('wal');
  });

  it('does not ask an in-memory database for a journal it cannot have', () => {
    const database = createDatabase(':memory:');
    open.push(database);

    expect(database.sqlite.pragma('journal_mode', { simple: true })).toBe('memory');
  });
});
