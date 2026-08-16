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
import { describeFormulaError, isFormulaError, numberOr } from './engine/formula/errors';
import { loadCharacters, loadConfiguration, saveCharacters } from './services/storage';
import { useCharacterStore } from './stores/characterStore';
import { useConfigStore } from './stores/configStore';
import type { Character } from './types/character';
import type { Configuration } from './types/config';
import type { FormulaError } from './types/formula';

function createConfig(overrides: Partial<Configuration> = {}): Configuration {
  return {
    id: 'config1',
    name: 'Integration Ruleset',
    version: '1.0',
    schemaVersion: 7,
    stats: [
      {
        id: 'STR',
        name: 'Strength',
        abbreviation: 'STR',
        description: '',
        order: 0,
        countsTowardTotal: true,
        isResource: false,
        rounding: 'none',
      },
      {
        id: 'DEX',
        name: 'Dexterity',
        abbreviation: 'DEX',
        description: '',
        order: 1,
        countsTowardTotal: true,
        isResource: false,
        rounding: 'none',
      },
      {
        id: 'health',
        name: 'Health',
        abbreviation: 'HEA',
        description: '',
        order: 0,
        countsTowardTotal: true,
        isResource: true,
        rounding: 'none',
        formula: 'STR * 10',
      },
    ],
    skills: [
      {
        id: 'STL',
        name: 'Stealth',
        description: '',
        // The weighted equivalent of v1's `DEX` formula (TICKET-SKL-02)
        statWeights: [{ statId: 'DEX', weight: 1 }],
      },
    ],
    combatSkills: [
      {
        id: 'MEL',
        code: 'MEL',
        name: 'Melee',
        description: '',
        dice: { d4: 0, d6: 1, d8: 0, d10: 0, d12: 0, d20: 0 },
        bonusFormula: 'STR + skills.stealth',
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
        statValues: { DEX: 2 },
      },
      {
        id: 'human',
        name: 'Human',
        description: '',
        statValues: { DEX: 1 },
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
    investedStatPoints: { STR: 5, DEX: 4 },
    investedSkillPoints: { STL: 2 },
    currentResourceValues: {},
    experience: 0,
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
    useConfigStore.getState().addStat({
      id: 'STR',
      name: 'Strength',
      abbreviation: 'STR',
      description: '',
      order: 0,
      countsTowardTotal: true,
      isResource: false,
      rounding: 'none',
    });

    // It really is in the browser's storage, not just in the store
    expect(localStorage.getItem('dnd_builder_config')).toContain('Round Trip');

    // A fresh load — what a page reload does — brings it back intact
    const saved = useConfigStore.getState().config;
    useConfigStore.setState({ config: null, isLoaded: false });
    useConfigStore.getState().loadConfig();

    const restored = useConfigStore.getState().config;
    expect(restored).toEqual(saved);
    expect(restored?.stats).toHaveLength(1);
    expect(useConfigStore.getState().isLoaded).toBe(true);
  });

  it('should carry characters through the store, storage and back (Req 17.2, 17.4)', () => {
    const config = createConfig();
    useConfigStore.getState().replaceConfig(config);

    const created = useCharacterStore.getState().createCharacter(
      {
        name: 'Aria',
        raceIds: ['elf'],
        investedStatPoints: { STR: 6, DEX: 4 },
        focusStatCode: 'STL',
        investedSkillPoints: { STL: 3 },
      },
      config
    );

    expect(localStorage.getItem('dnd_builder_characters')).toContain('Aria');

    useCharacterStore.setState({ characters: [], isLoaded: false });
    useCharacterStore.getState().loadCharacters();

    const [restored] = useCharacterStore.getState().characters;
    expect(restored).toEqual(created);
    // Seeded current stat values survive too — they are player state, not a derivation
    expect(restored.currentResourceValues.health).toBe(60);
  });

  it('should survive an edit made after a reload', () => {
    const config = createConfig();
    useConfigStore.getState().replaceConfig(config);
    useCharacterStore.getState().createCharacter(
      {
        name: 'Aria',
        raceIds: [],
        investedStatPoints: { STR: 5, DEX: 0 },
        investedSkillPoints: {},
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
    expect(useCharacterStore.getState().characters[0].currentResourceValues.health).toBe(12);
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
      createCharacter({ investedStatPoints: { STR: 5, DEX: 4 } }),
      config
    );
    const after = calculateCharacter(
      createCharacter({ investedStatPoints: { STR: 9, DEX: 4 } }),
      config
    );

    // Health is STR * 10 — derived at read time, so there is no stale value to go looking for
    expect(before.statValues.health).toBe(50);
    expect(after.statValues.health).toBe(90);
  });

  it('should move a speciality skill when its formula inputs change (Req 4.4)', () => {
    // Stealth is base + DEX
    const before = calculateCharacter(
      createCharacter({ investedStatPoints: { STR: 5, DEX: 4 } }),
      config
    );
    const after = calculateCharacter(
      createCharacter({ investedStatPoints: { STR: 5, DEX: 10 } }),
      config
    );

    expect(numberOr(after.skillLevels.STL, 0) - numberOr(before.skillLevels.STL, 0)).toBe(6);
  });

  it('should move a combat bonus when the skills it names change (Req 5.4)', () => {
    // Melee is STR + STL, and STL itself depends on DEX — so this proves the chain, not one hop
    const before = calculateCharacter(
      createCharacter({ investedStatPoints: { STR: 5, DEX: 4 } }),
      config
    );
    const after = calculateCharacter(
      createCharacter({ investedStatPoints: { STR: 7, DEX: 4 } }),
      config
    );

    expect(
      numberOr(after.combatSkillBonuses.MEL, 0) - numberOr(before.combatSkillBonuses.MEL, 0)
    ).toBe(2);
  });

  it('should blend two races through the whole chain rather than stacking them (Req 8.3, 8.4)', () => {
    const oneRace = calculateCharacter(createCharacter({ raceIds: ['elf'] }), config);
    const twoRaces = calculateCharacter(createCharacter({ raceIds: ['elf', 'human'] }), config);

    // Elf's DEX 2 and Human's DEX 1 average to roundup(3 / 2) = 2 — the second race pulls the
    // base toward its own value instead of adding to it (TICKET-RACE-02), so nothing downstream
    // moves either
    expect(oneRace.statValues.DEX).toBe(6); // 4 invested + elf's 2
    expect(twoRaces.statValues.DEX).toBe(6);
    expect(numberOr(twoRaces.skillLevels.STL, 0) - numberOr(oneRace.skillLevels.STL, 0)).toBe(0);

    // A race that says nothing about DEX halves what the elf alone supplied: roundup(2 / 2) = 1
    const withRaceless = calculateCharacter(createCharacter({ raceIds: ['elf', 'raceless'] }), {
      ...config,
      races: [...config.races, { id: 'raceless', name: 'Empty', description: '', statValues: {} }],
    });
    expect(withRaceless.statValues.DEX).toBe(5);
  });
  it('keeps a character computing the same numbers after a skill is renamed (TICKET-REF-01)', () => {
    const config = createConfig();
    const character = createCharacter();
    useConfigStore.getState().replaceConfig(config);
    useCharacterStore.setState({ characters: [character], isLoaded: true });
    // The character is put in storage directly: nothing on its side needs re-keying any more, so
    // no store action would otherwise write it, and this test reads both back from storage.
    saveCharacters([character]);

    const before = calculateCharacter(character, config);

    // Exactly what the stat manager does on a save that changed the abbreviation. The character
    // needs no re-keying at all now: investment is keyed by stat id (TICKET-STAT-01), so a
    // rename cannot orphan it — which is the point of storing ids everywhere.
    useConfigStore.getState().updateStat('STR', { abbreviation: 'STG', name: 'Might' });

    // Reload from real storage, so the assertion covers the persisted form too
    const reloadedConfig = loadConfiguration() as Configuration;
    const reloadedCharacter = loadCharacters()[0];
    const after = calculateCharacter(reloadedCharacter, reloadedConfig);

    expect(reloadedConfig.stats.find((candidate) => candidate.formula)?.formula).toBe('STG * 10');
    // A race's stat block holds stat ids, so a rename passes straight through it (TICKET-RACE-01)
    expect(Object.keys(reloadedConfig.races[0].statValues)).toEqual(['DEX']);
    expect(after.statValues).toEqual(before.statValues);
    expect(after.skillLevels).toEqual(before.skillLevels);
    expect(after.combatSkillBonuses).toEqual(before.combatSkillBonuses);
  });
  it('turns a force-deleted skill into error values, never silent zeros (TICKET-REF-02)', () => {
    const config = createConfig();
    const character = createCharacter();
    useConfigStore.getState().replaceConfig(config);
    useCharacterStore.setState({ characters: [character], isLoaded: true });

    // Refused while the stat formula still names it
    const blocked = useConfigStore.getState().deleteStat('STR');
    expect(blocked.map((reference) => reference.holderName)).toContain('Health');
    expect(useConfigStore.getState().config?.stats.some((stat) => stat.id === 'STR')).toBe(true);

    // Forced through, the dependent values become errors rather than zeros
    expect(useConfigStore.getState().deleteStat('STR', { force: true })).toEqual([]);

    const after = calculateCharacter(character, useConfigStore.getState().config as Configuration);
    const health = after.statValues.health;
    expect(isFormulaError(health)).toBe(true);
    expect(describeFormulaError(health as FormulaError)).toContain('Undefined variable: STR');

    // The combat skill reading STR fails the same way, and nothing threw on the way here
    expect(isFormulaError(after.combatSkillBonuses.MEL)).toBe(true);
    // Everything that did not name it still computes
    expect(numberOr(after.skillLevels.STL, -1)).toBe(6);
  });
  it('moves every dependent value when a constant is retuned (TICKET-CST-01)', () => {
    const constant = {
      id: 'id-apt',
      name: 'apt_value',
      displayName: 'APT value',
      description: 'Speed per attack',
      value: 30,
    };
    const config = createConfig({
      constants: [constant],
      stats: [
        ...createConfig().stats.filter((stat) => stat.formula === undefined),
        {
          id: 'health',
          name: 'Health',
          abbreviation: 'HEA',
          description: '',
          order: 0,
          countsTowardTotal: true,
          isResource: true,
          rounding: 'none',
          formula: 'STR * 10',
        },
        {
          id: 'apt',
          name: 'APT',
          abbreviation: 'APT',
          description: '',
          order: 0,
          countsTowardTotal: true,
          isResource: false,
          rounding: 'none',
          formula: 'max(1, round(60 / const.apt_value))',
        },
      ],
    });
    const character = createCharacter();

    expect(numberOr(calculateCharacter(character, config).statValues.apt, -1)).toBe(2);

    // Retuning the one number moves the derived value on the next read — nothing is stored
    const retuned = { ...config, constants: [{ ...constant, value: 20 }] };
    expect(numberOr(calculateCharacter(character, retuned).statValues.apt, -1)).toBe(3);

    // A stat naming no constant is untouched
    expect(calculateCharacter(character, retuned).statValues.health).toBe(50);
  });
});
