/**
 * drizzle-kit configuration (TICKET-DB-01)
 *
 * Generation only. `drizzle-kit generate` diffs `src/server/db/schema.ts` against the migrations
 * already in `src/server/db/migrations/` and writes the SQL for the difference; the *applying* is
 * `runMigrations()` at start-up, never a CLI step an operator has to remember.
 *
 * `drizzle-kit push` is deliberately not used and not scripted. It mutates a database to match the
 * schema without leaving a migration behind, which is the one thing this milestone's forward-only
 * rule forbids — see `migrate.ts`.
 */

import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  dialect: 'sqlite',
  schema: './src/server/db/schema.ts',
  out: './src/server/db/migrations',
  // Generation reads the schema file, not a database. The URL is required by the config shape and
  // is never connected to by `generate`.
  dbCredentials: { url: process.env.DATABASE_URL ?? './data/app.db' },
});
