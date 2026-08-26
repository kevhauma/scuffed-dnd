/**
 * The `/api/sessions` routes (TICKET-GAM-01)
 *
 * One module per route, for the reason `routes/rulesets/index.ts` gives: `routeGuards.test.ts` scans
 * a **module** for an owned identifier and a guard call, so five handlers sharing a file would let
 * one `requireDM` stand for all five.
 */

export * from './archiveSession';
export * from './createSession';
export * from './listSessions';
export * from './readSession';
export * from './refreshSnapshot';
export * from './sessionPayloads';
export * from './snapshotConflicts';
