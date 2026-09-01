/**
 * The Dungeon Master's controls over somebody else's sheet (TICKET-DM-01)
 *
 * Seven things this file is about, one per acceptance criterion:
 *
 * 1. **Awarding experience moves the derived level and stores nothing else** — asserted against the
 *    persisted document rather than against the response, so *there is no writable level field* is
 *    a claim about what is on disk.
 * 2. **"Set level to N" writes the `xp_thresholds` threshold**, and is refused with the reason when
 *    the curve cannot price N rather than putting the character somewhere approximate.
 * 3. **A grant raises the budget**, proven by the Player then spending it through PLY-01's
 *    *unchanged* route — the point of a grant being an input to the pool rather than a second pool.
 * 4. **A revocation that would leave the character overspent is refused, naming the overspend.**
 * 5. **A deduction below zero is refused, not clamped** — v1.0's rule, now server-side.
 * 6. **One Event per accepted adjustment, naming the DM and the before and after**, and the Player
 *    reading back the ones that changed their own sheet.
 * 7. The refusals every route in this milestone owes — anonymous, non-member, non-owner — plus the
 *    one this ticket adds: **a `player` Member calling a DM route gets the same 404 a stranger
 *    does**, and the DM's own character gets no special path.
 *
 * TICKET-RES-04 added an eighth: **a dream level is stored as typed** — the one `dm-set-*` whose
 * payload is what lands on the document, because nothing derives it — and a `player` Member asking
 * to raise their own gets the same indistinguishable 404 every other control here gives them.
 *
 * **TICKET-DM-02 added the money and the pack**, and its cases are all one claim: *there is no DM
 * relaxation of the ruleset's own rules.* A mismatched slot is refused for the DM in the Player's own
 * sentence, a template the Snapshot does not define is refused, a purse taken below zero is refused
 * with the shortfall named — every one of them because the route calls `playerActions.ts`'s function
 * rather than a DM-flavoured copy of it. The pair of unequip/discard cases is why the ticket landed
 * four inventory routes rather than two: a worn build cannot be discarded, so a DM without an unequip
 * could not remove one at all.
 *
 * **Against the real corpus throughout**, and against a Snapshot with a real XP ladder pinned into
 * it where a level has to be priced: the Ducklets `xp_thresholds` curve is TICKET-CRV-03's
 * placeholder single row, which genuinely cannot tell level 4 from level 1 — so it is the fixture
 * for the *refusal* and a pinned ladder is the fixture for the acceptance.
 *
 * **Validates: v3 Req 32.1, 32.3, 32.4, 32.5, 42.1-42.7, 45.1**
 */

import { describe, expect, it } from 'vitest';
import { calculateCharacterLevel } from '#shared/engine/characterSummary';
import { backpackOf } from '#shared/engine/composedItems';
import { dreamLevelOf } from '#shared/engine/dreamLevel';
import { validateStatAllocation } from '#shared/engine/skillAllocation';
import { buildCharacter } from '#shared/services/characterCreation';
import {
  type CharacterAdjustmentListing,
  type CharacterDocument,
  DM_ACTION,
  PLAYER_ACTION,
  type PlayerActionEvent,
} from '#shared/types/api';
import type { Character } from '#shared/types/character';
import type { Configuration, Curve, Passive, Stat } from '#shared/types/config';
import { findCharacter, insertUnseatedCharacter } from '../../repositories/characterRepository';
import { eventsSince } from '../../repositories/eventRepository';
import {
  type CallOptions,
  callRoute,
  type Database,
  seedAccount,
  seedCharacter,
  seedMember,
  seedRegisteredAccount,
  seedRuleset,
  seedSession,
  withTestDatabase,
} from '../../testing';
import { buildItem } from '../play/buildItem';
import { investStatPoints } from '../play/investStatPoints';
import { snapshotOf } from '../sessions/sessionPayloads';
import { dmAdjustPurse } from './dmAdjustPurse';
import { dmAwardExperience } from './dmAwardExperience';
import { dmBuildItem } from './dmBuildItem';
import { dmDeductExperience } from './dmDeductExperience';
import { dmDropItem } from './dmDropItem';
import { dmEquipItem } from './dmEquipItem';
import { dmGrantPassive } from './dmGrantPassive';
import { dmGrantPoints } from './dmGrantPoints';
import { dmRevokePassive } from './dmRevokePassive';
import { dmSetDreamLevel } from './dmSetDreamLevel';
import { dmSetLevel } from './dmSetLevel';
import { dmSetPurse } from './dmSetPurse';
import { dmSetResource } from './dmSetResource';
import { dmUnequipItem } from './dmUnequipItem';
import { listAdjustments } from './listAdjustments';

/** Every route in this folder, keyed by the action it performs — so a case can drive any of them */
const ROUTES = {
  [DM_ACTION.AWARD_EXPERIENCE]: dmAwardExperience,
  [DM_ACTION.DEDUCT_EXPERIENCE]: dmDeductExperience,
  [DM_ACTION.SET_LEVEL]: dmSetLevel,
  [DM_ACTION.GRANT_POINTS]: dmGrantPoints,
  [DM_ACTION.SET_RESOURCE]: dmSetResource,
  [DM_ACTION.SET_DREAM_LEVEL]: dmSetDreamLevel,
  [DM_ACTION.GRANT_PASSIVE]: dmGrantPassive,
  [DM_ACTION.REVOKE_PASSIVE]: dmRevokePassive,
  [DM_ACTION.SET_PURSE]: dmSetPurse,
  [DM_ACTION.ADJUST_PURSE]: dmAdjustPurse,
  [DM_ACTION.BUILD_ITEM]: dmBuildItem,
  [DM_ACTION.DROP_ITEM]: dmDropItem,
  [DM_ACTION.EQUIP_ITEM]: dmEquipItem,
  [DM_ACTION.UNEQUIP_ITEM]: dmUnequipItem,
} as const;

/** Perform one DM adjustment, as somebody */
function adjust(
  action: keyof typeof ROUTES,
  characterId: string,
  body: unknown,
  as: CallOptions['as']
) {
  return callRoute<CharacterDocument>(ROUTES[action], {
    as,
    method: 'POST',
    path: `/api/characters/${characterId}/${action}`,
    body,
  });
}

/** Read one character's adjustment history, as somebody */
function history(characterId: string, as: CallOptions['as']) {
  return callRoute<CharacterAdjustmentListing>(listAdjustments, {
    as,
    path: `/api/characters/${characterId}/adjustments`,
  });
}

/** What a refusal said */
function messageOf(body: unknown): string {
  return (body as { error: { message: string } }).error.message;
}

/** The player state a row is holding */
function stateOf(database: Database, characterId: string): Character {
  const row = findCharacter(characterId, database);
  expect(row).not.toBeNull();

  return JSON.parse((row as { data: string }).data) as Character;
}

/** Every event a session has, oldest first */
function eventsOf(database: Database, sessionId: string) {
  return eventsSince(sessionId, 0, database);
}

/** One event's payload */
function payloadOf(row: { payload: string }): PlayerActionEvent {
  return JSON.parse(row.payload) as PlayerActionEvent;
}

/**
 * A real XP ladder, pinned onto a Snapshot
 *
 * The corpus's own `xp_thresholds` is CRV-03's placeholder — one row, level 1 at 0 XP — which is a
 * ruleset that genuinely cannot say what level 4 costs. That makes it the right fixture for the
 * refusal and the wrong one for everything else, so the cases about *pricing* a level pin this in:
 * a four-rung ladder read backwards, exactly the shape `freshConfiguration` seeds.
 */
const XP_LADDER: Curve = {
  id: 'curve-xp-test',
  name: 'xp_thresholds',
  displayName: 'XP thresholds',
  description: '',
  keyName: 'level',
  columns: [{ id: 'column-xp-required', name: 'xp_required' }],
  rows: [
    { key: 1, values: [0] },
    { key: 2, values: [100] },
    { key: 3, values: [250] },
    { key: 4, values: [450] },
  ],
  interpolation: 'step',
  outOfRange: 'error',
  lookupDirection: 'reverse',
};

/** A Snapshot whose XP curve is {@link XP_LADDER} rather than the corpus's placeholder */
function withLadder(document: Configuration): Configuration {
  return {
    ...document,
    curves: [
      ...(document.curves ?? []).filter((curve) => curve.name !== XP_LADDER.name),
      XP_LADDER,
    ],
  };
}

/**
 * A table with a DM and a player, and a real character the player owns
 *
 * `play.test.ts`'s fixture, with the DM **registered** rather than a bare id: the adjustment log
 * resolves an actor to a name at read time, and an account with no row would only ever prove the
 * `null` branch.
 */
function aTableWithACharacter(
  database: Database,
  options: { snapshot?: (document: Configuration) => Configuration } = {}
) {
  const dm = seedRegisteredAccount(database, { name: 'The DM' });
  const player = seedAccount();
  const ruleset = seedRuleset(database, { owner: dm });

  const pinned = options.snapshot
    ? JSON.stringify(options.snapshot(JSON.parse(ruleset.data) as Configuration))
    : undefined;

  const session = seedSession(database, {
    dm,
    from: ruleset,
    ...(pinned ? { snapshot: pinned } : {}),
  }).session;
  seedMember(database, { session, account: player });

  const rules = snapshotOf(session);

  const character = buildCharacter(
    { name: 'Quackers', raceIds: [], investedStatPoints: {}, investedSkillPoints: {} },
    rules,
    { id: 'character-under-test', now: new Date(0).toISOString() }
  );

  const row = seedCharacter(database, {
    id: character.id,
    session,
    owner: player,
    name: character.name,
    data: JSON.stringify(character),
  });

  return { dm, player, session, rules, character, row };
}

/**
 * IO-04's shape: a character owned by an Account and sitting at no table
 *
 * There is no DM of *no session*, so this is the fixture behind both of the at-no-table cases —
 * the write that is refused and the history that is empty rather than refused.
 */
function anUploadedCharacter(database: Database, owner: { id: string }, rulesetId: string) {
  return insertUnseatedCharacter(
    {
      id: `uploaded-${owner.id}`,
      ownerAccountId: owner.id,
      rulesetId,
      name: 'Uploaded',
      data: JSON.stringify({ id: `uploaded-${owner.id}`, name: 'Uploaded' }),
      now: Date.parse('2026-01-01T00:00:00.000Z'),
    },
    database
  );
}

/**
 * Two items for one slot and a metal to make them of, pinned onto a Snapshot (TICKET-DM-02)
 *
 * `play.test.ts`'s equipment fixture, and pinned for its reason: the corpus has six slots and
 * nothing that fits any of them, so the templates are added to the *real* ruleset rather than a
 * ruleset being invented around them. `LOOSE_ROPE` declares no slot at all, which is what makes
 * *a mismatched slot is refused for the DM exactly as for the Player* provable two ways — a
 * template for the **wrong** slot and a template for **no** slot.
 */
const HELMET = {
  id: 'item-dm-helm',
  name: 'Test Helm',
  description: '',
  equipmentSlotType: 'head_gear',
};
const BOOTS = {
  id: 'item-dm-boots',
  name: 'Test Boots',
  description: '',
  equipmentSlotType: 'foot_gear',
};
const LOOSE_ROPE = { id: 'item-dm-rope', name: 'Test Rope', description: '' };

/** A metal every test build is made of — the Kernel refuses a build naming no material or rung */
const METAL = {
  id: 'mat-dm-metal',
  name: 'Test Metal',
  description: '',
  categoryId: 'cat-dm-metal',
  levels: [{ level: 1, name: 'Plain', bonuses: [], value: { tierId: 'gold', amount: 1 } }],
};

/** The two slots the templates above declare, so `slotRefusal`'s *no such slot* is not what fires */
const SLOTS = [
  { type: 'head_gear', name: 'Head', description: '' },
  { type: 'foot_gear', name: 'Feet', description: '' },
];

/** A Snapshot with the three templates, the metal and the two slots added to what the ruleset had */
function withGear(document: Configuration): Configuration {
  return {
    ...document,
    items: [...document.items, HELMET, BOOTS, LOOSE_ROPE],
    materials: [...document.materials, METAL],
    equipmentSlots: [...document.equipmentSlots, ...SLOTS],
  };
}

/**
 * Build a template into a character's pack **as the DM**, and hand back the new build's id
 *
 * The id is minted by the server, so it is read back out rather than named — `play.test.ts`'s
 * `build` helper, one actor over. Every equipment case here starts with one of these, because a slot
 * holds a `ComposedItem.id` and `equipToSlot` refuses one the character does not have.
 */
async function buildAsDm(
  characterId: string,
  templateId: string,
  as: CallOptions['as']
): Promise<string> {
  const picks = { itemId: templateId, materialId: METAL.id, materialLevel: 1 };
  const made = await adjust(DM_ACTION.BUILD_ITEM, characterId, picks, as);

  expect(made.status, `building ${templateId} was refused`).toBe(200);

  const built = made.body.character.inventory.composedItems.at(-1);
  expect(built?.templateId, `building ${templateId} did not make one`).toBe(templateId);

  return built?.id as string;
}

/** The first stat a Player can put points into that is not also a pool */
function investableStat(rules: Configuration): Stat {
  const stat = rules.stats.find(
    (candidate) => candidate.formula === undefined && !candidate.isResource
  );
  expect(stat, 'the corpus should define at least one invested stat').toBeDefined();

  return stat as Stat;
}

describe('awarding and deducting experience', () => {
  it('moves the derived level with nothing else stored — there is no level on the document', () =>
    withTestDatabase(async (database) => {
      const { dm, row, rules } = aTableWithACharacter(database, { snapshot: withLadder });

      const before = stateOf(database, row.id);
      expect(calculateCharacterLevel(before, rules)).toBe(1);

      const accepted = await adjust(DM_ACTION.AWARD_EXPERIENCE, row.id, { amount: 260 }, dm);

      expect(accepted.status).toBe(200);

      const after = stateOf(database, row.id);
      expect(after.experience).toBe(260);
      expect(calculateCharacterLevel(after, rules)).toBe(3);

      // The claim the criterion actually makes: nothing on the persisted shape spells a level
      expect(Object.keys(after)).not.toContain('level');
      expect(JSON.stringify(after)).not.toContain('"level"');
    }));

  it('refuses a deduction below zero rather than clamping it, and writes nothing', () =>
    withTestDatabase(async (database) => {
      const { dm, row, session } = aTableWithACharacter(database);

      await adjust(DM_ACTION.AWARD_EXPERIENCE, row.id, { amount: 40 }, dm);
      const refused = await adjust(DM_ACTION.DEDUCT_EXPERIENCE, row.id, { amount: 100 }, dm);

      expect(refused.status).toBe(400);
      expect(messageOf(refused.body)).toContain('below zero experience');

      expect(stateOf(database, row.id).experience).toBe(40);
      // One event for the award, none for the refusal
      expect(eventsOf(database, session.id)).toHaveLength(1);
    }));

  it('refuses an award of nothing, so a mis-typed box cannot log an adjustment that did nothing', () =>
    withTestDatabase(async (database) => {
      const { dm, row } = aTableWithACharacter(database);

      const refused = await adjust(DM_ACTION.AWARD_EXPERIENCE, row.id, { amount: 0 }, dm);

      expect(refused.status).toBe(400);
      expect(messageOf(refused.body)).toContain('positive amount');
    }));
});

describe('setting a level', () => {
  it('writes the threshold experience for that level, never a level', () =>
    withTestDatabase(async (database) => {
      const { dm, row, rules } = aTableWithACharacter(database, { snapshot: withLadder });

      const accepted = await adjust(DM_ACTION.SET_LEVEL, row.id, { level: 4 }, dm);

      expect(accepted.status).toBe(200);

      const after = stateOf(database, row.id);
      expect(after.experience).toBe(450);
      expect(calculateCharacterLevel(after, rules)).toBe(4);
    }));

  it('records the experience it moved, not the level it was asked for', () =>
    withTestDatabase(async (database) => {
      const { dm, row, session } = aTableWithACharacter(database, { snapshot: withLadder });

      await adjust(DM_ACTION.SET_LEVEL, row.id, { level: 3 }, dm);

      const [event] = eventsOf(database, session.id);
      expect(event.type).toBe(DM_ACTION.SET_LEVEL);
      expect(payloadOf(event)).toMatchObject({ before: 0, after: 250 });
    }));

  it('is refused with the reason when the curve cannot price that level, and guesses nothing', () =>
    withTestDatabase(async (database) => {
      // The corpus's own placeholder ladder: one row, so every level reads back as 1
      const { dm, row } = aTableWithACharacter(database);

      const refused = await adjust(DM_ACTION.SET_LEVEL, row.id, { level: 7 }, dm);

      expect(refused.status).toBe(400);
      expect(messageOf(refused.body)).toContain('cannot price level 7');
      expect(stateOf(database, row.id).experience).toBe(0);
    }));

  it('refuses a level that is not a whole number at or above 1', () =>
    withTestDatabase(async (database) => {
      const { dm, row } = aTableWithACharacter(database, { snapshot: withLadder });

      expect(messageOf((await adjust(DM_ACTION.SET_LEVEL, row.id, { level: 2.5 }, dm)).body)).toBe(
        'A level has to be a whole number.'
      );
      expect(messageOf((await adjust(DM_ACTION.SET_LEVEL, row.id, { level: 0 }, dm)).body)).toBe(
        'A level cannot be below 1.'
      );
    }));
});

describe('granting and revoking stat points', () => {
  it('raises the budget, and the Player then spends it through their own unchanged route', () =>
    withTestDatabase(async (database) => {
      const { dm, player, row, rules } = aTableWithACharacter(database);
      const stat = investableStat(rules);

      // The corpus's own pool at level 1, read rather than asserted: what matters is that the
      // grant *raises* it, and pinning the ruleset's `points_per_level` here would make a corpus
      // change look like a broken rule
      const derived = validateStatAllocation(stateOf(database, row.id), rules).pointBudget;
      expect(typeof derived).toBe('number');

      // More than the derived pool, so the spend below is only affordable because of the grant
      const spend = (derived as number) + 5;

      const granted = await adjust(DM_ACTION.GRANT_POINTS, row.id, { points: 5 }, dm);
      expect(granted.status).toBe(200);

      expect(validateStatAllocation(stateOf(database, row.id), rules).pointBudget).toBe(spend);

      // PLY-01's route, untouched by this ticket — the grant is an input to the pool it reads
      const spent = await callRoute<CharacterDocument>(investStatPoints, {
        as: player,
        method: 'POST',
        path: `/api/characters/${row.id}/${PLAYER_ACTION.INVEST_STAT_POINTS}`,
        body: { statId: stat.id, points: spend },
      });

      expect(spent.status).toBe(200);
      expect(stateOf(database, row.id).investedStatPoints[stat.id]).toBe(spend);
    }));

  it('refuses a revocation that would leave the character overspent, and names the overspend', () =>
    withTestDatabase(async (database) => {
      const { dm, player, row, rules } = aTableWithACharacter(database);
      const stat = investableStat(rules);

      const derived = validateStatAllocation(stateOf(database, row.id), rules)
        .pointBudget as number;

      await adjust(DM_ACTION.GRANT_POINTS, row.id, { points: 5 }, dm);
      await callRoute(investStatPoints, {
        as: player,
        method: 'POST',
        path: `/api/characters/${row.id}/${PLAYER_ACTION.INVEST_STAT_POINTS}`,
        body: { statId: stat.id, points: derived + 5 },
      });

      const refused = await adjust(DM_ACTION.GRANT_POINTS, row.id, { points: 0 }, dm);

      expect(refused.status).toBe(400);
      expect(messageOf(refused.body)).toContain('5 points overspent');

      expect(stateOf(database, row.id).grantedStatPoints).toBe(5);
    }));

  it('allows a revocation the character can still afford', () =>
    withTestDatabase(async (database) => {
      const { dm, row } = aTableWithACharacter(database);

      await adjust(DM_ACTION.GRANT_POINTS, row.id, { points: 5 }, dm);
      const accepted = await adjust(DM_ACTION.GRANT_POINTS, row.id, { points: 1 }, dm);

      expect(accepted.status).toBe(200);
      expect(stateOf(database, row.id).grantedStatPoints).toBe(1);
    }));
});

describe('setting a resource', () => {
  it("obeys the Player's own Kernel rule, clamping at the Snapshot's maximum", () =>
    withTestDatabase(async (database) => {
      const { dm, row, rules } = aTableWithACharacter(database);
      const pool = rules.stats.find((stat) => stat.isResource);
      expect(pool, 'the corpus should define a pool').toBeDefined();

      const accepted = await adjust(
        DM_ACTION.SET_RESOURCE,
        row.id,
        { statId: (pool as Stat).id, value: 9_999 },
        dm
      );

      expect(accepted.status).toBe(200);

      const stored = stateOf(database, row.id).currentResourceValues[(pool as Stat).id];
      expect(stored).toBeLessThan(9_999);
    }));
});

describe('setting a dream level', () => {
  it('stores the number that was typed — the one dm-set-* whose payload is what is written', () =>
    withTestDatabase(async (database) => {
      const { dm, row, session } = aTableWithACharacter(database);

      const before = stateOf(database, row.id);
      // Absent on a freshly built character: the neutral 1 is the reader's rule, not a backfill
      expect(before.dreamLevel).toBeUndefined();
      expect(dreamLevelOf(before)).toBe(1);

      const accepted = await adjust(DM_ACTION.SET_DREAM_LEVEL, row.id, { dreamLevel: 3 }, dm);
      expect(accepted.status).toBe(200);

      expect(stateOf(database, row.id).dreamLevel).toBe(3);

      const [event] = eventsOf(database, session.id);
      expect(event.type).toBe(DM_ACTION.SET_DREAM_LEVEL);
      expect(event.actorAccountId).toBe(dm.id);
      expect(payloadOf(event)).toMatchObject({
        characterId: row.id,
        action: DM_ACTION.SET_DREAM_LEVEL,
        before: 1,
        after: 3,
      });
    }));

  it('refuses a level below the floor, names it, and writes nothing at all', () =>
    withTestDatabase(async (database) => {
      const { dm, row, session } = aTableWithACharacter(database);

      const refused = await adjust(DM_ACTION.SET_DREAM_LEVEL, row.id, { dreamLevel: 0 }, dm);

      expect(refused.status).toBe(400);
      expect(messageOf(refused.body)).toBe('A dream level cannot be below 1.');

      expect(stateOf(database, row.id).dreamLevel).toBeUndefined();
      expect(eventsOf(database, session.id)).toHaveLength(0);
    }));

  it('refuses a `player` Member with the same 404 a stranger gets, and changes nothing', () =>
    withTestDatabase(async (database) => {
      const { player, row, session } = aTableWithACharacter(database);
      const stranger = seedAccount();

      // The owner of the very character, asking to raise their own dream — the ruling put this
      // action on the DM's side of the table, so the answer is the one an id nobody minted gets
      const asPlayer = await adjust(DM_ACTION.SET_DREAM_LEVEL, row.id, { dreamLevel: 5 }, player);
      const asNobodyReal = await adjust(
        DM_ACTION.SET_DREAM_LEVEL,
        'character-that-never-was',
        { dreamLevel: 5 },
        stranger
      );

      expect(asPlayer.status).toBe(404);
      expect(asPlayer.body).toEqual(asNobodyReal.body);

      expect(stateOf(database, row.id).dreamLevel).toBeUndefined();
      expect(eventsOf(database, session.id)).toHaveLength(0);
    }));
});

describe('handing out a passive ability', () => {
  /** A Snapshot carrying a two-entry catalog, since the corpus has none yet (overview D7) */
  const CATALOG: Passive[] = [
    {
      id: 'passive-blindsight',
      name: 'Blindsight',
      effectText: 'blindsight out to {PER} feet',
    },
    { id: 'passive-charmed', name: 'Charm immunity', effectText: 'You cannot be charmed.' },
  ];

  const withPassives = (document: Configuration): Configuration => ({
    ...document,
    passives: CATALOG,
  });

  it('stores the id and logs which ability it was', () =>
    withTestDatabase(async (database) => {
      const { dm, row, session } = aTableWithACharacter(database, { snapshot: withPassives });

      expect(stateOf(database, row.id).passiveIds).toBeUndefined();

      const accepted = await adjust(
        DM_ACTION.GRANT_PASSIVE,
        row.id,
        { passiveId: 'passive-blindsight' },
        dm
      );
      expect(accepted.status).toBe(200);

      expect(stateOf(database, row.id).passiveIds).toEqual(['passive-blindsight']);

      const [event] = eventsOf(database, session.id);
      expect(event.type).toBe(DM_ACTION.GRANT_PASSIVE);
      expect(event.actorAccountId).toBe(dm.id);
      expect(payloadOf(event)).toMatchObject({
        characterId: row.id,
        action: DM_ACTION.GRANT_PASSIVE,
        target: 'passive-blindsight',
        before: null,
        after: 'passive-blindsight',
      });
    }));

  it('takes one back, and the Event mirrors the grant', () =>
    withTestDatabase(async (database) => {
      const { dm, row, session } = aTableWithACharacter(database, { snapshot: withPassives });

      await adjust(DM_ACTION.GRANT_PASSIVE, row.id, { passiveId: 'passive-charmed' }, dm);
      const accepted = await adjust(
        DM_ACTION.REVOKE_PASSIVE,
        row.id,
        { passiveId: 'passive-charmed' },
        dm
      );

      expect(accepted.status).toBe(200);
      // The field goes rather than becoming `[]` — *none* has one spelling on the document
      expect(stateOf(database, row.id).passiveIds).toBeUndefined();

      const events = eventsOf(database, session.id);
      expect(payloadOf(events[1])).toMatchObject({
        action: DM_ACTION.REVOKE_PASSIVE,
        target: 'passive-charmed',
        before: 'passive-charmed',
        after: null,
      });
    }));

  it('refuses a passive the Snapshot does not have, and writes nothing', () =>
    withTestDatabase(async (database) => {
      const { dm, row, session } = aTableWithACharacter(database, { snapshot: withPassives });

      const refused = await adjust(
        DM_ACTION.GRANT_PASSIVE,
        row.id,
        { passiveId: 'passive-nonesuch' },
        dm
      );

      expect(refused.status).toBe(400);
      expect(messageOf(refused.body)).toBe('This ruleset has no such passive ability.');
      expect(stateOf(database, row.id).passiveIds).toBeUndefined();
      expect(eventsOf(database, session.id)).toHaveLength(0);
    }));

  it('refuses a duplicate rather than storing a second entry', () =>
    withTestDatabase(async (database) => {
      const { dm, row } = aTableWithACharacter(database, { snapshot: withPassives });

      await adjust(DM_ACTION.GRANT_PASSIVE, row.id, { passiveId: 'passive-charmed' }, dm);
      const refused = await adjust(
        DM_ACTION.GRANT_PASSIVE,
        row.id,
        { passiveId: 'passive-charmed' },
        dm
      );

      expect(refused.status).toBe(400);
      expect(messageOf(refused.body)).toContain('already has Charm immunity');
      expect(stateOf(database, row.id).passiveIds).toEqual(['passive-charmed']);
    }));

  it('lets the DM revoke an id the Snapshot has lost, because the rule consults no ruleset', () =>
    withTestDatabase(async (database) => {
      // The force-delete case, reached through a request: a whole-list write validating every id
      // would refuse the very edit that clears the stale one. Seeded as a second character rather
      // than by editing the first, so the stale id is genuinely in the stored document.
      const { dm, player, session, character } = aTableWithACharacter(database, {
        snapshot: withPassives,
      });

      const haunted = seedCharacter(database, {
        id: 'character-holding-a-ghost',
        session,
        owner: player,
        name: 'Haunted',
        data: JSON.stringify({
          ...character,
          id: 'character-holding-a-ghost',
          passiveIds: ['passive-gone'],
        }),
      });

      const accepted = await adjust(
        DM_ACTION.REVOKE_PASSIVE,
        haunted.id,
        { passiveId: 'passive-gone' },
        dm
      );

      expect(accepted.status).toBe(200);
      expect(stateOf(database, haunted.id).passiveIds).toBeUndefined();
    }));

  it('refuses the character’s own Player with the same 404 a stranger gets', () =>
    withTestDatabase(async (database) => {
      // *A Player cannot self-grant* is this: there is no player route to the field at all, so the
      // owner of the sheet asking is answered exactly as an id nobody minted is
      const { player, row, session } = aTableWithACharacter(database, { snapshot: withPassives });
      const stranger = seedAccount();

      const asPlayer = await adjust(
        DM_ACTION.GRANT_PASSIVE,
        row.id,
        { passiveId: 'passive-charmed' },
        player
      );
      const asNobodyReal = await adjust(
        DM_ACTION.GRANT_PASSIVE,
        'character-that-never-was',
        { passiveId: 'passive-charmed' },
        stranger
      );

      expect(asPlayer.status).toBe(404);
      expect(asPlayer.body).toEqual(asNobodyReal.body);

      expect(stateOf(database, row.id).passiveIds).toBeUndefined();
      expect(eventsOf(database, session.id)).toHaveLength(0);
    }));
});

describe('setting and adjusting a purse', () => {
  it('sets what the character is carrying, in the base tier', () =>
    withTestDatabase(async (database) => {
      const { dm, row } = aTableWithACharacter(database);

      const accepted = await adjust(DM_ACTION.SET_PURSE, row.id, { amount: 340 }, dm);
      const stored = stateOf(database, row.id);

      expect(accepted.status).toBe(200);
      expect(stored.purse).toBe(340);
    }));

  it('moves a purse by a delta, so paying somebody is not arithmetic on a stale balance', () =>
    withTestDatabase(async (database) => {
      const { dm, row } = aTableWithACharacter(database);

      await adjust(DM_ACTION.SET_PURSE, row.id, { amount: 30 }, dm);
      const paid = await adjust(DM_ACTION.ADJUST_PURSE, row.id, { delta: 340 }, dm);
      const spent = await adjust(DM_ACTION.ADJUST_PURSE, row.id, { delta: -12 }, dm);
      const stored = stateOf(database, row.id);

      expect(paid.status).toBe(200);
      expect(spent.status).toBe(200);
      expect(stored.purse).toBe(358);
    }));

  it('refuses a change that would take the purse negative, and names the shortfall', () =>
    withTestDatabase(async (database) => {
      const { dm, row, session } = aTableWithACharacter(database);

      await adjust(DM_ACTION.SET_PURSE, row.id, { amount: 30 }, dm);

      const overspent = await adjust(DM_ACTION.ADJUST_PURSE, row.id, { delta: -40 }, dm);
      const negative = await adjust(DM_ACTION.SET_PURSE, row.id, { amount: -5 }, dm);

      const shortfall = messageOf(overspent.body);
      const belowZero = messageOf(negative.body);

      // CUR-02's refuse-don't-clamp, reached through the DM's route rather than copied into it:
      // a purchase that quietly emptied a purse would leave a table believing it had been paid for
      expect(overspent.status).toBe(400);
      expect(shortfall).toBe('That would leave the purse 10 short. Nothing was taken.');

      expect(negative.status).toBe(400);
      expect(belowZero).toContain('5 short');

      // Unmoved, and one Event for the accepted set rather than three
      const stored = stateOf(database, row.id);
      const events = eventsOf(database, session.id);

      expect(stored.purse).toBe(30);
      expect(events).toHaveLength(1);
    }));

  it('refuses a body that is not an amount at all, before the Kernel is asked', () =>
    withTestDatabase(async (database) => {
      const { dm, row } = aTableWithACharacter(database);

      const refused = await adjust(DM_ACTION.SET_PURSE, row.id, { amount: 'lots' }, dm);
      const reason = messageOf(refused.body);

      expect(refused.status).toBe(400);
      expect(reason).toContain('amount has to be a number');
    }));
});

describe("putting things in and out of somebody's pack", () => {
  it("builds a thing into a player's Backpack, where the DM did not own it", () =>
    withTestDatabase(async (database) => {
      const { dm, row, rules } = aTableWithACharacter(database, { snapshot: withGear });

      const helm = await buildAsDm(row.id, HELMET.id, dm);

      // Everything built and not worn *is* the Backpack (TICKET-INV-06) — there is no second list
      const held = stateOf(database, row.id);
      const bagged = backpackOf(held, rules).map((build) => build.id);

      expect(bagged).toEqual([helm]);
    }));

  it('equips a build into the slot its template declares', () =>
    withTestDatabase(async (database) => {
      const { dm, row } = aTableWithACharacter(database, { snapshot: withGear });

      const helm = await buildAsDm(row.id, HELMET.id, dm);
      const worn = await adjust(
        DM_ACTION.EQUIP_ITEM,
        row.id,
        { equipmentSlotType: HELMET.equipmentSlotType, itemId: helm },
        dm
      );

      const stored = stateOf(database, row.id);

      expect(worn.status).toBe(200);
      expect(stored.inventory.equippedItems[HELMET.equipmentSlotType]).toBe(helm);
    }));

  it('refuses a mismatched slot for the DM in exactly the sentence a Player gets', () =>
    withTestDatabase(async (database) => {
      /*
       * **The ticket's central note, as a test.** There is no DM relaxation of Requirement 12.3:
       * `equipToSlot` is the same function `routes/play/equipItem.ts` calls, so the boots do not go
       * on a head and neither does a rope that fits nowhere at all. A DM who needs otherwise changes
       * the ruleset — otherwise the Snapshot stops describing what the table is playing.
       */
      const { dm, row, session } = aTableWithACharacter(database, { snapshot: withGear });

      const boots = await buildAsDm(row.id, BOOTS.id, dm);
      const rope = await buildAsDm(row.id, LOOSE_ROPE.id, dm);

      const wrongSlot = await adjust(
        DM_ACTION.EQUIP_ITEM,
        row.id,
        { equipmentSlotType: HELMET.equipmentSlotType, itemId: boots },
        dm
      );
      const noSlotAtAll = await adjust(
        DM_ACTION.EQUIP_ITEM,
        row.id,
        { equipmentSlotType: HELMET.equipmentSlotType, itemId: rope },
        dm
      );

      const bootsOnAHead = messageOf(wrongSlot.body);
      const ropeOnAHead = messageOf(noSlotAtAll.body);

      expect(wrongSlot.status).toBe(400);
      expect(bootsOnAHead).toBe(`${BOOTS.name} does not go in that slot.`);

      expect(noSlotAtAll.status).toBe(400);
      expect(ropeOnAHead).toBe(`${LOOSE_ROPE.name} does not go in that slot.`);

      // Nothing worn, and the log holds the two builds and neither refusal
      const stored = stateOf(database, row.id);
      const events = eventsOf(database, session.id);

      expect(stored.inventory.equippedItems).toEqual({});
      expect(events).toHaveLength(2);
    }));

  it('refuses an item the Snapshot does not define, for the DM as for the Player', () =>
    withTestDatabase(async (database) => {
      const { dm, row, session } = aTableWithACharacter(database, { snapshot: withGear });

      const picks = { itemId: 'item-nobody-authored', materialId: METAL.id, materialLevel: 1 };
      const refused = await adjust(DM_ACTION.BUILD_ITEM, row.id, picks, dm);
      const reason = messageOf(refused.body);
      const events = eventsOf(database, session.id);

      expect(refused.status).toBe(400);
      expect(reason).toBe('This ruleset has no such item.');
      expect(events).toHaveLength(0);
    }));

  it('refuses a build whose metal the Snapshot has no such rung of', () =>
    withTestDatabase(async (database) => {
      // The other half of *the ruleset decides*: a rung a family does not have is refused by name
      // rather than quietly forged out of tier 1
      const { dm, row } = aTableWithACharacter(database, { snapshot: withGear });

      const picks = { itemId: HELMET.id, materialId: METAL.id, materialLevel: 10 };
      const refused = await adjust(DM_ACTION.BUILD_ITEM, row.id, picks, dm);
      const reason = messageOf(refused.body);

      expect(refused.status).toBe(400);
      expect(reason).toBe(`${METAL.name} has no tier 10.`);
    }));

  it('takes a worn thing off, which is what makes it possible to take it away at all', () =>
    withTestDatabase(async (database) => {
      /*
       * Why this ticket landed four inventory routes rather than the two v3 Req 42.5 names:
       * `discardBuild` refuses a build the character is **wearing**, so without an unequip a DM
       * could do nothing about the sword in somebody's hand. The pair is the whole act.
       */
      const { dm, row, rules } = aTableWithACharacter(database, { snapshot: withGear });

      const helm = await buildAsDm(row.id, HELMET.id, dm);
      const slot = { equipmentSlotType: HELMET.equipmentSlotType };

      await adjust(DM_ACTION.EQUIP_ITEM, row.id, { ...slot, itemId: helm }, dm);

      const stuck = await adjust(DM_ACTION.DROP_ITEM, row.id, { itemId: helm }, dm);
      const worn = messageOf(stuck.body);

      expect(stuck.status).toBe(400);
      expect(worn).toBe('That is being worn. Take it off before putting it down.');

      const off = await adjust(DM_ACTION.UNEQUIP_ITEM, row.id, slot, dm);
      expect(off.status).toBe(200);

      // Off the figure and in the bag, because the bag is everything not worn
      const stowed = stateOf(database, row.id);
      const bagged = backpackOf(stowed, rules).map((build) => build.id);
      expect(bagged).toEqual([helm]);

      const gone = await adjust(DM_ACTION.DROP_ITEM, row.id, { itemId: helm }, dm);
      const emptied = stateOf(database, row.id);

      expect(gone.status).toBe(200);
      expect(emptied.inventory.composedItems).toEqual([]);
    }));

  it('refuses a discard of a build this character does not hold', () =>
    withTestDatabase(async (database) => {
      const { dm, row } = aTableWithACharacter(database, { snapshot: withGear });

      const refused = await adjust(DM_ACTION.DROP_ITEM, row.id, { itemId: 'build-elsewhere' }, dm);
      const reason = messageOf(refused.body);

      expect(refused.status).toBe(400);
      expect(reason).toBe('This character has no such item.');
    }));

  it('refuses emptying a slot with nothing in it, so no Event claims something moved', () =>
    withTestDatabase(async (database) => {
      const { dm, row, session } = aTableWithACharacter(database, { snapshot: withGear });

      const slot = { equipmentSlotType: HELMET.equipmentSlotType };
      const refused = await adjust(DM_ACTION.UNEQUIP_ITEM, row.id, slot, dm);
      const reason = messageOf(refused.body);
      const events = eventsOf(database, session.id);

      expect(refused.status).toBe(400);
      expect(reason).toBe('There is nothing in that slot.');
      expect(events).toHaveLength(0);
    }));
});

describe('what a DM adjustment records', () => {
  it('writes one Event naming the DM, the character and the before and after', () =>
    withTestDatabase(async (database) => {
      const { dm, row, session } = aTableWithACharacter(database);

      await adjust(DM_ACTION.AWARD_EXPERIENCE, row.id, { amount: 120 }, dm);

      const events = eventsOf(database, session.id);
      expect(events).toHaveLength(1);
      expect(events[0].actorAccountId).toBe(dm.id);
      expect(events[0].type).toBe(DM_ACTION.AWARD_EXPERIENCE);
      expect(payloadOf(events[0])).toMatchObject({
        characterId: row.id,
        action: DM_ACTION.AWARD_EXPERIENCE,
        before: 0,
        after: 120,
      });
    }));

  it('lets the Player read back the adjustments that changed their own sheet, newest first', () =>
    withTestDatabase(async (database) => {
      const { dm, player, row } = aTableWithACharacter(database);

      await adjust(DM_ACTION.AWARD_EXPERIENCE, row.id, { amount: 10 }, dm);
      await adjust(DM_ACTION.GRANT_POINTS, row.id, { points: 2 }, dm);

      const read = await history(row.id, player);

      expect(read.status).toBe(200);
      expect(read.body.adjustments.map((entry) => entry.action)).toEqual([
        DM_ACTION.GRANT_POINTS,
        DM_ACTION.AWARD_EXPERIENCE,
      ]);
      expect(read.body.adjustments[1]).toMatchObject({ before: 0, after: 10, by: 'The DM' });
    }));

  it('records the money and the pack the same way, with the before and after (TICKET-DM-02)', () =>
    withTestDatabase(async (database) => {
      const { dm, player, row } = aTableWithACharacter(database, { snapshot: withGear });

      await adjust(DM_ACTION.SET_PURSE, row.id, { amount: 30 }, dm);
      await adjust(DM_ACTION.ADJUST_PURSE, row.id, { delta: 340 }, dm);
      const helm = await buildAsDm(row.id, HELMET.id, dm);
      await adjust(
        DM_ACTION.EQUIP_ITEM,
        row.id,
        { equipmentSlotType: HELMET.equipmentSlotType, itemId: helm },
        dm
      );

      const read = await history(row.id, player);
      const entries = read.body.adjustments;

      const actions = entries.map((entry) => entry.action);

      expect(read.status).toBe(200);
      // Newest first, and every one of the four in the Player's own reading of their sheet
      expect(actions).toEqual([
        DM_ACTION.EQUIP_ITEM,
        DM_ACTION.BUILD_ITEM,
        DM_ACTION.ADJUST_PURSE,
        DM_ACTION.SET_PURSE,
      ]);

      // The purse pair carries the two balances; the build names its **template** and the new build
      expect(entries[3]).toMatchObject({ before: 0, after: 30, by: 'The DM' });
      expect(entries[2]).toMatchObject({ before: 30, after: 370, by: 'The DM' });
      expect(entries[1]).toMatchObject({ target: HELMET.id, before: null, after: helm });
      expect(entries[0]).toMatchObject({
        target: HELMET.equipmentSlotType,
        before: null,
        after: helm,
      });
    }));

  it("shows a Player nothing of another character's history", () =>
    withTestDatabase(async (database) => {
      const { dm, row, session } = aTableWithACharacter(database);
      const other = seedAccount();
      seedMember(database, { session, account: other });

      await adjust(DM_ACTION.AWARD_EXPERIENCE, row.id, { amount: 10 }, dm);

      // A Member of the table, and still not this sheet's reader — the roll log is the table's
      // shared record, somebody's experience is not
      expect((await history(row.id, other)).status).toBe(404);
    }));

  it('answers an empty history for a character at no table rather than refusing', () =>
    withTestDatabase(async (database) => {
      const owner = seedAccount();
      const ruleset = seedRuleset(database, { owner });
      const uploaded = anUploadedCharacter(database, owner, ruleset.id);

      const read = await history(uploaded.id, owner);

      expect(read.status).toBe(200);
      expect(read.body.adjustments).toEqual([]);
    }));
});

describe('who may use a DM control', () => {
  it('refuses the anonymous caller with a 401, before any lookup', () =>
    withTestDatabase(async (database) => {
      const { row } = aTableWithACharacter(database);

      expect((await adjust(DM_ACTION.AWARD_EXPERIENCE, row.id, { amount: 1 }, null)).status).toBe(
        401
      );
    }));

  it('refuses a `player` Member with the same 404 a stranger gets', () =>
    withTestDatabase(async (database) => {
      const { player, row, session } = aTableWithACharacter(database);
      const stranger = seedAccount();

      // The owner of the very character being adjusted — they know it exists, and the answer is
      // still the one an id nobody minted gets
      const asPlayer = await adjust(DM_ACTION.AWARD_EXPERIENCE, row.id, { amount: 1 }, player);
      const asStranger = await adjust(DM_ACTION.AWARD_EXPERIENCE, row.id, { amount: 1 }, stranger);
      const asNobodyReal = await adjust(
        DM_ACTION.AWARD_EXPERIENCE,
        'character-that-never-was',
        { amount: 1 },
        stranger
      );

      expect(asPlayer.status).toBe(404);
      expect(asStranger.status).toBe(404);
      expect(asNobodyReal.status).toBe(404);
      expect(asPlayer.body).toEqual(asNobodyReal.body);

      expect(stateOf(database, row.id).experience).toBe(0);
      expect(eventsOf(database, session.id)).toHaveLength(0);
    }));

  it('refuses a `player` Member the money and the pack too, on their own sheet (TICKET-DM-02)', () =>
    withTestDatabase(async (database) => {
      /*
       * The criterion's two halves at once. The **purse** has no player route at all — Req 42.5
       * gives money to the DM — so the owner's own request meets the same indistinguishable 404 a
       * stranger gets. The **pack** does have one, and the Player keeps it: what they may not do is
       * reach for the *DM's* route, which is what a stale client or a hand-made request would try.
       */
      const { player, row, session } = aTableWithACharacter(database, { snapshot: withGear });
      const stranger = seedAccount();

      const ownPurse = await adjust(DM_ACTION.SET_PURSE, row.id, { amount: 999 }, player);
      const strangerPurse = await adjust(DM_ACTION.SET_PURSE, row.id, { amount: 999 }, stranger);
      const picks = { itemId: HELMET.id, materialId: METAL.id, materialLevel: 1 };
      const ownBuild = await adjust(DM_ACTION.BUILD_ITEM, row.id, picks, player);

      expect(ownPurse.status).toBe(404);
      expect(ownBuild.status).toBe(404);
      // Byte-identical: an unauthorized read and a missing record are indistinguishable (Req 32.5)
      expect(ownPurse.body).toEqual(strangerPurse.body);

      const untouched = stateOf(database, row.id);
      const events = eventsOf(database, session.id);

      expect(untouched.purse).toBeUndefined();
      expect(untouched.inventory.composedItems).toEqual([]);
      expect(events).toHaveLength(0);
    }));

  it('routes a Player to their own inventory action instead, which is unchanged', () =>
    withTestDatabase(async (database) => {
      // The other side of the same criterion: *on their own character they are routed through
      // PLY-01's own-character routes, not these*. That route is `routes/play/buildItem.ts`, and
      // this ticket did not touch what it does — only where its body reader lives.
      const { player, row } = aTableWithACharacter(database, { snapshot: withGear });

      const picks = { itemId: HELMET.id, materialId: METAL.id, materialLevel: 1 };
      const made = await callRoute<CharacterDocument>(buildItem, {
        as: player,
        method: 'POST',
        path: `/api/characters/${row.id}/${PLAYER_ACTION.BUILD_ITEM}`,
        body: picks,
      });

      expect(made.status).toBe(200);
      expect(made.body.character.inventory.composedItems).toHaveLength(1);
    }));

  it("gives the DM's own character no special path — it is adjusted as a DM adjustment", () =>
    withTestDatabase(async (database) => {
      const { dm, session } = aTableWithACharacter(database);

      const own = seedCharacter(database, { session, owner: dm, name: "The DM's own" });

      const accepted = await adjust(DM_ACTION.AWARD_EXPERIENCE, own.id, { amount: 15 }, dm);

      expect(accepted.status).toBe(200);

      const [event] = eventsOf(database, session.id);
      expect(event.type).toBe(DM_ACTION.AWARD_EXPERIENCE);
      expect(event.actorAccountId).toBe(dm.id);
    }));

  it('refuses a DM control on a character that sits at no table', () =>
    withTestDatabase(async (database) => {
      const owner = seedAccount();
      const ruleset = seedRuleset(database, { owner });
      const uploaded = anUploadedCharacter(database, owner, ruleset.id);

      // Its owner is the only writer, and there is no table for anybody to be the DM of
      expect(
        (await adjust(DM_ACTION.AWARD_EXPERIENCE, uploaded.id, { amount: 1 }, owner)).status
      ).toBe(404);
    }));
});
