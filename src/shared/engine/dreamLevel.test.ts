/**
 * Absent means 1, and the reader is what says so (TICKET-RES-04)
 *
 * The criterion this file exists for: *a character with no `dreamLevel` reads 1 everywhere it is
 * consumed*. That is a claim about a **reader** rather than about stored data — nothing backfills a
 * roster — so the way to pin it is to ask the one function every consumer goes through, with a
 * character that has never had the field.
 *
 * **Validates: v4 systems/02 gap 2**
 */

import { describe, expect, it } from 'vitest';
import type { Character } from '../types/character';
import { DEFAULT_DREAM_LEVEL, dreamLevelOf } from './dreamLevel';

function aCharacter(overrides: Partial<Character> = {}): Character {
  return {
    id: 'character-1',
    name: 'Quackers',
    configurationId: 'config-1',
    raceIds: [],
    investedStatPoints: {},
    investedSkillPoints: {},
    currentResourceValues: {},
    experience: 0,
    inventory: { equippedItems: {}, miscItems: [] },
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('reading a dream level', () => {
  it('reads 1 for a character that has never had one, without the field appearing', () => {
    const untouched = aCharacter();

    expect(dreamLevelOf(untouched)).toBe(1);
    expect(DEFAULT_DREAM_LEVEL).toBe(1);
    // The default is the reader's, not a backfill: nothing was written to say so
    expect(Object.keys(untouched)).not.toContain('dreamLevel');
  });

  it('reads the stored level once there is one', () => {
    const dreaming = aCharacter({ dreamLevel: 4 });

    expect(dreamLevelOf(dreaming)).toBe(4);
  });

  it('falls back rather than returning a number no gain formula could multiply by', () => {
    // Neither is reachable through the setter; both are reachable through a hand-edited document,
    // and `NaN × table` would silently blank every main-affinity gain that reads this
    const missing = aCharacter({ dreamLevel: undefined });
    const broken = aCharacter({ dreamLevel: Number.NaN });
    const absent = aCharacter({ dreamLevel: null as unknown as number });

    expect(dreamLevelOf(missing)).toBe(DEFAULT_DREAM_LEVEL);
    expect(dreamLevelOf(broken)).toBe(DEFAULT_DREAM_LEVEL);
    expect(dreamLevelOf(absent)).toBe(DEFAULT_DREAM_LEVEL);
  });
});
