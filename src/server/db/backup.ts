/**
 * A backup that restores, rather than one that usually restores (TICKET-POL-03)
 *
 * WAL mode makes the database **three** files — `app.db`, `app.db-wal` and `app.db-shm` — and the
 * committed truth at any instant is spread across the first two. Copying `app.db` with `cp` while
 * the server is running therefore produces a file that restores *usually*: the copy is a moment
 * that never existed, and how wrong it is depends on how busy the process was. A backup that fails
 * loudly is worth more than one that fails quietly a year later, which is why this exists as a
 * command rather than as a paragraph telling an operator to copy carefully.
 *
 * `VACUUM INTO` is SQLite's own answer. It writes a **new, consistent, single-file** database from
 * the connection's current transactional view — no WAL companions to keep together, no quiescing,
 * no stopping the server. The result is an ordinary database file: restoring is putting it where
 * `DATABASE_URL` points and starting the process.
 *
 * Lives in `db/` because it holds the connection, which `queries-belong-to-repositories` allows
 * only here, in `repositories/` and in `testing/`. It is re-exported from `entry.ts` so that
 * `scripts/backup.mjs` can reach it in the built artefact — that bundle is the one door there is.
 *
 * **Validates: v3 Req 46** — its **user story**, "backing the game up is copying a file", rather
 * than a numbered criterion: none of 46.1–46.6 is about the backup, and 46.1 (the file's path is
 * configuration) is a different claim that this module happens to sit next to. A citation nobody
 * can check against is worse than none, because `spec-navigator` quotes it as fact.
 */

import { existsSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { type Database, getDatabase } from './client';

/** A backup that could not be written */
export class BackupError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BackupError';
  }
}

/**
 * Write a consistent copy of the database to a file
 *
 * **Refuses an existing destination rather than overwriting one.** A backup command that silently
 * replaces yesterday's file is a command that turns one bad night into no history at all, and the
 * cost of the rule is typing a date into a file name.
 *
 * @param destination Where to write the copy; parent directories are created
 * @param database The connection to copy; defaults to the process's own
 * @returns The absolute path written
 * @throws {BackupError} If the destination exists, or SQLite refuses to write it
 */
export function backupDatabase(destination: string, database: Database = getDatabase()): string {
  const path = resolve(destination);

  if (existsSync(path)) {
    throw new BackupError(
      `${path} already exists. A backup never overwrites one — name the file for the moment it ` +
        'captures, or move the old one aside first.'
    );
  }

  try {
    // Inside the `try` with the write itself, because a failure here is the same failure to the
    // operator — *the backup did not happen, and here is why* — and an unwrapped `ENOTDIR` from
    // `mkdir` is an errno rather than a sentence. Found by the test below rather than reasoned
    // about: the first draft let it escape.
    const parent = dirname(path);
    mkdirSync(parent, { recursive: true });

    // Bound as a parameter rather than interpolated: a path is not SQL, and one containing a quote
    // is a file name rather than an interesting afternoon
    const vacuum = database.sqlite.prepare('VACUUM INTO ?');
    vacuum.run(path);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new BackupError(`The backup to ${path} could not be written: ${reason}`);
  }

  return path;
}
