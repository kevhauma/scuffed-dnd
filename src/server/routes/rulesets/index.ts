/**
 * The `/api/rulesets` routes (TICKET-RUL-01)
 *
 * One module per route, deliberately. `routes/routeGuards.test.ts` scans a **module** for an owned
 * identifier and a guard call, so four handlers sharing a file would let one `requireOwner` stand
 * for all four — the test would go green on a route that never guarded anything. Split, each
 * guarded route carries its own proof.
 */

export * from './createRuleset';
export * from './deleteRuleset';
export * from './getRuleset';
export * from './listRulesets';
export * from './renameRuleset';
export * from './rulesetPayloads';
export * from './saveRuleset';
