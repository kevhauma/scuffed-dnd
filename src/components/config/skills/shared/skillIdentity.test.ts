/**
 * Shared Skill Identity Tests
 *
 * **Validates: Concept 00 §6 (TICKET-REF-01)**
 */

import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { useCharacterStore } from '../../../../stores/characterStore';
import { resolveSkillId, useSkillCodeRename } from './skillIdentity';

const skills = [
  { id: 'id-str', code: 'STR' },
  { id: 'id-dex', code: 'DEX' },
];

describe('resolveSkillId', () => {
  it('keeps the id of the skill being edited', () => {
    expect(resolveSkillId(skills, 'DEX')).toBe('id-dex');
  });

  it('mints an id when adding', () => {
    const id = resolveSkillId(skills, null);

    expect(id).not.toBe('id-str');
    expect(id).not.toBe('id-dex');
    expect(id).toBeTruthy();
  });

  it('mints an id when the edited code names no skill', () => {
    expect(resolveSkillId(skills, 'GONE')).toBeTruthy();
    expect(resolveSkillId(skills, 'GONE')).not.toBe('id-str');
  });
});

describe('useSkillCodeRename', () => {
  beforeEach(() => {
    useCharacterStore.setState({
      characters: [
        {
          id: 'char1',
          name: 'Test',
          configurationId: 'config1',
          raceIds: [],
          investedStatPoints: { STR: 6 },
          investedSkillPoints: { STL: 3 },
          currentResourceValues: {},
          inventory: { equippedItems: {}, miscItems: [] },
          createdAt: '2024-01-01',
          updatedAt: '2024-01-01',
        },
      ],
      isLoaded: true,
    });
  });

  it('re-keys speciality base levels when the code changed', () => {
    const { result } = renderHook(() => useSkillCodeRename());

    result.current('STL', 'SNK');

    expect(useCharacterStore.getState().characters[0].investedSkillPoints).toEqual({
      SNK: 3,
    });
  });

  it('leaves stat investment alone — it is keyed by id, so a rename cannot orphan it', () => {
    // TICKET-STAT-01: only the two code-keyed maps still need re-keying
    const { result } = renderHook(() => useSkillCodeRename());

    result.current('STR', 'STG');

    expect(useCharacterStore.getState().characters[0].investedStatPoints).toEqual({ STR: 6 });
  });

  it('does nothing for an add or an edit that kept the code', () => {
    const { result } = renderHook(() => useSkillCodeRename());

    result.current(null, 'SNK');
    result.current('STL', 'STL');

    expect(useCharacterStore.getState().characters[0].investedSkillPoints).toEqual({
      STL: 3,
    });
  });
});
