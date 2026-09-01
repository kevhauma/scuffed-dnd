/**
 * Types for the live-socket dev attachment (TICKET-LIVE-01).
 *
 * Hand-written for the same reason as `no-server-in-client-bundle.d.mts`: the plugin is plain ESM
 * so that `vite.config.ts` can load it without a build step of its own.
 */

import type { Plugin } from 'vite';

/** Attaches the WebSocket server to the dev server's HTTP listener (v3 Req 44.1, 47.1) */
export declare function liveSocket(): Plugin;
