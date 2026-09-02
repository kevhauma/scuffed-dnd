/**
 * Build-time: the migrations travel with the built server (TICKET-POL-03)
 *
 * `src/server/db/migrate.ts` resolves its SQL from **its own module directory** rather than from
 * the working directory, so that the answer does not depend on where the process was started. In
 * the bundle that directory is `dist/server/`, and until this plugin existed nothing put the
 * migrations there: the built server started, tried to migrate, and failed on a folder the build
 * had never created. That module's own docblock named this ticket as what fixes it.
 *
 * **Emitted through Rollup rather than copied afterwards.** `this.emitFile` makes the SQL part of
 * the build's output — a missing or unreadable migration fails the build, where a `cp` in a
 * postbuild script would fail after it, on a machine that had already declared success. It also
 * means the files land in whatever `outDir` the server environment is configured with, rather than
 * in a path this plugin would otherwise have to guess.
 *
 * **The journal is what decides the set**, not a directory listing: drizzle-kit records every
 * migration it generated in `meta/_journal.json`, and `runMigrations` reads that file to know what
 * to apply. Emitting from the journal means a stray `.sql` nobody registered is not shipped as
 * though it were a migration, and a journal entry with no file fails the build loudly here instead
 * of at an operator's first start-up.
 */

import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

/** Where drizzle-kit writes, per `drizzle.config.ts` */
const MIGRATIONS_SOURCE = resolve(process.cwd(), 'src', 'server', 'db', 'migrations');

/** Where `migrate.ts` looks, relative to the emitted entry — the two have to agree */
const MIGRATIONS_OUTPUT = 'migrations';

/**
 * The journal drizzle's migrator reads before anything else
 *
 * Two spellings on purpose: Rollup's `fileName` is always POSIX, and the disk read is always the
 * platform's. Building one with `join` and then undoing it with `replaceAll('\\', '/')` was a round
 * trip that only looked like reuse.
 */
const JOURNAL_PATH = ['meta', '_journal.json'];

const JOURNAL_FILE_NAME = JOURNAL_PATH.join('/');

/** The environment holding the server build — see `no-server-in-client-bundle.mjs` for the name */
const SERVER_ENVIRONMENT = 'ssr';

/**
 * Every migration the journal registers, newest last
 *
 * @param {string} journal The parsed journal's text
 * @returns {string[]} File names, with the `.sql` extension drizzle leaves off its entries
 */
function migrationFiles(journal) {
  /** @type {{ entries?: { tag: string }[] }} */
  const parsed = JSON.parse(journal);
  const entries = parsed.entries ?? [];
  return entries.map((entry) => `${entry.tag}.sql`);
}

/** @returns {import('vite').Plugin} */
export function serverMigrations() {
  return {
    name: 'dnd:server-migrations',
    apply: 'build',
    generateBundle() {
      if (this.environment && this.environment.name !== SERVER_ENVIRONMENT) return;

      const journalPath = join(MIGRATIONS_SOURCE, ...JOURNAL_PATH);
      const journal = readFileSync(journalPath, 'utf8');

      this.emitFile({
        type: 'asset',
        fileName: `${MIGRATIONS_OUTPUT}/${JOURNAL_FILE_NAME}`,
        source: journal,
      });

      for (const name of migrationFiles(journal)) {
        const path = join(MIGRATIONS_SOURCE, name);

        // Read eagerly rather than lazily: a journal entry whose file is missing is a build that
        // would otherwise ship a server refusing to start, and this is the last moment anyone is
        // watching
        const sql = readFileSync(path, 'utf8');

        this.emitFile({ type: 'asset', fileName: `${MIGRATIONS_OUTPUT}/${name}`, source: sql });
      }
    },
  };
}
