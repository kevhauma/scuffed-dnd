/**
 * What a new character is, and what makes one legal (TICKET-CHAR-04)
 *
 * **Tested directly, because two callers depend on it agreeing with itself.** The browser's store
 * and `POST /api/sessions/:id/characters` both call these, and the failure mode is not a crash — it
 * is a table where two people's sheets were priced differently. A test that only reached this
 * through a route would be testing the route.
 *
 * The interesting half is the **refusals**, and each is asserted to name the thing it refused. A
 * boolean would have been enough for the store, which had a wizard standing in front of it; a
 * server has nobody standing beside it, so the sentence is the feature.
 *
 * **Validates: v1.0 Req 11.2, 11.3; v3 Req 40.2, 40.5**
 */

import { describe, expect, it } from 'vitest';
import type { CharacterCreationData } from '../types/character';
import type { Configuration } from '../types/config';
import { buildCharacter, characterCreationErrors } from './characterCreation';
import { createFreshConfiguration } from './freshConfiguration';

/** A ruleset with the curves a budget derives through, plus whatever a case adds */
function ruleset(overrides: Partial<Configuration> = {}): Configuration {
  return { ...createFreshConfiguration('Kernel Ruleset'), ...overrides };
}

/** The Player's choices, valid against a fresh ruleset unless a case says otherwise */
function choices(overrides: Partial<CharacterCreationData> = {}): CharacterCreationData {
  return {
    name: 'Quackers',
    raceIds: [],
    investedStatPoints: {},
    investedSkillPoints: {},
    ...overrides,
  };
}

/** The identity the caller supplies — neither is invented by the module under test */
const IDENTITY = { id: 'character-1', now: '2026-01-01T00:00:00.000Z' };

describe('buildCharacter', () => {
  it('carries the Player’s choices and nothing derived', () => {
    const built = buildCharacter(choices({ investedStatPoints: { a: 1 } }), ruleset(), IDENTITY);

    expect(built).toMatchObject({
      id: 'character-1',
      name: 'Quackers',
      investedStatPoints: { a: 1 },
      // A fresh character has earned nothing, which the seeded curve reads as level 1
      experience: 0,
      inventory: { equippedItems: {}, miscItems: [] },
      createdAt: IDENTITY.now,
      updatedAt: IDENTITY.now,
    });

    // No stat values, no level, no budget: those are read from the calculator at display time
    expect(built).not.toHaveProperty('statValues');
    expect(built).not.toHaveProperty('level');
  });

  it('names the ruleset it was built against, whichever one that is', () => {
    const snapshot = ruleset({ id: 'snapshot-1' });

    // For a session character this id is the Snapshot's, which is how the sheet knows what to
    // price it by — the same field a local character uses for the browser's ruleset
    expect(buildCharacter(choices(), snapshot, IDENTITY).configurationId).toBe('snapshot-1');
  });

  it('seeds only resource stats, and only the ones that produced a number', () => {
    const config = ruleset({
      stats: [
        {
          id: 'plain',
          name: 'Plain',
          abbreviation: 'PLN',
          description: '',
          order: 0,
          countsTowardTotal: true,
          isResource: false,
          rounding: 'none',
        },
        {
          id: 'pool',
          name: 'Pool',
          abbreviation: 'POO',
          description: '',
          order: 1,
          countsTowardTotal: false,
          isResource: true,
          rounding: 'none',
          formula: '7',
        },
        {
          id: 'broken',
          name: 'Broken',
          abbreviation: 'BRK',
          description: '',
          order: 2,
          countsTowardTotal: false,
          isResource: true,
          rounding: 'none',
          formula: 'nonsense_variable',
        },
      ],
    });

    const seeded = buildCharacter(choices(), config, IDENTITY).currentResourceValues;

    expect(seeded.pool).toBe(7);
    // A stat you cannot spend has no *current* distinct from its value (TICKET-STAT-01)
    expect(seeded).not.toHaveProperty('plain');
    // …and one whose formula could not be read starts **absent** rather than at a made-up zero, so
    // the sheet can chip it where the Player can act on it
    expect(seeded).not.toHaveProperty('broken');
  });

  it('does not throw on a ruleset whose formulas cannot be evaluated at all', () => {
    // A broken ruleset must not block creation; the sheet surfaces the error where it can be fixed
    const config = ruleset({ constants: [], curves: [] });

    expect(() => buildCharacter(choices(), config, IDENTITY)).not.toThrow();
  });
});

describe('characterCreationErrors', () => {
  it('accepts a character that breaks no rule', () => {
    expect(characterCreationErrors(choices(), ruleset())).toEqual([]);
  });

  it('refuses a character with no name', () => {
    expect(characterCreationErrors(choices({ name: '   ' }), ruleset())[0]).toMatch(/name/i);
  });

  it('refuses more races than a character can blend', () => {
    const config = ruleset({
      races: [
        { id: 'a', name: 'A', description: '', statValues: {} },
        { id: 'b', name: 'B', description: '', statValues: {} },
        { id: 'c', name: 'C', description: '', statValues: {} },
      ],
    });

    expect(characterCreationErrors(choices({ raceIds: ['a', 'b', 'c'] }), config)[0]).toMatch(
      /blend/i
    );
  });

  it('accepts a raceless character, because a ruleset may define none', () => {
    // v1.0 Req 11.2 — requiring one would make such a ruleset unusable
    expect(characterCreationErrors(choices({ raceIds: [] }), ruleset())).toEqual([]);
  });

  it('refuses a race the ruleset does not have', () => {
    expect(characterCreationErrors(choices({ raceIds: ['ghost'] }), ruleset())[0]).toMatch(
      /not a race/i
    );
  });

  it('requires an archetype only when the ruleset defines any', () => {
    const withArchetypes = ruleset({
      archetypes: [{ id: 'scout', name: 'Scout', description: '', statAffinity: {} }],
    });

    expect(characterCreationErrors(choices(), withArchetypes)[0]).toMatch(/archetype/i);
    expect(characterCreationErrors(choices({ archetypeId: 'scout' }), withArchetypes)).toEqual([]);
    // …and a ruleset with none is left alone, which is TICKET-ARC-03's rule
    expect(characterCreationErrors(choices(), ruleset())).toEqual([]);
  });

  it('refuses an archetype the ruleset does not have, and one sent to a ruleset with none', () => {
    const withArchetypes = ruleset({
      archetypes: [{ id: 'scout', name: 'Scout', description: '', statAffinity: {} }],
    });

    expect(characterCreationErrors(choices({ archetypeId: 'wrong' }), withArchetypes)[0]).toMatch(
      /not an archetype/i
    );
    expect(characterCreationErrors(choices({ archetypeId: 'scout' }), ruleset())[0]).toMatch(
      /no archetypes/i
    );
  });

  it('refuses points put into a skill the ruleset does not have', () => {
    // Nothing else looks at the skill map — `skillCalculator` reads it straight into a level — so
    // an unknown id would raise the level of nothing and sit on the sheet forever
    const refusal = characterCreationErrors(
      choices({ investedSkillPoints: { 'not-a-skill': 3 } }),
      ruleset()
    );

    expect(refusal[0]).toMatch(/skill this ruleset does not have/i);
  });

  it('refuses an allocation the fresh character cannot afford, and names the numbers', () => {
    const config = ruleset({
      stats: [
        {
          id: 'might',
          name: 'Might',
          abbreviation: 'MGT',
          description: '',
          order: 0,
          countsTowardTotal: true,
          isResource: false,
          rounding: 'none',
        },
      ],
    });

    const refusal = characterCreationErrors(
      choices({ investedStatPoints: { might: 9_999 } }),
      config
    );

    // *Over budget* without the numbers is a refusal nobody can act on
    expect(refusal[0]).toMatch(/9999|cannot take those points/);
  });
});
