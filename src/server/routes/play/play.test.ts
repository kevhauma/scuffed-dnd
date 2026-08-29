/**
 * The writes a Player makes at a table (TICKET-PLY-01)
 *
 * Seven things this file is about, one per acceptance criterion:
 *
 * 1. **An unaffordable spend is refused by the server**, proven with a request rather than with a
 *    UI interaction — the client's own control cannot offer one, which is exactly why the proof has
 *    to bypass it.
 * 2. **A resource write is clamped against the *Snapshot's* maximum**, a negative passes through
 *    (Requirement 14.4), and a stored current already above a fallen maximum is left where it is.
 * 3. **An item goes only in the slot it declares**, including the two cases a happy path never
 *    reaches: an item with no slot type at all, and a slot the Snapshot does not define.
 * 4. **The DM's power does not leak in.** `requireCharacterPlayer` is `requireCharacterWriter` minus
 *    one Account, and the case that matters is the DM getting the same 404 a stranger gets.
 * 5. **One Event per accepted action, none per refusal**, asserted by counting rows rather than by
 *    reading the handler.
 * 6. The three refusals every route in this milestone owes: anonymous, non-member, non-owner.
 * 7. The two states a sheet takes no writes in — an archived table, and no table at all.
 *
 * **Against the real corpus throughout**, and the stats and items are *found* in it rather than
 * named: a fixture ruleset with two stats cannot tell whether a pool was clamped against the right
 * formula, and a hard-coded id would make a corpus change look like a broken rule.
 *
 * **Validates: v3 Req 32.1, 32.3, 32.4, 32.5, 37.5, 41.1-41.5, 41.7, 45.1**
 */

import { describe, expect, it } from 'vitest';
import { buildCharacter } from '#shared/services/characterCreation';
import type { CharacterDocument, PlayerActionEvent } from '#shared/types/api';
import { PLAYER_ACTION } from '#shared/types/api';
import type { Character } from '#shared/types/character';
import type { Configuration, Stat } from '#shared/types/config';
import { findCharacter, insertUnseatedCharacter } from '../../repositories/characterRepository';
import { eventsSince } from '../../repositories/eventRepository';
import {
  type CallOptions,
  callRoute,
  type Database,
  seedAccount,
  seedCharacter,
  seedMember,
  seedRuleset,
  seedSession,
  withTestDatabase,
} from '../../testing';
import { archiveSession } from '../sessions/archiveSession';
import { snapshotOf } from '../sessions/sessionPayloads';
import { adjustResource } from './adjustResource';
import { equipItem } from './equipItem';
import { investStatPoints } from './investStatPoints';
import { setResource } from './setResource';
import { takeItem } from './takeItem';
import { wearItem } from './wearItem';

/** Every route in this folder, keyed by the action it performs — so a case can drive any of them */
const ROUTES = {
  [PLAYER_ACTION.INVEST_STAT_POINTS]: investStatPoints,
  [PLAYER_ACTION.SET_RESOURCE]: setResource,
  [PLAYER_ACTION.ADJUST_RESOURCE]: adjustResource,
  [PLAYER_ACTION.EQUIP_ITEM]: equipItem,
  [PLAYER_ACTION.WEAR_ITEM]: wearItem,
  [PLAYER_ACTION.TAKE_ITEM]: takeItem,
} as const;

/** Perform one action, as somebody */
function act(
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

/** Every event a session has, newest last */
function eventsOf(database: Database, sessionId: string) {
  return eventsSince(sessionId, 0, database);
}

/** One event's payload */
function payloadOf(row: { payload: string }): PlayerActionEvent {
  return JSON.parse(row.payload) as PlayerActionEvent;
}

/**
 * A table with a DM and a player, and a real character the player owns
 *
 * The character is built by the **Kernel** against the table's own Snapshot, exactly as
 * `POST /api/sessions/:id/characters` builds one, so its resource pools start at the maxima the
 * clamp will later be measured against.
 *
 * **`snapshot` is how a case adds what the corpus does not have.** The Ducklets ruleset defines
 * seven equipment slots and not one item that goes in any of them, so the equipment cases pin two
 * onto the *Snapshot* — which is the honest place for them, since a session plays by its Snapshot
 * and never by the ruleset it came from (D7).
 */
function aTableWithACharacter(
  database: Database,
  options: { snapshot?: (document: Configuration) => Configuration } = {}
) {
  const dm = seedAccount();
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

  // `data` is passed rather than left to the fixture's default, whose player state is deliberately
  // the plainest thing that parses — every case here is about a *pool* or an *allocation*, which
  // that shape has none of. This is the first test the fixture's own note said would need one.
  const row = seedCharacter(database, {
    id: character.id,
    session,
    owner: player,
    name: character.name,
    data: JSON.stringify(character),
  });

  return { dm, player, session, rules, character, row };
}

/** The first stat a Player can put points into that is not also a pool */
function investableStat(rules: Configuration): Stat {
  const stat = rules.stats.find(
    (candidate) => candidate.formula === undefined && !candidate.isResource
  );
  expect(stat, 'the corpus should define at least one invested stat').toBeDefined();

  return stat as Stat;
}

/** The pools this ruleset has, in order */
function resourceStats(rules: Configuration): Stat[] {
  const pools = rules.stats.filter((candidate) => candidate.isResource);
  expect(pools.length, 'the corpus should define at least two pools').toBeGreaterThan(1);

  return pools;
}

/**
 * Two items for one slot, pinned onto a Snapshot
 *
 * The corpus has seven slots and nothing that fits any of them, so every equipment case runs against
 * a Snapshot with these two in it. Pinned rather than invented wholesale so the rest of the ruleset
 * — the stats the clamp reads, the constants the budget reads — is still the real one.
 */
const HELMET = {
  id: 'item-test-helm',
  name: 'Test Helm',
  description: '',
  equipmentSlotType: 'head',
};
const CIRCLET = {
  id: 'item-test-circlet',
  name: 'Test Circlet',
  description: '',
  equipmentSlotType: 'head',
};

/** A Snapshot with {@link HELMET} and {@link CIRCLET} added to whatever the ruleset had */
function withGear(document: Configuration): Configuration {
  return { ...document, items: [...document.items, HELMET, CIRCLET] };
}

describe('spending points at a table', () => {
  it('refuses a spend the budget cannot pay for, with the reason, on a request the UI cannot make', () =>
    withTestDatabase(async (database) => {
      const { player, rules, row, session } = aTableWithACharacter(database);
      const stat = investableStat(rules);

      const refused = await act(
        PLAYER_ACTION.INVEST_STAT_POINTS,
        row.id,
        { statId: stat.id, points: 9_999 },
        player
      );

      expect(refused.status).toBe(400);
      // The overspend is named since TICKET-RES-05 — a Player told *no* with no number has
      // nothing to act on
      expect(messageOf(refused.body)).toContain('over the budget');

      // Nothing was written: not the character, and not the log
      expect(stateOf(database, row.id).investedStatPoints[stat.id]).toBeUndefined();
      expect(eventsOf(database, session.id)).toHaveLength(0);
      expect(findCharacter(row.id, database)?.revision).toBe(1);
    }));

  it('accepts a spend the budget covers and answers with the character the server now holds', () =>
    withTestDatabase(async (database) => {
      const { player, rules, row } = aTableWithACharacter(database);
      const stat = investableStat(rules);

      const accepted = await act(
        PLAYER_ACTION.INVEST_STAT_POINTS,
        row.id,
        { statId: stat.id, points: 1 },
        player
      );

      expect(accepted.status).toBe(200);
      expect(accepted.body.character.investedStatPoints[stat.id]).toBe(1);
      expect(accepted.body.revision).toBe(2);
      expect(stateOf(database, row.id).investedStatPoints[stat.id]).toBe(1);
    }));

  it('refuses a fractional and a negative number of points', () =>
    withTestDatabase(async (database) => {
      const { player, rules, row } = aTableWithACharacter(database);
      const stat = investableStat(rules);

      const fractional = await act(
        PLAYER_ACTION.INVEST_STAT_POINTS,
        row.id,
        { statId: stat.id, points: 2.5 },
        player
      );
      const negative = await act(
        PLAYER_ACTION.INVEST_STAT_POINTS,
        row.id,
        { statId: stat.id, points: -1 },
        player
      );

      expect(fractional.status).toBe(400);
      expect(negative.status).toBe(400);
      expect(messageOf(negative.body)).toContain('below 0');
    }));
});

describe('moving a resource at a table', () => {
  it('clamps a write to the maximum the Snapshot derives', () =>
    withTestDatabase(async (database) => {
      const { player, rules, row, character } = aTableWithACharacter(database);
      const [pool] = resourceStats(rules);

      // A fresh character's pools are seeded *at* their maxima by the Kernel, so what it was built
      // with is the ceiling — read rather than recomputed, so this asserts the server's clamp
      // instead of restating the formula it clamps against
      const max = character.currentResourceValues[pool.id];

      const clamped = await act(
        PLAYER_ACTION.SET_RESOURCE,
        row.id,
        { statId: pool.id, value: 9_999_999 },
        player
      );

      expect(clamped.status).toBe(200);
      expect(clamped.body.character.currentResourceValues[pool.id]).toBe(max);
    }));

  it('lets a pool go negative, because the clamp is one-sided (Req 14.4)', () =>
    withTestDatabase(async (database) => {
      const { player, rules, row } = aTableWithACharacter(database);
      const [pool] = resourceStats(rules);

      const negative = await act(
        PLAYER_ACTION.SET_RESOURCE,
        row.id,
        { statId: pool.id, value: -12 },
        player
      );

      expect(negative.status).toBe(200);
      expect(negative.body.character.currentResourceValues[pool.id]).toBe(-12);
    }));

  it('takes a delta off what is stored rather than off a clamped reading of it', () =>
    withTestDatabase(async (database) => {
      const { player, rules, row, character } = aTableWithACharacter(database);
      const [pool] = resourceStats(rules);
      const max = character.currentResourceValues[pool.id] as number;

      const moved = await act(
        PLAYER_ACTION.ADJUST_RESOURCE,
        row.id,
        { statId: pool.id, delta: -7 },
        player
      );

      expect(moved.body.character.currentResourceValues[pool.id]).toBe(max - 7);
    }));

  it('leaves a pool that is already above its maximum exactly where it is', () =>
    withTestDatabase(async (database) => {
      // TICKET-RES-03's rule, now server-side: a maximum that *fell* must not silently rewrite what
      // a Player is tracking. Writing to one pool is the moment a careless implementation would
      // re-clamp every other one.
      const { player, rules, row } = aTableWithACharacter(database);
      const [first, second] = resourceStats(rules);

      // Straight into storage, past every route — this is the state a shrunken maximum leaves behind
      const overMax = stateOf(database, row.id);
      overMax.currentResourceValues[first.id] = 9_999_999;
      database.sqlite
        .prepare('UPDATE character SET data = ? WHERE id = ?')
        .run(JSON.stringify(overMax), row.id);

      await act(PLAYER_ACTION.SET_RESOURCE, row.id, { statId: second.id, value: 0 }, player);

      expect(stateOf(database, row.id).currentResourceValues[first.id]).toBe(9_999_999);
    }));

  it('refuses a stat that is not a pool, and one the Snapshot does not have', () =>
    withTestDatabase(async (database) => {
      const { player, rules, row } = aTableWithACharacter(database);

      const notAPool = await act(
        PLAYER_ACTION.SET_RESOURCE,
        row.id,
        { statId: investableStat(rules).id, value: 3 },
        player
      );
      const noSuchStat = await act(
        PLAYER_ACTION.SET_RESOURCE,
        row.id,
        { statId: 'nothing-like-this', value: 3 },
        player
      );

      expect(notAPool.status).toBe(400);
      expect(messageOf(notAPool.body)).toContain('not a pool');
      expect(noSuchStat.status).toBe(400);
      expect(messageOf(noSuchStat.body)).toContain('no such stat');
    }));
});

describe('carrying and wearing things at a table', () => {
  it('puts an item in the slot it declares', () =>
    withTestDatabase(async (database) => {
      const { player, row } = aTableWithACharacter(database, { snapshot: withGear });

      const equipped = await act(
        PLAYER_ACTION.EQUIP_ITEM,
        row.id,
        { equipmentSlotType: HELMET.equipmentSlotType, itemId: HELMET.id },
        player
      );

      expect(equipped.status).toBe(200);
      expect(equipped.body.character.inventory.equippedItems[HELMET.equipmentSlotType]).toBe(
        HELMET.id
      );
    }));

  it('refuses an item whose slot type is a different one', () =>
    withTestDatabase(async (database) => {
      const { player, rules, row } = aTableWithACharacter(database, { snapshot: withGear });
      const otherSlot = rules.equipmentSlots.find(
        (slot) => slot.type !== HELMET.equipmentSlotType
      )?.type;

      expect(otherSlot, 'this ruleset should define more than one slot').toBeDefined();

      const refused = await act(
        PLAYER_ACTION.EQUIP_ITEM,
        row.id,
        { equipmentSlotType: otherSlot, itemId: HELMET.id },
        player
      );

      expect(refused.status).toBe(400);
      expect(messageOf(refused.body)).toContain('does not go in that slot');
    }));

  it('refuses an item with no slot type at all', () =>
    withTestDatabase(async (database) => {
      const { player, rules, row } = aTableWithACharacter(database, { snapshot: withGear });
      const loose = rules.items.find((candidate) => candidate.equipmentSlotType === undefined);

      expect(loose, 'the corpus should define at least one unequippable item').toBeDefined();

      const refused = await act(
        PLAYER_ACTION.EQUIP_ITEM,
        row.id,
        { equipmentSlotType: HELMET.equipmentSlotType, itemId: loose?.id },
        player
      );

      expect(refused.status).toBe(400);
      expect(messageOf(refused.body)).toContain('does not go in that slot');
    }));

  it('refuses a slot the Snapshot does not define', () =>
    withTestDatabase(async (database) => {
      const { player, row } = aTableWithACharacter(database, { snapshot: withGear });

      const refused = await act(
        PLAYER_ACTION.EQUIP_ITEM,
        row.id,
        { equipmentSlotType: 'a-slot-this-ruleset-retired', itemId: HELMET.id },
        player
      );

      expect(refused.status).toBe(400);
      expect(messageOf(refused.body)).toContain('no such equipment slot');
    }));

  it('swaps a slot occupant back into the pack rather than losing it', () =>
    withTestDatabase(async (database) => {
      const { player, row } = aTableWithACharacter(database, { snapshot: withGear });

      await act(
        PLAYER_ACTION.EQUIP_ITEM,
        row.id,
        { equipmentSlotType: HELMET.equipmentSlotType, itemId: HELMET.id },
        player
      );
      await act(PLAYER_ACTION.TAKE_ITEM, row.id, { itemId: CIRCLET.id }, player);
      const worn = await act(
        PLAYER_ACTION.WEAR_ITEM,
        row.id,
        { equipmentSlotType: HELMET.equipmentSlotType, itemId: CIRCLET.id },
        player
      );

      expect(worn.status).toBe(200);
      expect(worn.body.character.inventory.equippedItems[HELMET.equipmentSlotType]).toBe(
        CIRCLET.id
      );
      expect(worn.body.character.inventory.miscItems).toEqual([HELMET.id]);
    }));

  it('refuses an item the Snapshot does not define', () =>
    withTestDatabase(async (database) => {
      const { player, row } = aTableWithACharacter(database);

      const refused = await act(PLAYER_ACTION.TAKE_ITEM, row.id, { itemId: 'not-a-thing' }, player);

      expect(refused.status).toBe(400);
      expect(messageOf(refused.body)).toContain('no such item');
    }));
});

describe('who may perform a player action', () => {
  it('refuses an anonymous caller with a 401 and everybody else with the same 404', () =>
    withTestDatabase(async (database) => {
      const { dm, player, rules, row } = aTableWithACharacter(database);
      const stat = investableStat(rules);
      const body = { statId: stat.id, points: 1 };

      const anonymous = await act(PLAYER_ACTION.INVEST_STAT_POINTS, row.id, body, null);
      const stranger = await act(PLAYER_ACTION.INVEST_STAT_POINTS, row.id, body, seedAccount());
      const missing = await act(PLAYER_ACTION.INVEST_STAT_POINTS, 'no-such-id', body, player);
      const owner = await act(PLAYER_ACTION.INVEST_STAT_POINTS, row.id, body, player);

      expect(anonymous.status).toBe(401);
      expect(stranger.status).toBe(404);
      expect(missing.status).toBe(404);
      expect(owner.status).toBe(200);
      expect(messageOf(stranger.body)).toBe(messageOf(missing.body));

      // The DM may *write* to this sheet (`requireCharacterWriter`) and may not *play* it. Their
      // equivalent power is TICKET-DM-01's, and this is the assertion that keeps it out of here.
      const dungeonMaster = await act(PLAYER_ACTION.INVEST_STAT_POINTS, row.id, body, dm);

      expect(dungeonMaster.status).toBe(404);
      expect(messageOf(dungeonMaster.body)).toBe(messageOf(stranger.body));
    }));

  it('refuses a Member whose seat has gone, so a departed player writes nothing', () =>
    withTestDatabase(async (database) => {
      const { player, rules, row, session } = aTableWithACharacter(database);
      const stat = investableStat(rules);

      database.sqlite
        .prepare('DELETE FROM session_member WHERE session_id = ? AND account_id = ?')
        .run(session.id, player.id);

      const refused = await act(
        PLAYER_ACTION.INVEST_STAT_POINTS,
        row.id,
        { statId: stat.id, points: 1 },
        player
      );

      expect(refused.status).toBe(404);
    }));
});

describe('the two states a sheet takes no writes in', () => {
  it('refuses every action on an archived table with a 409', () =>
    withTestDatabase(async (database) => {
      const { dm, player, rules, row, session } = aTableWithACharacter(database);

      await callRoute(archiveSession, {
        as: dm,
        method: 'POST',
        path: `/api/sessions/${session.id}/archive`,
      });

      const refused = await act(
        PLAYER_ACTION.INVEST_STAT_POINTS,
        row.id,
        { statId: investableStat(rules).id, points: 1 },
        player
      );

      expect(refused.status).toBe(409);
      expect(messageOf(refused.body)).toContain('archived');
    }));

  it('refuses a character that sits at no table with a 409 that says why', () =>
    withTestDatabase(async (database) => {
      // IO-04's uploads: owned by an Account, at no table, and therefore with no session to write
      // the Event to. Refused rather than written-and-unlogged.
      const owner = seedAccount();
      const ruleset = seedRuleset(database, { owner });

      const unseated = insertUnseatedCharacter(
        {
          id: 'uploaded-1',
          ownerAccountId: owner.id,
          rulesetId: ruleset.id,
          name: 'Uploaded',
          data: JSON.stringify({ id: 'uploaded-1', name: 'Uploaded' }),
          now: Date.now(),
        },
        database
      );

      const refused = await act(
        PLAYER_ACTION.SET_RESOURCE,
        unseated.id,
        { statId: 'anything', value: 1 },
        owner
      );

      expect(refused.status).toBe(409);
      expect(messageOf(refused.body)).toContain('not at a table');
    }));
});

describe('the Event log', () => {
  it('writes exactly one event per accepted action, naming the actor and both values', () =>
    withTestDatabase(async (database) => {
      const { player, rules, row, session, character } = aTableWithACharacter(database);
      const [pool] = resourceStats(rules);
      const before = character.currentResourceValues[pool.id];

      await act(PLAYER_ACTION.ADJUST_RESOURCE, row.id, { statId: pool.id, delta: -5 }, player);

      const events = eventsOf(database, session.id);

      expect(events).toHaveLength(1);
      expect(events[0].type).toBe(PLAYER_ACTION.ADJUST_RESOURCE);
      expect(events[0].actorAccountId).toBe(player.id);
      expect(events[0].seq).toBe(1);

      expect(payloadOf(events[0])).toEqual({
        characterId: row.id,
        action: PLAYER_ACTION.ADJUST_RESOURCE,
        target: pool.id,
        before,
        after: (before as number) - 5,
      });
    }));

  it('writes none for a refused action, however many are refused', () =>
    withTestDatabase(async (database) => {
      const { player, rules, row, session } = aTableWithACharacter(database);
      const stat = investableStat(rules);

      await act(
        PLAYER_ACTION.INVEST_STAT_POINTS,
        row.id,
        { statId: stat.id, points: 9_999 },
        player
      );
      await act(PLAYER_ACTION.SET_RESOURCE, row.id, { statId: 'no-such-stat', value: 1 }, player);
      await act(PLAYER_ACTION.TAKE_ITEM, row.id, { itemId: 'no-such-item' }, player);

      expect(eventsOf(database, session.id)).toHaveLength(0);
    }));

  it('loses neither of two actions that overlap, and logs each with its own before and after', () =>
    withTestDatabase(async (database) => {
      /*
       * **The defect the `conventions-reviewer` pass found**, and the reason every route in this
       * folder reads its body *before* it guards. `await context.json()` is a real suspension
       * point, so with the guard above it two overlapping requests both loaded the row at 30, both
       * applied `-5`, and both wrote 25 — one action silently lost, and two Events in the log
       * claiming the identical before and after, which is precisely the audit trail DM-01 and
       * LIVE-02 are built to read.
       *
       * `Promise.all` is what makes this a race rather than a sequence: fired together, they
       * interleave at the `await` and nowhere else.
       */
      const { player, rules, row, session, character } = aTableWithACharacter(database);
      const [pool] = resourceStats(rules);
      const before = character.currentResourceValues[pool.id] as number;

      await Promise.all([
        act(PLAYER_ACTION.ADJUST_RESOURCE, row.id, { statId: pool.id, delta: -5 }, player),
        act(PLAYER_ACTION.ADJUST_RESOURCE, row.id, { statId: pool.id, delta: -5 }, player),
      ]);

      expect(stateOf(database, row.id).currentResourceValues[pool.id]).toBe(before - 10);

      const events = eventsOf(database, session.id);
      expect(events).toHaveLength(2);
      expect(events.map((entry) => payloadOf(entry).after)).toEqual([before - 5, before - 10]);
    }));

  it('numbers events in the order they happened', () =>
    withTestDatabase(async (database) => {
      const { player, rules, row, session } = aTableWithACharacter(database, {
        snapshot: withGear,
      });
      const [pool] = resourceStats(rules);

      await act(PLAYER_ACTION.SET_RESOURCE, row.id, { statId: pool.id, value: 0 }, player);
      await act(
        PLAYER_ACTION.EQUIP_ITEM,
        row.id,
        { equipmentSlotType: HELMET.equipmentSlotType, itemId: HELMET.id },
        player
      );

      const events = eventsOf(database, session.id);

      expect(events.map((row) => [row.seq, row.type])).toEqual([
        [1, PLAYER_ACTION.SET_RESOURCE],
        [2, PLAYER_ACTION.EQUIP_ITEM],
      ]);
    }));
});
