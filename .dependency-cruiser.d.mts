/**
 * Types for the dependency-cruiser configuration (TICKET-DX-07).
 *
 * Hand-written for the same reason as `scripts/build-sheet-import.d.mts`: the config is plain ESM
 * that the `depcruise` CLI loads directly and must not need a build step. The declaration exists so
 * `architecture/boundaries.test.ts` can import the *same* rule set the CLI enforces — rather than
 * restating it, which would let the proof and the enforcement drift apart — without `tsc --noEmit`
 * falling back to `any`.
 */

import type { IConfiguration } from 'dependency-cruiser';

declare const configuration: IConfiguration;

export default configuration;
