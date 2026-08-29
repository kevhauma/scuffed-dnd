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
import { calculateCharacter } from '../engine/calculator';
import { RACE_COUNT_NAME } from '../engine/races';
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
      inventory: { equippedItems: {}, miscItems: [], composedItems: [] },
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

  describe('the ruleset’s race count (TICKET-RACE-04)', () => {
    /** Three races to pick from, and whatever count the case wants */
    function withRaces(count?: number): Configuration {
      const constants =
        count === undefined
          ? []
          : [
              {
                id: 'const-race-count',
                name: RACE_COUNT_NAME,
                displayName: 'Races per character',
                description: '',
                value: count,
              },
            ];

      return ruleset({
        races: [
          { id: 'a', name: 'A', description: '', statValues: { str: 10 } },
          { id: 'b', name: 'B', description: '', statValues: { str: 12 } },
          { id: 'c', name: 'C', description: '', statValues: { str: 4 } },
        ],
        constants,
      });
    }

    /** What this ruleset says about a set of picks — the call every case below makes */
    function verdictOn(raceIds: string[], config: Configuration): string[] {
      const picks = choices({ raceIds });

      return characterCreationErrors(picks, config);
    }

    it('refuses more races than the ruleset asks for, naming the count', () => {
      const refusal = verdictOn(['a', 'b', 'c'], withRaces());

      expect(refusal[0]).toMatch(/blend of exactly 2 races/i);
    });

    it('refuses fewer races than the ruleset asks for, naming the same count', () => {
      // The half that used to be legal: *at most two* accepted one, and `Empty` was how a
      // single-parent character was written. Exactly two is the rule now.
      const short = verdictOn(['a'], withRaces());
      const empty = verdictOn([], withRaces());

      expect(short[0]).toMatch(/blend of exactly 2 races/i);
      expect(empty[0]).toMatch(/blend of exactly 2 races/i);
    });

    it('accepts the same race in every slot — a pure-blood, which is what replaced `Empty`', () => {
      const verdict = verdictOn(['a', 'a'], withRaces());

      expect(verdict).toEqual([]);
    });

    it('reads an absent race_count as 2, the sheet’s own answer', () => {
      const noConstant = withRaces();
      const pair = verdictOn(['a', 'b'], noConstant);
      const single = verdictOn(['a'], noConstant);

      expect(noConstant.constants).toEqual([]);
      expect(pair).toEqual([]);
      expect(single).not.toEqual([]);
    });

    it('takes the count from the ruleset at 1 and at 4', () => {
      const asksForOne = withRaces(1);
      const asksForFour = withRaces(4);

      expect(verdictOn(['a'], asksForOne)).toEqual([]);
      expect(verdictOn(['a', 'b'], asksForOne)).not.toEqual([]);

      expect(verdictOn(['a', 'b', 'c', 'a'], asksForFour)).toEqual([]);
      expect(verdictOn(['a', 'b'], asksForFour)[0]).toMatch(/exactly 4 races/i);
    });

    it('asks for none from a ruleset that defines no races', () => {
      // v1.0 Req 11.2's raceless character, which is where it lives now: a fresh ruleset starts
      // with an empty race list, and demanding two picks from it would make one unplayable
      const raceless = ruleset();

      expect(verdictOn([], raceless)).toEqual([]);
      expect(verdictOn(['ghost'], raceless)).not.toEqual([]);
    });

    it('refuses a race the ruleset does not have', () => {
      const refusal = verdictOn(['a', 'ghost'], withRaces());
      const said = refusal.join(' ');

      expect(said).toMatch(/not a race/i);
    });

    it('leaves a stored character whose count no longer matches readable, refusing only the write', () => {
      // The clean break's honest edge (overview D6): a roster written when *at most two* was the
      // rule holds one-race characters, and nothing about this ticket makes one unreadable — the
      // blend is defined for a lone block, so the sheet still prices it. What is refused is
      // *creating* another, which is what a rule about new characters ought to mean.
      const config = withRaces();
      const picks = choices({ raceIds: ['a'] });
      const stored = buildCharacter(picks, config, IDENTITY);

      expect(() => calculateCharacter(stored, config)).not.toThrow();
      expect(verdictOn(['a'], config)).not.toEqual([]);
    });
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

  describe('focus skills (TICKET-SKL-05)', () => {
    /** A ruleset that plays with focus: three skills to pick from, and both dials set */
    function focusRuleset(): Configuration {
      return ruleset({
        skills: [
          { id: 'arcane', name: 'Arcane', description: '', statWeights: [] },
          { id: 'brewing', name: 'Brewing', description: '', statWeights: [] },
        ],
        constants: [
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
      });
    }

    it('asks for all three only when the ruleset states a focus dial', () => {
      const config = focusRuleset();

      expect(characterCreationErrors(choices(), config)[0]).toMatch(/3 focus skills/);
      const three = choices({ focusSkillIds: ['arcane', 'brewing', 'arcane'] });
      expect(characterCreationErrors(three, config)).toEqual([]);

      // …and a ruleset that states neither dial multiplies everything by 1, so demanding three
      // picks would be a rule nobody could act on — `archetypeErrors`' shape and its reasoning
      const undialled = ruleset({
        skills: [{ id: 'arcane', name: 'Arcane', description: '', statWeights: [] }],
      });
      expect(characterCreationErrors(choices(), undialled)).toEqual([]);
    });

    it('takes duplicates, which is how a character specialises twice over', () => {
      const stacked = choices({ focusSkillIds: ['arcane', 'arcane', 'arcane'] });

      expect(characterCreationErrors(stacked, focusRuleset())).toEqual([]);
    });

    it('refuses a fourth pick rather than trimming it', () => {
      const four = choices({ focusSkillIds: ['arcane', 'arcane', 'arcane', 'brewing'] });

      expect(characterCreationErrors(four, focusRuleset())[0]).toMatch(/4 were named/);
    });

    it('refuses a pick naming a skill the ruleset does not have', () => {
      const phantom = choices({ focusSkillIds: ['arcane', 'nonesuch', 'brewing'] });

      expect(characterCreationErrors(phantom, focusRuleset())[0]).toMatch(/not a skill/i);
    });

    it('stores the picks it was given, and stores nothing at all for none', () => {
      const picks = ['arcane', 'brewing', 'arcane'];
      const config = focusRuleset();

      expect(buildCharacter(choices({ focusSkillIds: picks }), config, IDENTITY)).toMatchObject({
        focusSkillIds: picks,
      });
      // Absent means none, and so does empty — one spelling of *none*, not two
      expect(buildCharacter(choices({ focusSkillIds: [] }), config, IDENTITY)).not.toHaveProperty(
        'focusSkillIds'
      );
    });
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
