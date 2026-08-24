/**
 * Applying migrations at start-up (TICKET-DB-01)
 *
 * **Upgrading is starting the process.** There is no separate migrate command an operator has to
 * remember between pulling a new build and restarting it, because the one they would forget is the
 * one that matters. `entry.ts` calls this as it loads, and a failure there means the process
 * refuses to serve rather than serving a half-migrated schema.
 *
 * **Migrations are forward-only.** There are no `down` files, deliberately: a rollback of a schema
 * change that has already accepted writes is a data question, not a schema question, and a `down`
 * file makes it look like a button. Recovery is the backup POL-03 documents.
 *
 * Drizzle's migrator runs each file in a transaction and records it in `__drizzle_migrations`, so
 * running this twice is a no-op and a file that throws leaves *nothing* of itself behind.
 *
 * **Validates: v3 Req 46.2**
 */

import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { type Database, getDatabase } from './client';

/**
 * Where the SQL lives
 *
 * Resolved from this module rather than from the working directory, so that the answer does not
 * depend on where the process was started. TICKET-POL-03 is what makes sure the folder is beside
 * the built server too — a migration runner that cannot find its migrations fails loudly at
 * start-up, which is the right time to find out.
 */
const MIGRATIONS_DIR = join(dirname(fileURLToPath(import.meta.url)), 'migrations');

/** A start-up that could not bring the schema up to date */
export class MigrationError extends Error {
  constructor(cause: unknown) {
    super(
      'The database schema could not be brought up to date, so the server will not start. ' +
        `Nothing was half-applied — each migration runs in a transaction. Cause: ${
          cause instanceof Error ? cause.message : String(cause)
        }`
    );
    this.name = 'MigrationError';
    this.cause = cause;
  }
}

/**
 * Bring a database up to the current schema
 *
 * Both parameters default, so the start-up call is `runMigrations()` and `entry.ts` imports only
 * this module. That is not tidiness: it means the rule TICKET-DX-08 writes — *only `db/` and
 * `repositories/` may import the connection* — can be a path prefix rather than an exception
 * naming a file.
 *
 * @param database The connection to migrate; defaults to the process's own
 * @param migrationsFolder Where the SQL lives; defaults to the folder beside this module
 * @throws {MigrationError} If any migration fails — the caller must not go on to serve
 */
export function runMigrations(
  database: Database = getDatabase(),
  migrationsFolder = MIGRATIONS_DIR
): void {
  try {
    migrate(database.db, { migrationsFolder });
  } catch (error) {
    throw new MigrationError(error);
  }
}

/**
 * The migrations this build carries, newest last
 *
 * Read from the journal drizzle-kit maintains rather than by listing the folder, so a stray `.sql`
 * file that was never registered does not read as an applied migration.
 *
 * @param database A migrated connection
 * @returns The hashes drizzle recorded, in the order they were applied
 */
export function appliedMigrations(database: Database): string[] {
  const table = database.sqlite
    .prepare(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name = '__drizzle_migrations'"
    )
    .get();

  if (!table) return [];

  return database.sqlite
    .prepare('SELECT hash FROM __drizzle_migrations ORDER BY created_at ASC')
    .all()
    .map((row) => (row as { hash: string }).hash);
}
