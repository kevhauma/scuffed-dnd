/**
 * Violates nothing (TICKET-DX-07)
 *
 * The legal crossing, spelled the legal way. `architecture/boundaries.test.ts` asserts this one is
 * reported clean, so that "every fixture is refused" cannot pass for a working rule set.
 */

import { SHARED_VALUE } from '#shared/boundaryFixtures/target';

export const reached = SHARED_VALUE;
