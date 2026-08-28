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
 * **Against the real corpus throughout**, and against a Snapshot with a real XP ladder pinned into
 * it where a level has to be priced: the Ducklets `xp_thresholds` curve is TICKET-CRV-03's
 * placeholder single row, which genuinely cannot tell level 4 from level 1 — so it is the fixture
 * for the *refusal* and a pinned ladder is the fixture for the acceptance.
 *
 * **Validates: v3 Req 32.1, 32.3, 32.4, 32.5, 42.1-42.7, 45.1**
 */

import { describe, expect, it } from 'vitest';
import { calculateCharacterLevel } from '#shared/engine/characterSummary';
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
import type { Configuration, Curve, Stat } from '#shared/types/config';
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
import { investStatPoints } from '../play/investStatPoints';
import { snapshotOf } from '../sessions/sessionPayloads';
import { dmAwardExperience } from './dmAwardExperience';
import { dmDeductExperience } from './dmDeductExperience';
import { dmGrantPoints } from './dmGrantPoints';
import { dmSetLevel } from './dmSetLevel';
import { dmSetResource } from './dmSetResource';
import { listAdjustments } from './listAdjustments';

/** Every route in this folder, keyed by the action it performs — so a case can drive any of them */
const ROUTES = {
  [DM_ACTION.AWARD_EXPERIENCE]: dmAwardExperience,
  [DM_ACTION.DEDUCT_EXPERIENCE]: dmDeductExperience,
  [DM_ACTION.SET_LEVEL]: dmSetLevel,
  [DM_ACTION.GRANT_POINTS]: dmGrantPoints,
  [DM_ACTION.SET_RESOURCE]: dmSetResource,
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
