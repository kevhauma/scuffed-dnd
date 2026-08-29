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
import { backpackOf } from '#shared/engine/composedItems';
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
import { buildItem } from './buildItem';
import { dropItem } from './dropItem';
import { equipItem } from './equipItem';
import { investStatPoints } from './investStatPoints';
import { setFocusSkills } from './setFocusSkills';
import { setResource } from './setResource';
import { unequipItem } from './unequipItem';

/** Every route in this folder, keyed by the action it performs — so a case can drive any of them */
const ROUTES = {
  [PLAYER_ACTION.INVEST_STAT_POINTS]: investStatPoints,
  [PLAYER_ACTION.SET_RESOURCE]: setResource,
  [PLAYER_ACTION.ADJUST_RESOURCE]: adjustResource,
  [PLAYER_ACTION.EQUIP_ITEM]: equipItem,
  [PLAYER_ACTION.UNEQUIP_ITEM]: unequipItem,
  [PLAYER_ACTION.BUILD_ITEM]: buildItem,
  [PLAYER_ACTION.DROP_ITEM]: dropItem,
  [PLAYER_ACTION.SET_FOCUS_SKILLS]: setFocusSkills,
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

/**
 * A metal every test build is made of (TICKET-INV-06)
 *
 * Pinned beside the two templates because building **requires a material and a rung**: the picker
 * offers a family and a tier, and the Kernel refuses a triple missing either. Which metal it is does
 * not matter to a single case here — what is under test is where a build ends up, not what it is
 * worth — so one family at one rung is the whole fixture.
 */
const METAL = {
  id: 'mat-test-metal',
  name: 'Test Metal',
  description: '',
  categoryId: 'cat-test-metal',
  levels: [{ level: 1, name: 'Plain', bonuses: [], value: { tierId: 'gold', amount: 1 } }],
};

/** A Snapshot with {@link HELMET}, {@link CIRCLET} and {@link METAL} added to what the ruleset had */
function withGear(document: Configuration): Configuration {
  return {
    ...document,
    items: [...document.items, HELMET, CIRCLET],
    materials: [...document.materials, METAL],
  };
}

/**
 * Build a template into the character's inventory, and hand back the new build's id
 *
 * **Every equipment case starts here since TICKET-INV-05.** A slot holds a `ComposedItem.id` rather
 * than a catalog id, and `equipToSlot` refuses one the character does not have — so equipping is now
 * something a Player does to a thing they built, and the two steps are what the surface does too.
 * The id is minted by the *server* (`buildItem`), which is why it is read back out rather than named.
 *
 * @param characterId - Whose inventory
 * @param templateId - Which of the Snapshot's templates to build
 * @param as - The account making the request
 * @returns The new build's id
 */
async function build(
  characterId: string,
  templateId: string,
  as: CallOptions['as']
): Promise<string> {
  const picks = { itemId: templateId, materialId: METAL.id, materialLevel: 1 };
  const made = await act(PLAYER_ACTION.BUILD_ITEM, characterId, picks, as);
  const built = made.body.character.inventory.composedItems.at(-1);

  expect(built?.templateId, `building ${templateId} did not make one`).toBe(templateId);

  return built?.id as string;
}

/** Everything the character has built and is not wearing, as the Backpack derives it */
function backpackAt(document: CharacterDocument, rules: Configuration): string[] {
  return backpackOf(document.character, rules).map((held) => held.id);
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

describe('choosing focus skills at a table (TICKET-SKL-05)', () => {
  it('stores the three picks, duplicates and all, and logs what they were', () =>
    withTestDatabase(async (database) => {
      const { player, rules, row, session } = aTableWithACharacter(database);
      const [first, second] = rules.skills;
      // The sample character's own shape: two different skills and one of them twice
      const picks = [first?.id ?? '', second?.id ?? '', first?.id ?? ''];

      const accepted = await act(
        PLAYER_ACTION.SET_FOCUS_SKILLS,
        row.id,
        {
          focusSkillIds: picks,
        },
        player
      );

      expect(accepted.status).toBe(200);
      expect(accepted.body.character.focusSkillIds).toEqual(picks);
      expect(stateOf(database, row.id).focusSkillIds).toEqual(picks);

      const [event] = eventsOf(database, session.id);
      expect(payloadOf(event as { payload: string }).after).toBe(picks.join(', '));
    }));

  it('refuses a skill the Snapshot does not have, writing neither the character nor the log', () =>
    withTestDatabase(async (database) => {
      const { player, row, session } = aTableWithACharacter(database);

      const refused = await act(
        PLAYER_ACTION.SET_FOCUS_SKILLS,
        row.id,
        {
          focusSkillIds: ['nonesuch'],
        },
        player
      );

      expect(refused.status).toBe(400);
      expect(messageOf(refused.body)).toMatch(/not a skill/i);
      expect(stateOf(database, row.id).focusSkillIds).toBeUndefined();
      expect(eventsOf(database, session.id)).toHaveLength(0);
    }));

  it('refuses a body that is not a list of ids before the Kernel is asked', () =>
    withTestDatabase(async (database) => {
      const { player, row } = aTableWithACharacter(database);

      const refused = await act(
        PLAYER_ACTION.SET_FOCUS_SKILLS,
        row.id,
        {
          focusSkillIds: 'arcane',
        },
        player
      );

      expect(refused.status).toBe(400);
      expect(messageOf(refused.body)).toContain('list of ids');
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
  it('puts a build in the slot its template declares', () =>
    withTestDatabase(async (database) => {
      const { player, row } = aTableWithACharacter(database, { snapshot: withGear });
      const helm = await build(row.id, HELMET.id, player);

      const equipped = await act(
        PLAYER_ACTION.EQUIP_ITEM,
        row.id,
        { equipmentSlotType: HELMET.equipmentSlotType, itemId: helm },
        player
      );

      expect(equipped.status).toBe(200);
      expect(equipped.body.character.inventory.equippedItems[HELMET.equipmentSlotType]).toBe(helm);
    }));

  it('refuses a build whose template declares a different slot', () =>
    withTestDatabase(async (database) => {
      const { player, rules, row } = aTableWithACharacter(database, { snapshot: withGear });
      const otherSlot = rules.equipmentSlots.find(
        (slot) => slot.type !== HELMET.equipmentSlotType
      )?.type;

      expect(otherSlot, 'this ruleset should define more than one slot').toBeDefined();

      const helm = await build(row.id, HELMET.id, player);
      const refused = await act(
        PLAYER_ACTION.EQUIP_ITEM,
        row.id,
        { equipmentSlotType: otherSlot, itemId: helm },
        player
      );

      expect(refused.status).toBe(400);
      expect(messageOf(refused.body)).toContain('does not go in that slot');
    }));

  it('refuses a build whose template declares no slot type at all', () =>
    withTestDatabase(async (database) => {
      const { player, rules, row } = aTableWithACharacter(database, { snapshot: withGear });
      const loose = rules.items.find((candidate) => candidate.equipmentSlotType === undefined);

      expect(loose, 'the corpus should define at least one unequippable item').toBeDefined();

      const rope = await build(row.id, loose?.id as string, player);
      const refused = await act(
        PLAYER_ACTION.EQUIP_ITEM,
        row.id,
        { equipmentSlotType: HELMET.equipmentSlotType, itemId: rope },
        player
      );

      expect(refused.status).toBe(400);
      expect(messageOf(refused.body)).toContain('does not go in that slot');
    }));

  it('refuses a slot the Snapshot does not define', () =>
    withTestDatabase(async (database) => {
      const { player, row } = aTableWithACharacter(database, { snapshot: withGear });
      const helm = await build(row.id, HELMET.id, player);

      const refused = await act(
        PLAYER_ACTION.EQUIP_ITEM,
        row.id,
        { equipmentSlotType: 'a-slot-this-ruleset-retired', itemId: helm },
        player
      );

      expect(refused.status).toBe(400);
      expect(messageOf(refused.body)).toContain('no such equipment slot');
    }));

  it('refuses a build this character does not have (TICKET-INV-05)', () =>
    withTestDatabase(async (database) => {
      // An id here named a catalog template, which every character could equip by definition; it
      // names one Player's build now, and a request naming somebody else's is refused by the Kernel
      const { player, row } = aTableWithACharacter(database, { snapshot: withGear });

      const refused = await act(
        PLAYER_ACTION.EQUIP_ITEM,
        row.id,
        { equipmentSlotType: HELMET.equipmentSlotType, itemId: 'build-somebody-elses' },
        player
      );

      expect(refused.status).toBe(400);
      expect(messageOf(refused.body)).toContain('no such item');
    }));

  it('takes a slot occupant off and back on, moving it out of the Backpack and in again', () =>
    withTestDatabase(async (database) => {
      // The round trip TICKET-INV-06's criteria pin, through the routes: nothing is written to a
      // carried list at either end, because the Backpack is what the slots leave over
      const { player, rules, row } = aTableWithACharacter(database, { snapshot: withGear });
      const geared = withGear(rules);
      const slot = { equipmentSlotType: HELMET.equipmentSlotType };
      const helm = await build(row.id, HELMET.id, player);

      const worn = await act(PLAYER_ACTION.EQUIP_ITEM, row.id, { ...slot, itemId: helm }, player);
      const off = await act(PLAYER_ACTION.UNEQUIP_ITEM, row.id, slot, player);

      expect(backpackAt(worn.body, geared)).toEqual([]);
      expect(off.status).toBe(200);
      expect(backpackAt(off.body, geared)).toEqual([helm]);
      // Unequipping keeps the thing the Player made — `unequip-item` destroyed it until INV-06, and
      // `stow-item` was the other half of a distinction the derived Backpack dissolved
      expect(off.body.character.inventory.composedItems.map((held) => held.id)).toEqual([helm]);
    }));

  it('equips into an occupied slot without orphaning what it displaces (the INV-05 review)', () =>
    withTestDatabase(async (database) => {
      // **`equip-item` into a full slot was the one path nothing covered**, and it was where the
      // displaced build went nowhere: out of `equippedItems`, never into the pack, still in
      // `composedItems` — undeletable material, invisible to the Player.
      const { player, rules, row } = aTableWithACharacter(database, { snapshot: withGear });
      const geared = withGear(rules);
      const slot = { equipmentSlotType: HELMET.equipmentSlotType };
      const helm = await build(row.id, HELMET.id, player);
      const circlet = await build(row.id, CIRCLET.id, player);

      await act(PLAYER_ACTION.EQUIP_ITEM, row.id, { ...slot, itemId: helm }, player);
      const swapped = await act(
        PLAYER_ACTION.EQUIP_ITEM,
        row.id,
        { ...slot, itemId: circlet },
        player
      );

      expect(swapped.status).toBe(200);

      const { equippedItems, composedItems } = swapped.body.character.inventory;
      const bagged = backpackAt(swapped.body, geared);

      expect(equippedItems[HELMET.equipmentSlotType]).toBe(circlet);
      expect(bagged).toEqual([helm]);
      // Every build the character holds is worn or in the bag — the invariant, over the whole
      // inventory rather than over the one record this case moved
      expect([...Object.values(equippedItems), ...bagged].sort()).toEqual(
        composedItems.map((held) => held.id).sort()
      );
    }));

  it('refuses an item the Snapshot does not define', () =>
    withTestDatabase(async (database) => {
      const { player, row } = aTableWithACharacter(database);

      const refused = await act(
        PLAYER_ACTION.BUILD_ITEM,
        row.id,
        { itemId: 'not-a-thing' },
        player
      );

      expect(refused.status).toBe(400);
      expect(messageOf(refused.body)).toContain('no such item');
    }));

  it('refuses a triple with no material and one naming a rung the family lacks (TICKET-INV-06)', () =>
    withTestDatabase(async (database) => {
      // The same shared rule the browser's picker asks — a request is not a picker, and this is the
      // half of it that only a route can reach
      const { player, row } = aTableWithACharacter(database, { snapshot: withGear });

      const bare = await act(PLAYER_ACTION.BUILD_ITEM, row.id, { itemId: HELMET.id }, player);
      const noRung = await act(
        PLAYER_ACTION.BUILD_ITEM,
        row.id,
        { itemId: HELMET.id, materialId: METAL.id, materialLevel: 10 },
        player
      );

      expect(bare.status).toBe(400);
      expect(messageOf(bare.body)).toContain('what this is made of');
      expect(noRung.status).toBe(400);
      expect(messageOf(noRung.body)).toBe('Test Metal has no tier 10.');
    }));

  it('destroys a build on drop, and refuses to destroy one being worn', () =>
    withTestDatabase(async (database) => {
      const { player, rules, row } = aTableWithACharacter(database, { snapshot: withGear });
      const geared = withGear(rules);
      const slot = { equipmentSlotType: HELMET.equipmentSlotType };
      const helm = await build(row.id, HELMET.id, player);
      const circlet = await build(row.id, CIRCLET.id, player);

      await act(PLAYER_ACTION.EQUIP_ITEM, row.id, { ...slot, itemId: helm }, player);

      const refused = await act(PLAYER_ACTION.DROP_ITEM, row.id, { itemId: helm }, player);
      const dropped = await act(PLAYER_ACTION.DROP_ITEM, row.id, { itemId: circlet }, player);

      expect(refused.status).toBe(400);
      expect(messageOf(refused.body)).toContain('Take it off');
      expect(dropped.status).toBe(200);
      expect(backpackAt(dropped.body, geared)).toEqual([]);
      expect(dropped.body.character.inventory.composedItems.map((held) => held.id)).toEqual([helm]);
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
      await act(PLAYER_ACTION.BUILD_ITEM, row.id, { itemId: 'no-such-item' }, player);

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
      const helm = await build(row.id, HELMET.id, player);

      await act(PLAYER_ACTION.SET_RESOURCE, row.id, { statId: pool.id, value: 0 }, player);
      await act(
        PLAYER_ACTION.EQUIP_ITEM,
        row.id,
        { equipmentSlotType: HELMET.equipmentSlotType, itemId: helm },
        player
      );

      const events = eventsOf(database, session.id);

      // The build is an accepted action too, so it is the first thing in the log
      expect(events.map((row) => [row.seq, row.type])).toEqual([
        [1, PLAYER_ACTION.BUILD_ITEM],
        [2, PLAYER_ACTION.SET_RESOURCE],
        [3, PLAYER_ACTION.EQUIP_ITEM],
      ]);
    }));
});
