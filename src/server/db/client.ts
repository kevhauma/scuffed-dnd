/**
 * The database connection (TICKET-DB-01)
 *
 * One SQLite file holding every piece of server state, opened once per process. Synchronous
 * `better-sqlite3` is the right shape for a single-process app of this size
 * ([D2](../../../docs/v3.0_backend/overview.md#d2--sqlite-through-drizzle-migrations-through-drizzle-kit)):
 * there is no connection pool to reason about, a transaction is a function call, and every
 * repository is trivially testable against an in-memory database.
 *
 * Two pragmas are not optional and are set on every connection:
 *
 * - **`foreign_keys = ON`** — SQLite defaults it *off*, per connection, which means a schema full
 *   of `REFERENCES` clauses enforces nothing until someone says so. Every cascade this milestone
 *   relies on is a lie without this line.
 * - **`journal_mode = WAL`** — readers do not block the writer. It also makes the database three
 *   files rather than one, which is why POL-03's backup instructions say to copy the set or to
 *   `VACUUM INTO` rather than to copy the `.db`.
 *
 * **Nothing outside `server/repositories/` may import this module or Drizzle.** TICKET-DX-08 turns
 * that into a dependency-cruiser rule; until then it is a convention with a criterion behind it.
 *
 * **Validates: v3 Req 46.1, 46.4**
 */

import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import BetterSqlite3 from 'better-sqlite3';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { serverEnv } from '../env';
import * as schema from './schema';

/** A connection, its Drizzle wrapper, and the way to let go of both */
export interface Database {
  /** The query builder every repository uses */
  db: BetterSQLite3Database<typeof schema>;
  /** The raw connection, for pragmas and for the migrator */
  sqlite: BetterSqlite3.Database;
  close(): void;
}

/**
 * Open a database
 *
 * @param url A file path, or `:memory:`
 * @returns The connection, with WAL and foreign keys already on
 */
export function createDatabase(url: string): Database {
  if (url !== ':memory:') {
    // `new Database()` does not create missing parent directories, and the default `DATABASE_URL`
    // points into `data/`, which is gitignored — so a fresh clone has nowhere to put the file and
    // start-up would fail with a raw `SqliteError` before serving anything
    mkdirSync(dirname(resolve(url)), { recursive: true });
  }

  const sqlite = new BetterSqlite3(url);

  // An in-memory database has no file to journal to, and asking for WAL there is a no-op that
  // returns 'memory' rather than an error — set it only where it means something
  if (url !== ':memory:') sqlite.pragma('journal_mode = WAL');
  sqlite.pragma('foreign_keys = ON');

  return {
    db: drizzle(sqlite, { schema }),
    sqlite,
    close: () => sqlite.close(),
  };
}

/** Opened once, then reused — one process, one file */
let opened: Database | null = null;

/**
 * The process's database
 *
 * Lazy for the same reason `serverEnv()` is: a module that reaches the database must stay
 * importable by a test that does not want one.
 *
 * @returns The shared connection
 */
export function getDatabase(): Database {
  opened ??= createDatabase(serverEnv().databaseUrl);
  return opened;
}
