/**
 * Rolls resolved by the server, and the table's log (TICKET-ROLL-07)
 *
 * Six things, one per acceptance criterion:
 *
 * 1. **A roll resolves server-side**, and a body carrying a result is refused **by name** — the
 *    sharper half of the milestone's third Definition-of-Done rule, because a stat value a client
 *    invents is a claim anybody can redo and a die a client invents is a claim nobody can check.
 * 2. **The rolled pool is the pool the sheet's button showed**, asserted by deriving the label from
 *    the same Snapshot and comparing — TICKET-ROLL-06's guarantee carried across the wire.
 * 3. **Every Member reads the log; no Account outside it can.**
 * 4. **Rolls are Events**, so the log survives a reload — the property `useUIStore` never had.
 * 5. **The RNG is injectable exactly as the Kernel's is.** No test here spies on `Math.random`; the
 *    handler is built by a factory that takes a `RandomSource`, which is the same seam
 *    `rollRollDefinition` has always had.
 * 6. **A roll on somebody else's character is refused**, the DM included — rolling for a player is
 *    out of scope and `requireCharacterPlayer` is how that is said.
 *
 * **Validates: v3 Req 32.1, 32.3, 32.4, 32.5, 37.5, 41.6, 45.1, 45.2**
 */

import { describe, expect, it } from 'vitest';
import { rollPool } from '#shared/engine/dice/rollDefinition';
import { asNumber } from '#shared/engine/formula/errors';
import { buildCharacter } from '#shared/services/characterCreation';
import type { SessionRoll, SessionRollListing } from '#shared/types/api';
import { ROLL_EVENT } from '#shared/types/api';
import type { Configuration, RollDefinition } from '#shared/types/config';
import type { RollOutcome } from '#shared/types/formula';
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
import { archiveSession } from '../sessions/archiveSession';
import { snapshotOf } from '../sessions/sessionPayloads';
import { listRolls } from './listRolls';
import { rollDiceHandler } from './rollDice';

/**
 * A source of randomness a test can predict, without touching `Math.random`
 *
 * Always the top of the die's range, so every assertion about a total is arithmetic rather than a
 * snapshot: `rollDie` reads `floor(rng() * sides) + 1`, and `0.999…` is the last face.
 */
const ALWAYS_MAX = () => 0.999999;

/** …and the other end, for a case that needs the two to differ */
const ALWAYS_MIN = () => 0;

/** Roll, as somebody, with a predictable die */
function roll(characterId: string, body: unknown, as: CallOptions['as'], rng = ALWAYS_MAX) {
  return callRoute<SessionRoll>(rollDiceHandler(rng), {
    as,
    method: 'POST',
    path: `/api/characters/${characterId}/roll`,
    body,
  });
}

/** Read a table's log, as somebody — narrowed to one Player when told to */
function readLog(sessionId: string, as: CallOptions['as'], rolledBy?: string) {
  return callRoute<SessionRollListing>(listRolls, {
    as,
    path: `/api/sessions/${sessionId}/rolls`,
    ...(rolledBy ? { params: { rolledBy } } : {}),
  });
}

/** What a refusal said */
function messageOf(body: unknown): string {
  return (body as { error: { message: string } }).error.message;
}

/** A table, a Member who is not the owner, and a character the player owns */
function aTableWithACharacter(database: Database) {
  const dm = seedRegisteredAccount(database, { name: 'Dee Em' });
  const player = seedRegisteredAccount(database, { name: 'Pat Player' });
  const session = seedSession(database, { dm, from: seedRuleset(database, { owner: dm }) }).session;
  seedMember(database, { session, account: player });

  const rules = snapshotOf(session);

  // **With a race, deliberately.** A raceless character's stats are all zero, so every roll's input
  // is zero and the ladder decomposes it into no dice at all — every assertion about randomness
  // would then be comparing 0 with 0 and agreeing. The corpus's first race is what makes these
  // rolls actually throw something.
  expect(rules.races[0], 'the corpus should define at least one race').toBeDefined();

  const character = aCharacterOf(rules);

  const row = seedCharacter(database, {
    id: character.id,
    session,
    owner: player,
    name: character.name,
    data: JSON.stringify(character),
  });

  return { dm, player, session, rules, character, row };
}

/** A character built against these rules, raced so its rolls actually throw dice */
function aCharacterOf(rules: Configuration) {
  return buildCharacter(
    {
      name: 'Quackers',
      raceIds: [rules.races[0].id],
      investedStatPoints: {},
      investedSkillPoints: {},
    },
    rules,
    { id: 'roller-1', now: new Date(0).toISOString() }
  );
}

/** The first roll this ruleset defines */
function firstRoll(rules: Configuration): RollDefinition {
  const definition = (rules.rollDefinitions ?? [])[0];
  expect(definition, 'the corpus should define at least one roll').toBeDefined();

  return definition as RollDefinition;
}

describe('resolving a roll', () => {
  it('answers with the whole chain rather than a total', () =>
    withTestDatabase(async (database) => {
      const { player, rules, row } = aTableWithACharacter(database);
      const definition = firstRoll(rules);

      const rolled = await roll(row.id, { rollId: definition.id }, player);

      expect(rolled.status).toBe(200);
      expect(rolled.body.rollId).toBe(definition.id);
      expect(rolled.body.rollName).toBe(definition.name);
      // The chain, not a number: the point of the ladder is that it is visible
      expect(rolled.body.total).toBe(rolled.body.diceTotal + rolled.body.flat);
      expect(rolled.body.notation).toEqual(expect.any(String));
      expect(rolled.body.dice.length).toBeGreaterThan(0);
    }));

  it('rolls the pool the sheet’s button showed, not a pool of its own', () =>
    withTestDatabase(async (database) => {
      /*
       * TICKET-ROLL-06's guarantee, carried across the wire. The label and the dice are one
       * derivation — `rollPool` — and this derives the label here, from the same Snapshot, and
       * compares it with what the server actually threw. A server that re-evaluated the input, or
       * decomposed down a different ladder, would pass every other case in this file.
       */
      const { player, rules, row, character } = aTableWithACharacter(database);
      const definition = firstRoll(rules);

      const { calculateCharacter } = await import('#shared/engine/calculator');
      const input = asNumber(calculateCharacter(character, rules).rollInputs[definition.id]);
      expect(input, 'this roll should have a calculable input').toEqual(expect.any(Number));

      const label = rollPool(definition, input as number, rules);
      expect('notation' in label).toBe(true);

      const rolled = await roll(row.id, { rollId: definition.id }, player);

      expect(rolled.body.input).toBe(input);
      expect(rolled.body.notation).toBe((label as { notation: string }).notation);
    }));

  it('uses the randomness it is given, so nothing has to spy on Math.random', () =>
    withTestDatabase(async (database) => {
      const { player, rules, row } = aTableWithACharacter(database);
      const definition = firstRoll(rules);

      const highest = await roll(row.id, { rollId: definition.id }, player, ALWAYS_MAX);
      const lowest = await roll(row.id, { rollId: definition.id }, player, ALWAYS_MIN);

      // Same pool, opposite ends of every die — so the flat is equal and the dice are not
      expect(lowest.body.flat).toBe(highest.body.flat);
      expect(highest.body.diceTotal).toBeGreaterThan(lowest.body.diceTotal);
      expect(lowest.body.dice.every((rung) => rung.rolls.every((die) => die === 1))).toBe(true);
    }));

  it('refuses a body that reports its own result, naming the field', () =>
    withTestDatabase(async (database) => {
      const { player, rules, row, session } = aTableWithACharacter(database);
      const definition = firstRoll(rules);

      for (const field of ['total', 'results', 'dice', 'flat', 'notation', 'input']) {
        const refused = await roll(row.id, { rollId: definition.id, [field]: 20 }, player);

        expect(refused.status, `${field} should be refused`).toBe(400);
        expect(messageOf(refused.body)).toContain(field);
      }

      // …and nothing was logged for any of them
      expect(eventsSince(session.id, 0, database)).toHaveLength(0);
    }));

  it('refuses a roll this game does not define, and a body with no rollId', () =>
    withTestDatabase(async (database) => {
      const { player, row } = aTableWithACharacter(database);

      const unknown = await roll(row.id, { rollId: 'no-such-roll' }, player);
      const missing = await roll(row.id, {}, player);

      expect(unknown.status).toBe(400);
      expect(messageOf(unknown.body)).toContain('no such roll');
      expect(missing.status).toBe(400);
      expect(messageOf(missing.body)).toContain('rollId');
    }));

  it('refuses an archived table', () =>
    withTestDatabase(async (database) => {
      const { dm, player, rules, row, session } = aTableWithACharacter(database);

      await callRoute(archiveSession, {
        as: dm,
        method: 'POST',
        path: `/api/sessions/${session.id}/archive`,
      });

      const refused = await roll(row.id, { rollId: firstRoll(rules).id }, player);

      expect(refused.status).toBe(409);
      expect(messageOf(refused.body)).toContain('archived');
    }));
});

describe('who may roll', () => {
  it('refuses everybody but the character’s own Player — the DM included', () =>
    withTestDatabase(async (database) => {
      // A DM rolling for a player is deliberately out of scope: `requireCharacterPlayer` is how the
      // ticket's "a Player rolls their own" is said in code rather than in prose
      const { dm, player, rules, row } = aTableWithACharacter(database);
      const body = { rollId: firstRoll(rules).id };

      expect((await roll(row.id, body, null)).status).toBe(401);
      expect((await roll(row.id, body, seedAccount())).status).toBe(404);
      expect((await roll(row.id, body, dm)).status).toBe(404);
      expect((await roll(row.id, body, player)).status).toBe(200);
    }));
});

describe('the table’s roll log', () => {
  it('records every roll as an Event, so it survives the tab that made it', () =>
    withTestDatabase(async (database) => {
      const { player, rules, row, session } = aTableWithACharacter(database);
      const definition = firstRoll(rules);

      const rolled = await roll(row.id, { rollId: definition.id }, player);
      const events = eventsSince(session.id, 0, database);

      expect(events).toHaveLength(1);
      expect(events[0].type).toBe(ROLL_EVENT);
      expect(events[0].actorAccountId).toBe(player.id);

      // The whole outcome is in the payload, not a total — a log nobody can argue with is a log
      // that kept only the sum
      const payload = JSON.parse(events[0].payload) as {
        characterId: string;
        outcome: RollOutcome;
      };
      expect(payload.characterId).toBe(row.id);

      // **The response is the logged entry**, not the bare outcome: the roll plus who made it and
      // where it sits in the session's order, so a client can put it straight at the top of its
      // history rather than re-reading the whole log for the row it just created
      expect(rolled.body).toMatchObject(payload.outcome);
      expect(rolled.body.id).toBe(events[0].id);
      expect(rolled.body.seq).toBe(events[0].seq);
      expect(rolled.body.characterId).toBe(row.id);
      expect(rolled.body.characterName).toBe('Quackers');
      expect(rolled.body.rolledBy).toBe('Pat Player');
    }));

  it('narrows the log to one Player before the cap, not after it', () =>
    withTestDatabase(async (database) => {
      // The review found the two halves disagreeing: the route capped at the *table's* most recent
      // and the sheet filtered that window to one character, so on a busy table a Player's own
      // rolls fell off their own sheet. `?rolledBy=` narrows in the query.
      const { dm, player, rules, row, session } = aTableWithACharacter(database);
      const dmCharacter = seedCharacter(database, {
        id: 'dm-character',
        session,
        owner: dm,
        name: 'The DM’s own',
        data: JSON.stringify({ ...aCharacterOf(rules), id: 'dm-character' }),
      });

      await roll(row.id, { rollId: firstRoll(rules).id }, player);
      await roll(dmCharacter.id, { rollId: firstRoll(rules).id }, dm);

      const whole = await readLog(session.id, player);
      const mine = await readLog(session.id, player, player.id);

      expect(whole.body.rolls).toHaveLength(2);
      expect(mine.body.rolls).toHaveLength(1);
      expect(mine.body.rolls[0].characterId).toBe(row.id);
    }));

  it('reads back with who rolled and what they were playing, newest first', () =>
    withTestDatabase(async (database) => {
      const { player, rules, row, session } = aTableWithACharacter(database);
      const definitions = rules.rollDefinitions ?? [];
      expect(definitions.length, 'this case needs two rolls').toBeGreaterThan(1);

      await roll(row.id, { rollId: definitions[0].id }, player);
      await roll(row.id, { rollId: definitions[1].id }, player);

      const log = await readLog(session.id, player);

      expect(log.status).toBe(200);
      expect(log.body.rolls.map((entry) => entry.rollId)).toEqual([
        definitions[1].id,
        definitions[0].id,
      ]);
      expect(log.body.rolls[0].characterName).toBe('Quackers');
      expect(log.body.rolls[0].rolledBy).toBe('Pat Player');
      expect(log.body.rolls[0].characterId).toBe(row.id);
      // The Event's own sequence — the `(session, seq)` key LIVE-03 replays from
      expect(log.body.rolls.map((entry) => entry.seq)).toEqual([2, 1]);
    }));

  it('is every Member’s to read, and nobody else’s', () =>
    withTestDatabase(async (database) => {
      const { dm, player, rules, row, session } = aTableWithACharacter(database);

      await roll(row.id, { rollId: firstRoll(rules).id }, player);

      // A game is played out loud: the DM did not roll it and reads it anyway
      const asDm = await readLog(session.id, dm);
      expect(asDm.status).toBe(200);
      expect(asDm.body.rolls).toHaveLength(1);

      expect((await readLog(session.id, null)).status).toBe(401);
      expect((await readLog(session.id, seedAccount())).status).toBe(404);
      expect((await readLog('no-such-session', player)).status).toBe(404);
    }));

  it('answers an empty log rather than refusing one', () =>
    withTestDatabase(async (database) => {
      const { player, session } = aTableWithACharacter(database);

      const log = await readLog(session.id, player);

      expect(log.status).toBe(200);
      expect(log.body.rolls).toEqual([]);
    }));

  it('carries no player action into the roll log', () =>
    withTestDatabase(async (database) => {
      // The log is filtered by `type`, and PLY-01's eleven write Events to the same table. A log
      // that showed *invested 3 points in Strength* as a roll would be the filter missing.
      const { player, rules, row, session } = aTableWithACharacter(database);
      const { investStatPoints } = await import('../play/investStatPoints');
      const investable = rules.stats.find((stat) => !stat.isResource && stat.formula === undefined);

      await callRoute(investStatPoints, {
        as: player,
        method: 'POST',
        path: `/api/characters/${row.id}/invest-stat-points`,
        body: { statId: investable?.id, points: 1 },
      });
      await roll(row.id, { rollId: firstRoll(rules).id }, player);

      expect(eventsSince(session.id, 0, database)).toHaveLength(2);

      const log = await readLog(session.id, player);
      expect(log.body.rolls).toHaveLength(1);
    }));
});
