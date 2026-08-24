/**
 * Violates `no-client-to-server` (TICKET-DX-07)
 */

import { SERVER_VALUE } from '#server/boundaryFixtures/target';

export const leaked = SERVER_VALUE;
