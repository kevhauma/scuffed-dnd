/**
 * The Dungeon Master's controls (TICKET-DM-01)
 *
 * Fifteen writes a DM makes to a Character in their session and one read of what they have done,
 * all under `POST /api/characters/:id/<action>` where `<action>` is a value of `DM_ACTION` — the same
 * shape `routes/play/` has, because it is the same kind of request with a different guard in front
 * of it.
 *
 * **TICKET-DM-02 added six of them** — the purse as a total and as a delta, and the four acts a
 * build has a life through — and added no rule with them: every one calls a `playerActions.ts`
 * function unchanged, which is what *no DM bypass of the ruleset's own rules* means when written down
 * as code rather than as a policy.
 *
 * **TICKET-DM-03 added the fifteenth**, [`dmAdjustResource`](./dmAdjustResource.ts), on that same
 * terms: it is `dm-set-resource`'s delta counterpart the way `dm-adjust-purse` is `dm-set-purse`'s,
 * and it runs `adjustResourceValue` unchanged. It is the only route in this folder a quick action
 * needed that did not already exist — see its module note for why that does not make it the private
 * mechanism v3 Req 49.3 forbids.
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

export * from './dmAdjustPurse';
export * from './dmAdjustResource';
export * from './dmAwardExperience';
export * from './dmBuildItem';
export * from './dmDeductExperience';
export * from './dmDropItem';
export * from './dmEquipItem';
export * from './dmGrantPassive';
export * from './dmGrantPoints';
export * from './dmPayloads';
export * from './dmRevokePassive';
export * from './dmSetDreamLevel';
export * from './dmSetLevel';
export * from './dmSetPurse';
export * from './dmSetResource';
export * from './dmUnequipItem';
export * from './listAdjustments';
