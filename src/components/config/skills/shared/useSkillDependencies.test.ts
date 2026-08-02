/**
 * Skill Dependencies Hook Tests
 *
 * References are parser-derived, so a code counts only when a formula genuinely refers to it —
 * not when it merely appears inside a longer token.
 *
 * **Validates: Requirements 2.5, 2.6**
 */

import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Configuration } from '../../../../types/config';

vi.mock('../../../../services/storage', () => ({
  loadConfiguration: vi.fn(() => null),
  saveConfiguration: vi.fn(),
  loadCharacters: vi.fn(() => []),
  saveCharacters: vi.fn(),
  isStorageAvailable: vi.fn(() => true),
}));

import { useConfigStore } from '../../../../stores/configStore';
import { useSkillDependencies } from './useSkillDependencies';

function createConfig(overrides: Partial<Configuration> = {}): Configuration {
  return {
    id: 'config1',
    name: 'Test Config',
    version: '1.0',
    mainSkills: [
      { code: 'STR', name: 'Strength', description: '', maxLevel: 20 },
      { code: 'DEX', name: 'Dexterity', description: '', maxLevel: 20 },
    ],
    stats: [{ id: 'health', name: 'Health', description: '', formula: 'STR * 10' }],
    specialitySkills: [
      { code: 'STL', name: 'Stealth', description: '', maxBaseLevel: 10, bonusFormula: 'DEX / 2' },
    ],
    combatSkills: [
      {
        code: 'MEL',
        name: 'Melee',
        description: '',
        dice: { d4: 0, d6: 1, d8: 0, d10: 0, d12: 0, d20: 0 },
        bonusFormula: 'STR + STL',
      },
    ],
    materials: [],
    materialCategories: [],
    items: [],
    equipmentSlots: [],
    races: [],
    currencyTiers: [],
    focusStatBonusLevel: 0,
    createdAt: '2024-01-01',
    updatedAt: '2024-01-01',
    ...overrides,
  };
}

describe('useSkillDependencies', () => {
  beforeEach(() => {
    useConfigStore.setState({ config: createConfig(), isLoaded: true });
  });

  it('should list every formula that references the skill', () => {
    const { result } = renderHook(() => useSkillDependencies());

    expect(result.current.checkDependencies('STR')).toEqual([
      'Stat: Health',
      'Combat Skill: Melee',
    ]);
    expect(result.current.checkDependencies('STL')).toEqual(['Combat Skill: Melee']);
  });

  it('should report nothing for a skill no formula references', () => {
    const { result } = renderHook(() => useSkillDependencies());

    expect(result.current.checkDependencies('DEX')).toEqual(['Speciality Skill: Stealth']);
    expect(result.current.checkDependencies('WIS')).toEqual([]);
  });

  it('should not false-match a code that only appears inside a longer token', () => {
    // "STRIKE" contains "STR"; the old substring scan reported Health as a dependent of STR
    // even when the formula never referenced STR itself.
    useConfigStore.setState({
      config: createConfig({
        stats: [{ id: 'health', name: 'Health', description: '', formula: 'STRIKE * 2' }],
        combatSkills: [],
        specialitySkills: [],
      }),
    });

    const { result } = renderHook(() => useSkillDependencies());

    expect(result.current.checkDependencies('STR')).toEqual([]);
    expect(result.current.checkDependencies('STRIKE')).toEqual(['Stat: Health']);
  });

  it('should return nothing when no configuration is loaded', () => {
    useConfigStore.setState({ config: null, isLoaded: true });

    const { result } = renderHook(() => useSkillDependencies());

    expect(result.current.checkDependencies('STR')).toEqual([]);
  });
});
