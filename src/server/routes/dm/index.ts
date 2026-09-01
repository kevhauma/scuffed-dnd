/**
 * The Dungeon Master's controls (TICKET-DM-01)
 *
 * Eight writes a DM makes to a Character in their session and one read of what they have done, all
 * under `POST /api/characters/:id/<action>` where `<action>` is a value of `DM_ACTION` — the same
 * shape `routes/play/` has, because it is the same kind of request with a different guard in front
 * of it.
 *
 * They live beside `routes/play/` rather than inside it because `playerRules.test.ts` asserts *one
 * module per `PLAYER_ACTION`* over that folder, and because the two answer different questions:
 * that one is *what I am doing to my own sheet*, this one is *what the table's DM is doing to
 * somebody's*.
 *
 * One module per route, for the reason `routes/rulesets/index.ts` gives — `routeGuards.test.ts`
 * scans a **module** for a guard call, so several handlers in one file would let one
 * `requireCharacterDM` stand for all of them.
 */

export * from './dmAwardExperience';
export * from './dmDeductExperience';
export * from './dmGrantPassive';
export * from './dmGrantPoints';
export * from './dmPayloads';
export * from './dmRevokePassive';
export * from './dmSetDreamLevel';
export * from './dmSetLevel';
export * from './dmSetResource';
export * from './listAdjustments';
