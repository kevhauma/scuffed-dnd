/**
 * Character Summary Tests
 *
 * **Validates: Requirements 11.1**
 */

import { describe, expect, it } from 'vitest';
import type { Character } from '../types/character';
import { calculateCharacterLevel, toCharacterSummary } from './characterSummary';

function createCharacter(overrides: Partial<Character> = {}): Character {
  return {
    id: 'char1',
    name: 'Test Character',
    configurationId: 'config1',
    raceIds: ['elf'],
    investedStatPoints: { STR: 4, DEX: 3, CON: 2 },
    investedSkillPoints: {},
    currentResourceValues: {},
    inventory: { equippedItems: {}, miscItems: [] },
    createdAt: '2024-01-01',
    updatedAt: '2024-01-02',
    ...overrides,
  };
}

describe('calculateCharacterLevel', () => {
  it('should sum the allocated main skill levels', () => {
    expect(calculateCharacterLevel(createCharacter())).toBe(9);
  });

  it('should be zero for a character with nothing allocated', () => {
    expect(calculateCharacterLevel(createCharacter({ investedStatPoints: {} }))).toBe(0);
  });

  it('should count allocation only, ignoring races and equipment', () => {
    // Same allocation, different races and a full inventory — the level is unchanged
    const plain = createCharacter({ raceIds: [] });
    const kitted = createCharacter({
      raceIds: ['elf', 'human'],
      inventory: { equippedItems: { main_hand: 'item-sword' }, miscItems: ['item-cloak'] },
    });

    expect(calculateCharacterLevel(kitted)).toBe(calculateCharacterLevel(plain));
  });
});

describe('toCharacterSummary', () => {
  it('should reduce a character to identity, races, level and creation date', () => {
    expect(toCharacterSummary(createCharacter())).toEqual({
      id: 'char1',
      name: 'Test Character',
      raceIds: ['elf'],
      level: 9,
      createdAt: '2024-01-01',
    });
  });
});
