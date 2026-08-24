/**
 * Types for the client-bundle guard plugin (TICKET-DX-07).
 *
 * Hand-written for the same reason as `build-sheet-import.d.mts`: the plugin is plain ESM so that
 * `vite.config.ts` can load it without a build step of its own.
 */

import type { Plugin } from 'vite';

/** Fails the client build if any `src/server/` module reached the emitted chunks (v3 Req 50.5) */
export declare function noServerInClientBundle(): Plugin;
