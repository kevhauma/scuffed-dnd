/**
 * Creating and reading a character at a table (TICKET-CHAR-04)
 *
 * The six things this file is really about, one per acceptance criterion:
 *
 * 1. **Every Member reads every character; no other Account reads any** (v3 Req 40.2).
 * 2. **A non-member's creation is refused indistinguishably from a missing session** — the same
 *    404, on the same shaped request, which is v3 Req 32.5 at the surface people actually reach.
 * 3. **A derived value is rejected by name, not stripped.** The milestone's third
 *    Definition-of-Done rule, and the one most easily satisfied wrongly: taking the five fields we
 *    want and ignoring the rest passes every happy-path test and lets a client believe its `level`
 *    was honoured.
 * 4. **The Kernel's rules run server-side** — race cardinality, the archetype requirement, and
 *    `validateStatAllocation`'s affordability refusal — each asserted by a **rejected request**
 *    rather than by reading the code.
 * 5. **`currentResourceValues` is seeded from the Snapshot's maxima**, and only for `isResource`
 *    stats, exactly as the browser's store does.
 * 6. **An uploaded character is readable and is stated as being at no table**, and can be removed —
 *    which is the hole IO-04's own review left open.
 *
 * **Against the real corpus throughout.** A two-stat ruleset cannot tell whether a resource was
 * seeded from the right formula, and the seeded Ducklets ruleset can.
 *
 * **Validates: v3 Req 32.1, 32.3, 32.4, 32.5, 36.5, 37.5, 40.1-40.5, 40.7, 40.8, 45.1**
 */

import { describe, expect, it } from 'vitest';
import {
  FOCUS_CHOSEN_NAME,
  FOCUS_OTHER_NAME,
  FOCUS_SLOT_COUNT,
  focusDials,
} from '#shared/engine/focusSkills';
import { racesRequired } from '#shared/engine/races';
import type {
  CharacterCreateRequest,
  CharacterDocument,
  CharacterListing,
} from '#shared/types/api';
import type { Configuration } from '#shared/types/config';
import { findCharacter, insertUnseatedCharacter } from '../../repositories/characterRepository';
import {
  type CallOptions,
  callRoute,
  type Database,
  type GameSessionRow,
  seedAccount,
  seedCharacter,
  seedMember,
  seedRuleset,
  seedSession,
  unseatMember,
  withTestDatabase,
} from '../../testing';
import { archiveSession } from '../sessions/archiveSession';
import { createCharacter } from '../sessions/createCharacter';
import { listCharacters } from '../sessions/listCharacters';
import { snapshotOf } from '../sessions/sessionPayloads';
import { deleteCharacter } from './deleteCharacter';
import { listMyCharacters } from './listMyCharacters';

/** Create a character at a table, as somebody */
function create(sessionId: string, body: Partial<CharacterCreateRequest>, as: CallOptions['as']) {
  return callRoute<CharacterDocument>(createCharacter, {
    as,
    method: 'POST',
    path: `/api/sessions/${sessionId}/characters`,
    body,
  });
}

/** Read a table's characters, as somebody */
function listAtTable(sessionId: string, as: CallOptions['as']) {
  return callRoute<CharacterListing>(listCharacters, {
    as,
    path: `/api/sessions/${sessionId}/characters`,
  });
}

/** Read my own characters that sit at no table */
function listMine(as: CallOptions['as']) {
  return callRoute<CharacterListing>(listMyCharacters, { as, path: '/api/characters' });
}

/** Throw one away, as somebody */
function remove(characterId: string, as: CallOptions['as']) {
  return callRoute(deleteCharacter, {
    as,
    method: 'DELETE',
    path: `/api/characters/${characterId}`,
  });
}

/** What a refusal said */
function messageOf(body: unknown): string {
  return (body as { error: { message: string } }).error.message;
}

/** A table with a DM and a player, both able to make a character at it */
function aTable(database: Database) {
  const dm = seedAccount();
  const player = seedAccount();
  const { session } = seedSession(database, { dm });
  seedMember(database, { session, account: player });

  return { dm, player, session };
}

/** The rules the table plays by, as the routes read them */
function rulesOf(session: GameSessionRow): Configuration {
  return snapshotOf(session);
}

/**
 * The corpus's first race, filling every slot the corpus asks for (TICKET-RACE-04)
 *
 * A character carries **exactly** `const.race_count` races now, so a body claiming none is refused
 * by the Kernel before any of the rules below is reached. The same race in every slot is what a
 * pure-blood is, and the server derives the count from the Snapshot rather than from anything the
 * body says about it.
 */
function pureBlood(rules: Configuration): string[] {
  const [first] = rules.races;
  if (first === undefined) return [];

  const required = racesRequired(rules);
  return Array.from({ length: required }, () => first.id);
}

/**
 * The focus picks the ruleset asks for, or none where it asks for nothing (TICKET-SKL-05)
 *
 * The corpus **states both dials** since the data pass re-sourced the constants from the workbook's
 * *Enhanced scaling* block, so a body that names no picks is refused at a corpus table exactly as it
 * would be at any other. Filling them the way the wizard does keeps every case below testing the
 * rule it is named for rather than this one.
 *
 * @param rules - The table's Snapshot
 * @returns Three picks of the ruleset's first skill, or none when focus is not in play
 */
function focusPicks(rules: Configuration): string[] | undefined {
  const { stated } = focusDials(rules.constants);
  const [first] = rules.skills;
  if (!stated || first === undefined) return undefined;
  return Array.from({ length: FOCUS_SLOT_COUNT }, () => first.id);
}

/** A creation body that the corpus accepts — no points spent, one archetype if the corpus has any */
function validBody(session: GameSessionRow, overrides: Partial<CharacterCreateRequest> = {}) {
  const rules = rulesOf(session);

  return {
    name: 'Quackers',
    raceIds: pureBlood(rules),
    investedStatPoints: {},
    investedSkillPoints: {},
    archetypeId: rules.archetypes?.[0]?.id,
    focusSkillIds: focusPicks(rules),
    ...overrides,
  };
}

/**
 * The same table with both focus dials taken back out of the Snapshot
 *
 * Focus is a ruleset's choice and a ruleset may decline it. Since the corpus stopped being such a
 * ruleset, the *no dials* case needs building rather than assuming.
 *
 * @param database - The test database
 * @returns The same shape `aTable` returns, over a focus-free ruleset
 */
function anUndialledTable(database: Database) {
  const dm = seedAccount();
  const player = seedAccount();
  const ruleset = seedRuleset(database, { owner: dm });
  const document = JSON.parse(ruleset.data) as Configuration;
  const dials = new Set([FOCUS_CHOSEN_NAME, FOCUS_OTHER_NAME]);
  const kept = (document.constants ?? []).filter((constant) => !dials.has(constant.name));
  const undialled: Configuration = { ...document, constants: kept };

  const { session } = seedSession(database, {
    dm,
    from: ruleset,
    snapshot: JSON.stringify(undialled),
  });
  seedMember(database, { session, account: player });

  return { dm, player, session };
}

describe('creating a character at a table', () => {
  it('should be open to every Member and to nobody else', () =>
    withTestDatabase(async (database) => {
      const { dm, player, session } = aTable(database);

      expect((await create(session.id, validBody(session), null)).status).toBe(401);
      // A stranger and a session that never existed are the same answer (v3 Req 32.5)
      expect((await create(session.id, validBody(session), seedAccount())).status).toBe(404);
      expect((await create('no-such-session', validBody(session), seedAccount())).status).toBe(404);

      expect((await create(session.id, validBody(session), player)).status).toBe(200);
      // The DM plays too — a rule that let them run a table but not sit at one would be a rule
      // about our data model rather than about tables
      expect((await create(session.id, validBody(session), dm)).status).toBe(200);
    }));

  it('should store it against the table, naming no ruleset', () =>
    withTestDatabase(async (database) => {
      const { player, session } = aTable(database);

      const made = await create(session.id, validBody(session), player);

      expect(made.body.sessionId).toBe(session.id);
      // A session character plays by the Snapshot; pointing it at the ruleset the Snapshot came
      // from would give it a second set of rules and a cascade that could delete it mid-campaign
      expect(made.body.rulesetId).toBeNull();
      expect(made.body.ownerAccountId).toBe(player.id);
      expect(made.body.character.experience).toBe(0);
    }));

  it('should seed every resource stat to its maximum, and nothing else', () =>
    withTestDatabase(async (database) => {
      const { player, session } = aTable(database);
      const rules = rulesOf(session);

      const made = await create(session.id, validBody(session), player);
      const seeded = made.body.character.currentResourceValues;

      const resourceIds = rules.stats.filter((stat) => stat.isResource).map((stat) => stat.id);

      // The corpus has resources, so this is a real assertion rather than an empty one
      expect(resourceIds.length).toBeGreaterThan(0);
      expect(Object.keys(seeded).length).toBeGreaterThan(0);
      // A stat you cannot spend has no *current* distinct from its value (TICKET-STAT-01)
      expect(Object.keys(seeded).every((statId) => resourceIds.includes(statId))).toBe(true);
      // Numbers, not the `FormulaResult`s the calculator hands back — and **no assertion that they
      // are positive**: a resource whose formula reads zero at level 1 is a ruleset's business, and
      // a test that insisted otherwise would be asserting the corpus rather than the seeding
      expect(Object.values(seeded).every((value) => Number.isFinite(value))).toBe(true);

      // The other half of *seeded from the maxima*: the same numbers the calculator produces for
      // this character against this Snapshot, rather than any number at all
      const { calculateCharacter } = await import('#shared/engine/calculator');
      const { asNumber } = await import('#shared/engine/formula/errors');
      const { statValues } = calculateCharacter(made.body.character, rules);

      for (const [statId, current] of Object.entries(seeded)) {
        expect(current).toBe(asNumber(statValues[statId]));
      }
    }));

  it('should refuse an archived table', () =>
    withTestDatabase(async (database) => {
      const { dm, player, session } = aTable(database);

      await callRoute(archiveSession, {
        as: dm,
        method: 'POST',
        path: `/api/sessions/${session.id}/archive`,
        body: {},
      });

      expect((await create(session.id, validBody(session), player)).status).toBe(409);
    }));
});

describe('the derived values a client may not send', () => {
  it.each([
    ['statValues', { alpha: 12 }],
    ['level', 7],
    ['statTotal', 42],
    ['pointBudget', 99],
    ['currentResourceValues', { alpha: 3 }],
    ['experience', 5000],
    ['rollResults', [{ total: 20 }]],
  ])('should reject %s by name rather than stripping it', (field, value) =>
    withTestDatabase(async (database) => {
      const { player, session } = aTable(database);

      const refused = await create(
        session.id,
        { ...validBody(session), [field]: value } as Partial<CharacterCreateRequest>,
        player
      );

      expect(refused.status).toBe(400);
      // **By name.** Ignoring it would pass every happy-path test and let a client believe the
      // value was honoured, which is how a sheet and a client come to disagree with no explanation
      expect(messageOf(refused.body)).toContain(field);
    })
  );

  it('should ignore a field that is not a claim about a rule', () =>
    withTestDatabase(async (database) => {
      const { player, session } = aTable(database);

      // Noise, not a derived value — refusing it would make the API brittle for no safety
      const made = await create(
        session.id,
        { ...validBody(session), favouriteColour: 'teal' } as Partial<CharacterCreateRequest>,
        player
      );

      expect(made.status).toBe(200);
    }));

  it('should refuse a malformed allocation before the engine sees it', () =>
    withTestDatabase(async (database) => {
      const { player, session } = aTable(database);

      const refused = await create(
        session.id,
        { ...validBody(session), investedStatPoints: { alpha: 1.5 } },
        player
      );

      expect(refused.status).toBe(400);
      // A fractional or infinite spend comes back from the engine as an *unpriceable gain*, which
      // reads as the ruleset's fault and sends the reader looking in the wrong place
      expect(messageOf(refused.body)).toContain('whole number');
    }));
});

describe('the Kernel’s own rules, applied server-side', () => {
  it('should refuse more races than a character can blend', () =>
    withTestDatabase(async (database) => {
      const { player, session } = aTable(database);
      const raceIds = rulesOf(session)
        .races.slice(0, 3)
        .map((race) => race.id);

      expect(raceIds).toHaveLength(3);

      const refused = await create(session.id, validBody(session, { raceIds }), player);

      expect(refused.status).toBe(400);
      expect(messageOf(refused.body)).toContain('blend');
    }));

  it('should refuse fewer races than the Snapshot asks for, naming the count (TICKET-RACE-04)', () =>
    withTestDatabase(async (database) => {
      const { player, session } = aTable(database);
      const rules = rulesOf(session);
      const required = racesRequired(rules);

      // The corpus states no `race_count`, so the count is the reader's default of 2 — which is
      // the half of this the server derives rather than being told
      expect(required).toBe(2);

      const refused = await create(session.id, validBody(session, { raceIds: [] }), player);

      expect(refused.status).toBe(400);
      expect(messageOf(refused.body)).toContain('exactly 2 races');
    }));

  it('should require an archetype when the Snapshot defines any', () =>
    withTestDatabase(async (database) => {
      const { player, session } = aTable(database);

      expect(rulesOf(session).archetypes?.length).toBeGreaterThan(0);

      const refused = await create(
        session.id,
        { ...validBody(session), archetypeId: undefined },
        player
      );

      expect(refused.status).toBe(400);
      expect(messageOf(refused.body)).toContain('archetype');
    }));

  it('should refuse an archetype the Snapshot does not have', () =>
    withTestDatabase(async (database) => {
      const { player, session } = aTable(database);

      const refused = await create(
        session.id,
        validBody(session, { archetypeId: 'not-an-archetype' }),
        player
      );

      expect(refused.status).toBe(400);
    }));

  it('should refuse an allocation the character cannot afford', () =>
    withTestDatabase(async (database) => {
      const { player, session } = aTable(database);
      const rules = rulesOf(session);
      const investable = rules.stats.find((stat) => stat.formula === undefined);

      if (!investable) throw new Error('the corpus should have an investable stat');

      // A fresh character is at level 1's budget, so this is far past it
      const refused = await create(
        session.id,
        validBody(session, { investedStatPoints: { [investable.id]: 9_999 } }),
        player
      );

      expect(refused.status).toBe(400);
      expect(messageOf(refused.body)).toMatch(/spends 9999 points|cannot take those points/);
    }));

  it('should refuse a race the Snapshot does not have', () =>
    withTestDatabase(async (database) => {
      const { player, session } = aTable(database);

      expect(
        (await create(session.id, validBody(session, { raceIds: ['not-a-race'] }), player)).status
      ).toBe(400);
    }));

  /**
   * The focus picks have to *reach* the server (TICKET-SKL-05)
   *
   * The route runs `characterCreationErrors` against the Snapshot, so on a ruleset that states a
   * focus dial a body that dropped the picks is refused for naming none — by a wizard that named
   * three. The first pass shipped exactly that: `createSessionCharacter` built the request field by
   * field and left the new one out, which made creation at such a table **impossible** rather than
   * merely lossy. These cases are what would have caught it.
   */
  describe('focus skills', () => {
    /** The corpus with the sheet's own dials pinned onto the Snapshot — the data pass owns their values */
    function aDialledTable(database: Database) {
      const dm = seedAccount();
      const player = seedAccount();
      const ruleset = seedRuleset(database, { owner: dm });
      const document = JSON.parse(ruleset.data) as Configuration;

      const dialled: Configuration = {
        ...document,
        constants: [
          ...(document.constants ?? []),
          {
            id: 'fc',
            name: 'focus_chosen',
            displayName: 'Focus chosen',
            description: '',
            value: 1.5,
          },
          {
            id: 'fo',
            name: 'focus_other',
            displayName: 'Focus other',
            description: '',
            value: 0.3,
          },
        ],
      };

      const { session } = seedSession(database, {
        dm,
        from: ruleset,
        snapshot: JSON.stringify(dialled),
      });
      seedMember(database, { session, account: player });

      return { player, session };
    }

    /** Three picks off the Snapshot's own skill list, the middle one repeated */
    function stackedPicks(session: GameSessionRow): string[] {
      const [first, second] = rulesOf(session).skills;
      if (!first || !second) throw new Error('the corpus should have skills');

      return [first.id, second.id, second.id];
    }

    it('should store the picks the wizard sent, duplicates kept', () =>
      withTestDatabase(async (database) => {
        const { player, session } = aDialledTable(database);
        const focusSkillIds = stackedPicks(session);

        const created = await create(session.id, validBody(session, { focusSkillIds }), player);

        expect(created.status).toBe(200);
        expect(created.body.character.focusSkillIds).toEqual(focusSkillIds);
      }));

    it('should refuse a body with none when the Snapshot states a dial', () =>
      withTestDatabase(async (database) => {
        const { player, session } = aDialledTable(database);
        // Explicitly dropped rather than merely omitted: `validBody` fills the picks a dialled
        // ruleset asks for, which is the wizard's behaviour and no longer the interesting case
        const dropped = validBody(session, { focusSkillIds: undefined });

        const refused = await create(session.id, dropped, player);

        expect(refused.status).toBe(400);
        expect(messageOf(refused.body)).toContain('3 focus skills');
      }));

    it('should refuse a fourth pick and a skill the Snapshot does not have', () =>
      withTestDatabase(async (database) => {
        const { player, session } = aDialledTable(database);
        const [one, two, three] = stackedPicks(session);
        const four = [one as string, two as string, three as string, one as string];

        const tooMany = await create(
          session.id,
          validBody(session, { focusSkillIds: four }),
          player
        );
        const phantom = await create(
          session.id,
          validBody(session, { focusSkillIds: [one as string, two as string, 'not-a-skill'] }),
          player
        );

        expect(tooMany.status).toBe(400);
        expect(messageOf(tooMany.body)).toContain('4 were named');
        expect(phantom.status).toBe(400);
        expect(messageOf(phantom.body)).toMatch(/not a skill/i);
      }));

    it('should refuse a body whose picks are not a list of ids', () =>
      withTestDatabase(async (database) => {
        const { player, session } = aDialledTable(database);
        const body = { ...validBody(session), focusSkillIds: 'arcane' } as unknown;

        const refused = await create(session.id, body as Partial<CharacterCreateRequest>, player);

        expect(refused.status).toBe(400);
        expect(messageOf(refused.body)).toContain('list of ids');
      }));

    it('should ask for none on a ruleset that states no dials', () =>
      withTestDatabase(async (database) => {
        const { player, session } = anUndialledTable(database);

        const created = await create(session.id, validBody(session), player);

        expect(created.status).toBe(200);
        // Absent stays absent: the field is not grown by a ruleset that never asked for it
        expect(created.body.character.focusSkillIds).toBeUndefined();
      }));

    it('should ask for three on the corpus, which now states both dials', () =>
      withTestDatabase(async (database) => {
        const { player, session } = aTable(database);
        const rules = rulesOf(session);
        const picks = focusPicks(rules);

        // The data pass read `chosen` 1.5 and `others` 0.3 off the workbook's Enhanced scaling
        // block, so the seed corpus is a focus ruleset where it used to be a focus-free one
        expect(picks).toHaveLength(FOCUS_SLOT_COUNT);

        const refused = await create(session.id, validBody(session, { focusSkillIds: [] }), player);
        expect(refused.status).toBe(400);
        expect(messageOf(refused.body)).toContain('3 focus skills');
      }));
  });
});

describe('reading a table’s characters', () => {
  it('should show every Member all of them, and nobody else any', () =>
    withTestDatabase(async (database) => {
      const { dm, player, session } = aTable(database);
      await create(session.id, validBody(session), player);

      expect((await listAtTable(session.id, null)).status).toBe(401);
      expect((await listAtTable(session.id, seedAccount())).status).toBe(404);

      // A game is played out loud: the DM reads the player's sheet and the player reads the party's
      expect((await listAtTable(session.id, dm)).body.characters).toHaveLength(1);
      expect((await listAtTable(session.id, player)).body.characters).toHaveLength(1);
    }));

  it('should keep a departed Member’s character in the list (v3 Req 39.3)', () =>
    withTestDatabase(async (database) => {
      const { dm, player, session } = aTable(database);
      await create(session.id, validBody(session), player);

      // What removing them does — the seat goes and the character stays. A listing that filtered
      // them would be quietly undoing GAM-04's retention rule. Arranged with the fixture rather than
      // the route since TICKET-LIVE-04: a removal is now an Event as well as a delete, and this case
      // is about a departed Member rather than about anybody being told.
      unseatMember(database, { session, account: player });

      expect((await listAtTable(session.id, dm)).body.characters).toHaveLength(1);
    }));

  it('should hand back the player state as an object, not as text', () =>
    withTestDatabase(async (database) => {
      const { player, session } = aTable(database);
      await create(session.id, validBody(session), player);

      const [listed] = (await listAtTable(session.id, player)).body.characters;

      expect(listed.character.name).toBe('Quackers');
      expect(listed.character.inventory).toEqual({ equippedItems: {}, composedItems: [] });
    }));
});

describe('the characters at no table', () => {
  /** One uploaded character, owned by an Account and built against a ruleset (TICKET-IO-04) */
  function anUploadedCharacter(database: Database, owner = seedAccount()) {
    const ruleset = seedRuleset(database, { owner });
    const row = insertUnseatedCharacter(
      {
        id: 'uploaded-1',
        rulesetId: ruleset.id,
        ownerAccountId: owner.id,
        name: 'Quackers at home',
        data: JSON.stringify({ name: 'Quackers at home' }),
        now: Date.now(),
      },
      database
    );

    return { owner, ruleset, row };
  }

  it('should be readable by their owner and by nobody else', () =>
    withTestDatabase(async (database) => {
      const { owner } = anUploadedCharacter(database);

      expect((await listMine(null)).status).toBe(401);
      expect((await listMine(seedAccount())).body.characters).toEqual([]);

      const mine = (await listMine(owner)).body.characters;

      expect(mine).toHaveLength(1);
      // *Not at a table* is the fact the surface renders, so it has to be on the wire
      expect(mine[0].sessionId).toBeNull();
      expect(mine[0].rulesetId).not.toBeNull();
    }));

  it('should leave a character that is at a table out of that list', () =>
    withTestDatabase(async (database) => {
      const { player, session } = aTable(database);
      seedCharacter(database, { session, owner: player });

      // It is reached through its table, where the answer includes the other players' — a combined
      // list would be a second way in with a second set of visibility rules
      expect((await listMine(player)).body.characters).toEqual([]);
    }));

  it('should be removable by its owner and by nobody else', () =>
    withTestDatabase(async (database) => {
      const { owner, row } = anUploadedCharacter(database);

      expect((await remove(row.id, null)).status).toBe(401);
      expect((await remove(row.id, seedAccount())).status).toBe(404);
      expect((await remove(row.id, owner)).status).toBe(204);
      expect(findCharacter(row.id, database)).toBeNull();
    }));

  it('should refuse to remove one that is at a table, and say where it lives', () =>
    withTestDatabase(async (database) => {
      const { player, session } = aTable(database);
      const seated = seedCharacter(database, { session, owner: player });

      const refused = await remove(seated.id, player);

      expect(refused.status).toBe(409);
      expect(messageOf(refused.body)).toContain('at a table');
      expect(findCharacter(seated.id, database)).not.toBeNull();
    }));

  it('should go when the ruleset it was uploaded with goes (v3 Req 40.8)', () =>
    withTestDatabase(async (database) => {
      const { ruleset } = anUploadedCharacter(database);
      const { removeRuleset } = await import('../../repositories/rulesetRepository');

      removeRuleset(ruleset.id, database);

      // The hole IO-04's review left open: before migration 0005 the only record of which ruleset
      // an uploaded character belonged to was inside its document, so nothing cascaded and the
      // rows accumulated forever, invisible to every surface
      expect(findCharacter('uploaded-1', database)).toBeNull();
    }));
});
