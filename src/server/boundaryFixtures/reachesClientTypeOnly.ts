/**
 * Violates `no-server-to-client` with an `import type` (TICKET-DX-07)
 *
 * A type crossing the boundary is a crossing. It compiles away, so nothing about the *bundle* is
 * wrong — but it couples the Kernel's callers to each other's shapes, which is what the rule is
 * about, and it is the crossing a reviewer is least likely to notice.
 *
 * This fixture is what makes `options.tsPreCompilationDeps: true` load-bearing: every other
 * fixture uses a value import, so flipping that option off would leave them all still reported
 * while type-only crossings went silent.
 */

import type { CLIENT_VALUE } from '#client/boundaryFixtures/target';

export type Borrowed = typeof CLIENT_VALUE;
