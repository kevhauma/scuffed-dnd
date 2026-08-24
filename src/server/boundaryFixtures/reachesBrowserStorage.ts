/**
 * Violates `no-server-to-client` — the browser half of `services/` (TICKET-DX-07)
 *
 * The half of the old `src/services/` that stayed client-side, reached for by name. This is the
 * mistake the split exists to make impossible: `loadConfiguration` reads `localStorage`, and a
 * server that imports it does not fail at the boundary, it fails at runtime on the first request.
 * Its pure counterpart — `validateConfigurationShape` — is imported by
 * [`sharedKernel.test.ts`](../sharedKernel.test.ts) and is allowed.
 */

import { loadConfiguration } from '#client/services/storage';

export const stored = loadConfiguration;
