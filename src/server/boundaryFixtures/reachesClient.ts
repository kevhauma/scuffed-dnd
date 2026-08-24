/**
 * Violates `no-server-to-client` and `server-reaches-only-shared` (TICKET-DX-07)
 */

import { CLIENT_VALUE } from '#client/boundaryFixtures/target';

export const borrowed = CLIENT_VALUE;
