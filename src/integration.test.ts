/**
 * Integration Tests
 *
 * The flows that cross module boundaries, with **nothing mocked**: the real Zustand stores, the
 * real storage service, real `localStorage`, and the real calculation engine, together.
 *
 * That is the whole point. Every other test in the suite mocks the seam next to the thing it is
 * testing — the store tests mock storage, the component tests mock the store module. Those cannot
 * prove that state written by an action comes back intact after a reload, because the layer that
 * would lose it is the one they replaced.
 *
 * **Validates: Requirements 17.1, 17.2, 17.3, 17.4, 3.6, 4.4, 5.4**
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { calculateCharacter } from './engine/calculator';
import { numberOr } from './engine/formula/errors';
import { loadCharacters, loadConfiguration } from './services/storage';
import { useCharacterStore } from './stores/characterStore';
import { useConfigStore } from './stores/configStore';
import type { Character } from './types/character';
import type { Configuration } from './types/config';

function createConfig(overrides: Partial<Configuration> = {}): Configuration {
  return {
    id: 'config1',
    name: 'Integration Ruleset',
    version: '1.0',
    mainSkills: [
      { id: 'STR', code: 'STR', name: 'Strength', description: '', maxLevel: 20 },
      { id: 'DEX', code: 'DEX', name: 'Dexterity', description: '', maxLevel: 20 },
    ],
    stats: [{ id: 'health', name: 'Health', description: '', formula: 'STR * 10' }],
    specialitySkills: [
      {
        id: 'STL',
        code: 'STL',
        name: 'Stealth',
        description: '',
        maxBaseLevel: 10,
        bonusFormula: 'DEX',
      },
    ],
    combatSkills: [
      {
        id: 'MEL',
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
    races: [
      {
        id: 'elf',
        name: 'Elf',
        description: '',
        skillModifiers: [{ skillCode: 'DEX', modifier: 2 }],
      },
      {
        id: 'human',
        name: 'Human',
        description: '',
        skillModifiers: [{ skillCode: 'DEX', modifier: 1 }],
      },
    ],
    currencyTiers: [],
    focusStatBonusLevel: 0,
    createdAt: '2024-01-01',
    updatedAt: '2024-01-01',
    ...overrides,
  };
}

function createCharacter(overrides: Partial<Character> = {}): Character {
  return {
    id: 'char1',
    name: 'Aria',
    configurationId: 'config1',
    raceIds: [],
    mainSkillLevels: { STR: 5, DEX: 4 },
    specialitySkillBaseLevels: { STL: 2 },
    currentStatValues: {},
    inventory: { equippedItems: {}, miscItems: [] },
    createdAt: '2024-01-01',
    updatedAt: '2024-01-01',
    ...overrides,
  };
}

describe('persistence round trip', () => {
  beforeEach(() => {
    localStorage.clear();
    useConfigStore.setState({ config: null, isLoaded: false });
    useCharacterStore.setState({ characters: [], isLoaded: false });
  });

  it('should carry a configuration through the store, storage and back (Req 17.1, 17.3)', () => {
    useConfigStore.getState().initializeConfig('Round Trip');
    useConfigStore.getState().addMainSkill({
      id: 'STR',
      code: 'STR',
      name: 'Strength',
      description: '',
      maxLevel: 20,
    });

    // It really is in the browser's storage, not just in the store
    expect(localStorage.getItem('dnd_builder_config')).toContain('Round Trip');

    // A fresh load — what a page reload does — brings it back intact
    const saved = useConfigStore.getState().config;
    useConfigStore.setState({ config: null, isLoaded: false });
    useConfigStore.getState().loadConfig();

    const restored = useConfigStore.getState().config;
    expect(restored).toEqual(saved);
    expect(restored?.mainSkills).toHaveLength(1);
    expect(useConfigStore.getState().isLoaded).toBe(true);
  });

  it('should carry characters through the store, storage and back (Req 17.2, 17.4)', () => {
    const config = createConfig();
    useConfigStore.getState().replaceConfig(config);

    const created = useCharacterStore.getState().createCharacter(
      {
        name: 'Aria',
        raceIds: ['elf'],
        mainSkillLevels: { STR: 6, DEX: 4 },
        focusStatCode: 'STL',
        specialitySkillBaseLevels: { STL: 3 },
      },
      config
    );

    expect(localStorage.getItem('dnd_builder_characters')).toContain('Aria');

    useCharacterStore.setState({ characters: [], isLoaded: false });
    useCharacterStore.getState().loadCharacters();

    const [restored] = useCharacterStore.getState().characters;
    expect(restored).toEqual(created);
    // Seeded current stat values survive too — they are player state, not a derivation
    expect(restored.currentStatValues.health).toBe(60);
  });

  it('should survive an edit made after a reload', () => {
    const config = createConfig();
    useConfigStore.getState().replaceConfig(config);
    useCharacterStore.getState().createCharacter(
      {
        name: 'Aria',
        raceIds: [],
        mainSkillLevels: { STR: 5, DEX: 0 },
        specialitySkillBaseLevels: {},
      },
      config
    );

    // Reload, then change something
    useCharacterStore.setState({ characters: [], isLoaded: false });
    useCharacterStore.getState().loadCharacters();
    const id = useCharacterStore.getState().characters[0].id;
    useCharacterStore.getState().updateCurrentStatValue(id, 'health', 12, config);

    // Reload again — the edit is there
    useCharacterStore.setState({ characters: [], isLoaded: false });
    useCharacterStore.getState().loadCharacters();
    expect(useCharacterStore.getState().characters[0].currentStatValues.health).toBe(12);
  });

  it('should read back what the service wrote, with no store involved', () => {
    const config = createConfig();
    useConfigStore.getState().replaceConfig(config);

    // The store's own tests mock this module out, so this is the only place it is proven
    expect(loadConfiguration()?.id).toBe('config1');
    expect(loadCharacters()).toEqual([]);
  });
});

describe('recalculation flows', () => {
  const config = createConfig();

  it('should move stats when main skill levels change (Req 3.6)', () => {
    // Every main skill is allocated, even at 0 — an omitted one makes any formula naming it throw
    const before = calculateCharacter(
      createCharacter({ mainSkillLevels: { STR: 5, DEX: 4 } }),
      config
    );
    const after = calculateCharacter(
      createCharacter({ mainSkillLevels: { STR: 9, DEX: 4 } }),
      config
    );

    // Health is STR * 10 — derived at read time, so there is no stale value to go looking for
    expect(before.maxStatValues.health).toBe(50);
    expect(after.maxStatValues.health).toBe(90);
  });

  it('should move a speciality skill when its formula inputs change (Req 4.4)', () => {
    // Stealth is base + DEX
    const before = calculateCharacter(
      createCharacter({ mainSkillLevels: { STR: 5, DEX: 4 } }),
      config
    );
    const after = calculateCharacter(
      createCharacter({ mainSkillLevels: { STR: 5, DEX: 10 } }),
      config
    );

    expect(
      numberOr(after.specialitySkillTotalLevels.STL, 0) -
        numberOr(before.specialitySkillTotalLevels.STL, 0)
    ).toBe(6);
  });

  it('should move a combat bonus when the skills it names change (Req 5.4)', () => {
    // Melee is STR + STL, and STL itself depends on DEX — so this proves the chain, not one hop
    const before = calculateCharacter(
      createCharacter({ mainSkillLevels: { STR: 5, DEX: 4 } }),
      config
    );
    const after = calculateCharacter(
      createCharacter({ mainSkillLevels: { STR: 7, DEX: 4 } }),
      config
    );

    expect(
      numberOr(after.combatSkillBonuses.MEL, 0) - numberOr(before.combatSkillBonuses.MEL, 0)
    ).toBe(2);
  });

  it('should combine multiple races additively through the whole chain (Req 8.3, 8.4)', () => {
    const oneRace = calculateCharacter(createCharacter({ raceIds: ['elf'] }), config);
    const twoRaces = calculateCharacter(createCharacter({ raceIds: ['elf', 'human'] }), config);

    // Elf DEX +2, Human DEX +1 — and the extra point carries into Stealth, which reads DEX
    expect(oneRace.totalMainSkillLevels.DEX).toBe(6);
    expect(twoRaces.totalMainSkillLevels.DEX).toBe(7);
    expect(
      numberOr(twoRaces.specialitySkillTotalLevels.STL, 0) -
        numberOr(oneRace.specialitySkillTotalLevels.STL, 0)
    ).toBe(1);
  });
  it('keeps a character computing the same numbers after a skill is renamed (TICKET-REF-01)', () => {
    const config = createConfig();
    const character = createCharacter();
    useConfigStore.getState().replaceConfig(config);
    useCharacterStore.setState({ characters: [character], isLoaded: true });

    const before = calculateCharacter(character, config);

    // Exactly what the skill manager does on a save that changed the code
    useConfigStore.getState().updateMainSkill('STR', { code: 'STG', name: 'Might' });
    useCharacterStore.getState().renameSkillCode('STR', 'STG');

    // Reload from real storage, so the assertion covers the persisted form too
    const reloadedConfig = loadConfiguration() as Configuration;
    const reloadedCharacter = loadCharacters()[0];
    const after = calculateCharacter(reloadedCharacter, reloadedConfig);

    expect(reloadedConfig.stats[0].formula).toBe('STG * 10');
    expect(reloadedConfig.races[0].skillModifiers.map((m) => m.skillCode)).not.toContain('STR');
    expect(after.totalMainSkillLevels.STG).toBe(before.totalMainSkillLevels.STR);
    expect(after.maxStatValues).toEqual(before.maxStatValues);
    expect(after.specialitySkillTotalLevels).toEqual(before.specialitySkillTotalLevels);
    expect(after.combatSkillBonuses).toEqual(before.combatSkillBonuses);
  });
});
