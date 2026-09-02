/**
 * `yarn run db:backup <file>` — a consistent copy of the live database (TICKET-POL-03)
 *
 * The reasoning is in `src/server/db/backup.ts`; this is the door into the built artefact, exactly
 * as `serve.mjs` is. It runs `VACUUM INTO`, which writes a single consistent file **while the
 * server is running** — no quiescing, no WAL companions to keep together, and none of the
 * *usually restores* hazard of copying `app.db` with `cp`.
 *
 *     node --env-file-if-exists=.env scripts/backup.mjs ./backups/app-2026-09-02.db
 *
 * Restoring is putting that file where `DATABASE_URL` points and starting the process; the schema
 * comes up to date on its own, because migrations run at start-up.
 *
 * It reads `DATABASE_URL` through the bundle's own `src/server/env.ts` rather than looking at
 * `process.env` here, so a backup and the server it backs up can never disagree about which file
 * they mean.
 *
 * **Importing the bundle migrates nothing**, and that is load-bearing rather than incidental: the
 * moment this command matters most is a bad upgrade, and a backup tool that ran the failing
 * migration first — or refused to copy because it failed — would be useless exactly then. See
 * `src/server/entry.ts`'s note on where start-up moved to.
 */

import { reportRefusal } from './refusals.mjs';

const destination = process.argv[2];

if (!destination) {
  console.error(
    'Usage: node --env-file-if-exists=.env scripts/backup.mjs <file>\n' +
      'Name the file for the moment it captures, e.g. ./backups/app-2026-09-02.db — an existing ' +
      'destination is refused rather than overwritten.'
  );
  process.exit(1);
}

try {
  // Inside the `try` with the work: importing the bundle is the step that fails when nobody has
  // built it, and it is not a step an operator thinks of as separate from taking a backup
  const entry = await import('../dist/server/entry.js');
  const written = entry.backupDatabase(destination);
  console.info(`Backed up to ${written}`);
} catch (error) {
  reportRefusal(error);
  process.exit(1);
}
