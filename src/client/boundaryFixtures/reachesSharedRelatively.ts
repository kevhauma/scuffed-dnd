/**
 * Violates `cross-root-imports-use-an-alias` (TICKET-DX-07)
 *
 * The *destination* is legal — `client/` may import `shared/`. What is refused is the spelling:
 * a crossing written as `../../shared/…` hides at the import line, and the only thing separating
 * it from a legal within-root import is how many traversals you counted.
 */

import { SHARED_VALUE } from '../../shared/boundaryFixtures/target';

export const reached = SHARED_VALUE;
