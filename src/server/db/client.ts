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
 * **Nothing outside `db/`, `repositories/` and `testing/` may import this module or Drizzle** —
 * `queries-belong-to-repositories` in `.dependency-cruiser.mjs` since TICKET-DX-08.
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

/**
 * Replace the process's database, and hand back what was there (TICKET-DX-06)
 *
 * **The one seam a test has into a handler's connection.** A route does not take a database — it
 * calls something in `db/` or a repository, and those reach `getDatabase()`. Without this, testing
 * `GET /api/health` against a fresh schema would mean either giving every handler a parameter it
 * has no production use for, or letting the pipeline import this module, which is exactly what
 * `queries-belong-to-repositories` forbids.
 *
 * It returns the previous value rather than being a plain setter so the caller can restore it,
 * which is what makes `withTestDatabase` safe to nest and safe when a test throws.
 *
 * **This does not close anything.** Whoever opened a database closes it; a setter that also
 * disposed would make an ordinary swap destructive.
 *
 * Named `setProcessDatabase` rather than `useDatabase` because in a React codebase a `use` prefix
 * means a hook, and Biome's `useHookAtTopLevel` reads it as one — the linter was right about the
 * name even though it was wrong about the code.
 *
 * **The residual risk, named rather than implied.** `test-harness-stays-in-tests` keeps production
 * code out of `server/testing/`, which is what pays for the harness reaching this module. It does
 * not fence *this function*: `db/` and `repositories/` may call it, and a call from either would
 * point the whole process at a different database. Nothing does, and nothing should — the only
 * legitimate caller is `withTestDatabase`. If a second one ever appears, it is a decision to take
 * here rather than a convenience to take there.
 *
 * @param database The connection to install, or `null` to fall back to `DATABASE_URL`
 * @returns The connection that was installed before, or `null` if none was
 */
export function setProcessDatabase(database: Database | null): Database | null {
  const previous = opened;
  opened = database;
  return previous;
}
