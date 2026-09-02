/**
 * Types for the migrations-emitting plugin (TICKET-POL-03).
 *
 * Hand-written for the same reason as `no-server-in-client-bundle.d.mts`: the plugin is plain ESM
 * so that `vite.config.ts` can load it without a build step of its own.
 */

import type { Plugin } from 'vite';

/** Emits `src/server/db/migrations/` beside the built server, where `migrate.ts` looks for it */
export declare function serverMigrations(): Plugin;
