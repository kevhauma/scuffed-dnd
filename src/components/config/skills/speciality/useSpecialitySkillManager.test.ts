/**
 * Speciality Skill Manager Hook Tests
 *
 * Covers the save-time formula guard (Requirements 16.5, 16.6) and confirms deleting a
 * referenced skill is still blocked after the dependency check moved to the parser.
 *
 * **Validates: Requirements 3.5, 16.5, 16.6, 2.5, 2.6**
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import type { Configuration } from '../../../../types/config';

vi.mock('../../../../services/storage', () => ({
  loadConfiguration: vi.fn(() => null),
  saveConfiguration: vi.fn(),
  loadCharacters: vi.fn(() => []),
  saveCharacters: vi.fn(),
  isStorageAvailable: vi.fn(() => true),
}));

import { useConfigStore } from '../../../../stores/configStore';
import { useSpecialitySkillManager } from './useSpecialitySkillManager';

const config: Configuration = {
  id: 'config1',
  name: 'Test Config',
  version: '1.0',
  mainSkills: [
    { code: 'STR', name: 'Strength', description: '', maxLevel: 20 },
    { code: 'DEX', name: 'Dexterity', description: '', maxLevel: 20 },
  ],
  stats: [],
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
};

/** Reading `errors` inside the render subscribes to the formState proxy — see useStatManager.test.ts */
function renderManager() {
  return renderHook(() => {
    const manager = useSpecialitySkillManager();
    void manager.form.formState.errors;
    return manager;
  });
}

async function submit(
  result: { current: ReturnType<typeof useSpecialitySkillManager> },
  values: { code: string; name: string; bonusFormula: string }
) {
  await act(async () => {
    result.current.form.setValue('code', values.code);
    result.current.form.setValue('name', values.name);
    result.current.form.setValue('description', '');
    result.current.form.setValue('maxLevel', 10);
    result.current.form.setValue('bonusFormula', values.bonusFormula);
  });
  await act(async () => {
    await result.current.handleSave();
  });
}

describe('useSpecialitySkillManager', () => {
  beforeEach(() => {
    useConfigStore.setState({ config: structuredClone(config), isLoaded: true });
  });

  it('should refuse a formula that references the skill itself, naming the cycle', async () => {
    const { result } = renderManager();

    act(() => result.current.handleEdit('STL'));
    await submit(result, { code: 'STL', name: 'Stealth', bonusFormula: 'STL + 1' });

    expect(result.current.form.formState.errors.bonusFormula?.message).toBe(
      'Circular dependency detected: STL → STL'
    );
    expect(result.current.isDialogOpen).toBe(true);
    expect(useConfigStore.getState().config?.specialitySkills[0].bonusFormula).toBe('DEX / 2');
  });

  it('should refuse a formula referencing an undefined code and name the code', async () => {
    const { result } = renderManager();

    act(() => result.current.handleAdd());
    await submit(result, { code: 'ACR', name: 'Acrobatics', bonusFormula: 'WIS + 1' });

    expect(result.current.form.formState.errors.bonusFormula?.message).toContain('WIS');
    expect(useConfigStore.getState().config?.specialitySkills).toHaveLength(1);
  });

  it('should save a valid formula', async () => {
    const { result } = renderManager();

    act(() => result.current.handleAdd());
    await submit(result, { code: 'ACR', name: 'Acrobatics', bonusFormula: 'DEX + STR / 2' });

    const skills = useConfigStore.getState().config?.specialitySkills ?? [];
    expect(skills).toHaveLength(2);
    expect(skills[1]).toMatchObject({ code: 'ACR', bonusFormula: 'DEX + STR / 2' });
    expect(result.current.isDialogOpen).toBe(false);
  });

  it('should still block deleting a skill another formula references, listing the dependents', () => {
    const { result } = renderManager();

    act(() => result.current.handleDelete('STL'));

    expect(result.current.deleteWarning).toContain('Combat Skill: Melee');
    expect(useConfigStore.getState().config?.specialitySkills).toHaveLength(1);
  });

  it('should delete a skill nothing references', () => {
    useConfigStore.setState({
      config: { ...structuredClone(config), combatSkills: [] },
    });
    const { result } = renderManager();

    act(() => result.current.handleDelete('STL'));

    expect(result.current.deleteWarning).toBeNull();
    expect(useConfigStore.getState().config?.specialitySkills).toHaveLength(0);
  });
});
