/**
 * Character Summary Tests
 *
 * Level is read backwards out of the `xp_thresholds` curve since TICKET-RES-01, so these cover the
 * boundaries a reverse lookup actually has — exactly at a threshold, one below it, and past the
 * last row — plus the two ways a ruleset can leave a level unreadable.
 *
 * **Validates: Concept 20; Concept 06; Requirements 11.1**
 */

import { describe, expect, it } from 'vitest';
import type { Character } from '../types/character';
import type { Configuration, Curve } from '../types/config';
import {
  calculateCharacterLevel,
  experienceForLevel,
  toCharacterSummary,
} from './characterSummary';

function createCharacter(overrides: Partial<Character> = {}): Character {
  return {
    id: 'char1',
    name: 'Test Character',
    configurationId: 'config1',
    raceIds: ['elf'],
    investedStatPoints: { STR: 4, DEX: 3, CON: 2 },
    investedSkillPoints: {},
    currentResourceValues: {},
    experience: 0,
    inventory: { equippedItems: {}, composedItems: [] },
    createdAt: '2024-01-01',
    updatedAt: '2024-01-02',
    ...overrides,
  };
}

/**
 * A readable XP table: level 1 at 0 XP, 2 at 300, 3 at 900, 4 at 2700
 *
 * `reverse` means the lookup runs along the *value* axis — XP in, level out — which is why the
 * rows read as thresholds rather than as costs.
 */
function xpCurve(overrides: Partial<Curve> = {}): Curve {
  return {
    id: 'curve-xp',
    name: 'xp_thresholds',
    displayName: 'XP thresholds',
    description: '',
    keyName: 'level',
    columns: [{ id: 'curve-xp-col', name: 'xp_required' }],
    rows: [
      { key: 1, values: [0] },
      { key: 2, values: [300] },
      { key: 3, values: [900] },
      { key: 4, values: [2700] },
    ],
    interpolation: 'step',
    outOfRange: 'extrapolate',
    lookupDirection: 'reverse',
    ...overrides,
  };
}

function createConfig(curves: Curve[] = [xpCurve()]): Configuration {
  return {
    id: 'config1',
    name: 'Test Config',
    version: '1.0',
    schemaVersion: 10,
    stats: [],
    skills: [],
    materials: [],
    materialCategories: [],
    items: [],
    equipmentSlots: [],
    races: [],
    currencyTiers: [],
    curves,
    createdAt: '2024-01-01',
    updatedAt: '2024-01-01',
  };
}

describe('calculateCharacterLevel', () => {
  it('should read a fresh character at the curve’s first level', () => {
    expect(calculateCharacterLevel(createCharacter(), createConfig())).toBe(1);
  });

  it.each([
    [300, 2],
    [900, 3],
    [2700, 4],
  ])('should read exactly %i XP as level %i', (experience, level) => {
    expect(calculateCharacterLevel(createCharacter({ experience }), createConfig())).toBe(level);
  });

  it.each([
    [299, 1],
    [899, 2],
    [2699, 3],
  ])(
    'should read one XP below a threshold as the level beneath it (%i → %i)',
    (experience, level) => {
      expect(calculateCharacterLevel(createCharacter({ experience }), createConfig())).toBe(level);
    }
  );

  it('should extrapolate beyond the last row rather than refusing', () => {
    // 2700 → 4 is the last row; the seeded curve extrapolates, so more XP keeps counting
    const level = calculateCharacterLevel(createCharacter({ experience: 10_000 }), createConfig());

    expect(typeof level).toBe('number');
    expect(level as number).toBeGreaterThan(4);
  });

  it('should report an error rather than a level when the curve refuses out-of-range XP', () => {
    const config = createConfig([xpCurve({ outOfRange: 'error' })]);

    const level = calculateCharacterLevel(createCharacter({ experience: 10_000 }), config);

    expect(level).toMatchObject({ formulaError: true });
  });

  it('should report an error rather than level 1 when the ruleset has no xp_thresholds curve', () => {
    // A confident 1 here would silently misprice every budget TICKET-RES-02 derives from the level
    const level = calculateCharacterLevel(createCharacter({ experience: 900 }), createConfig([]));

    expect(level).toMatchObject({ formulaError: true });
    expect((level as { message: string }).message).toContain('xp_thresholds');
  });

  it('should ignore invested points entirely — level no longer follows spend', () => {
    // The inversion, asserted directly: v1.0 summed these to 9
    const spent = createCharacter({ investedStatPoints: { STR: 40, DEX: 30 } });
    const unspent = createCharacter({ investedStatPoints: {} });

    expect(calculateCharacterLevel(spent, createConfig())).toBe(
      calculateCharacterLevel(unspent, createConfig())
    );
  });

  it('should ignore races and equipment', () => {
    const plain = createCharacter({ raceIds: [], experience: 900 });
    const kitted = createCharacter({
      raceIds: ['elf', 'human'],
      experience: 900,
      inventory: {
        equippedItems: { main_hand: 'build-sword' },
        composedItems: [
          { id: 'build-sword', templateId: 'item-sword' },
          { id: 'build-cloak', templateId: 'item-cloak' },
        ],
      },
    });

    expect(calculateCharacterLevel(kitted, createConfig())).toBe(
      calculateCharacterLevel(plain, createConfig())
    );
  });
});

describe('toCharacterSummary', () => {
  it('should reduce a character to identity, races, level and creation date', () => {
    expect(toCharacterSummary(createCharacter({ experience: 900 }), createConfig())).toEqual({
      id: 'char1',
      name: 'Test Character',
      raceIds: ['elf'],
      level: 3,
      createdAt: '2024-01-01',
    });
  });
});

describe('experienceForLevel (TICKET-DM-01)', () => {
  it('should read the same table forwards — what a level costs', () => {
    expect(experienceForLevel(createCharacter(), createConfig(), 3)).toBe(900);
    expect(experienceForLevel(createCharacter(), createConfig(), 1)).toBe(0);
  });

  it('should round-trip: the experience it answers reads back as the level asked for', () => {
    const character = createCharacter();

    for (const level of [1, 2, 3, 4]) {
      const experience = experienceForLevel(character, createConfig(), level);

      expect(
        calculateCharacterLevel({ ...character, experience: experience as number }, createConfig())
      ).toBe(level);
    }
  });

  it('should refuse a level the curve cannot price rather than guessing at one', () => {
    // A single-row table happily extrapolates *nothing*, answering 0 XP for every level — which
    // would leave a character at level 1 with the DM told it worked
    const oneRung = createConfig([xpCurve({ rows: [{ key: 1, values: [0] }] })]);

    expect(experienceForLevel(createCharacter(), oneRung, 5)).toMatchObject({
      kind: 'out-of-range',
    });
  });

  it('should refuse when the curve refuses, carrying its own message', () => {
    const strict = createConfig([xpCurve({ outOfRange: 'error' })]);

    expect(experienceForLevel(createCharacter(), strict, 9)).toMatchObject({
      kind: 'out-of-range',
    });
  });

  it('should report a ruleset with no xp_thresholds curve the same way a level read does', () => {
    expect(experienceForLevel(createCharacter(), createConfig([]), 2)).toMatchObject({
      kind: 'undefined-variable',
    });
  });

  it('should extrapolate past the table when the curve says to, and still round-trip', () => {
    const answer = experienceForLevel(createCharacter(), createConfig(), 5);

    // `extrapolate` on a `step` curve keeps the last rung's spacing: 2700 + (2700 − 900)
    expect(answer).toBe(4500);
    expect(calculateCharacterLevel(createCharacter({ experience: 4500 }), createConfig())).toBe(5);
  });
});
