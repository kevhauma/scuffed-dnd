/**
 * Calculation Engine Tests
 *
 * Tests for the main calculator convenience function.
 * Individual calculator tests are in their respective files.
 */

import { describe, expect, it } from 'vitest';
import type { Character } from '../types/character';
import type { Configuration } from '../types/config';
import { calculateCharacter, calculateCharacterStats, firstCalculationError } from './calculator';
import { isFormulaError } from './formula/errors';

describe('calculateCharacterStats', () => {
  it('should calculate stats with racial bonuses applied', () => {
    const character: Character = {
      id: '1',
      name: 'Test Character',
      configurationId: 'config1',
      raceIds: ['elf'],
      mainSkillLevels: {
        STR: 10,
        DEX: 8,
        CON: 12,
      },
      specialitySkillBaseLevels: {},
      currentStatValues: {},
      inventory: { equippedItems: {}, miscItems: [] },
      createdAt: '2024-01-01',
      updatedAt: '2024-01-01',
    };

    const config: Configuration = {
      id: 'config1',
      name: 'Test Config',
      version: '1.0',
      mainSkills: [
        { id: 'STR', code: 'STR', name: 'Strength', description: '', maxLevel: 20 },
        { id: 'DEX', code: 'DEX', name: 'Dexterity', description: '', maxLevel: 20 },
        { id: 'CON', code: 'CON', name: 'Constitution', description: '', maxLevel: 20 },
      ],
      stats: [
        {
          id: 'health',
          name: 'Health',
          description: 'Hit points',
          formula: 'STR * 10 + CON * 5',
        },
        {
          id: 'evasion',
          name: 'Evasion',
          description: 'Dodge chance',
          formula: 'DEX * 2',
        },
      ],
      specialitySkills: [],
      combatSkills: [],
      materials: [],
      materialCategories: [],
      items: [],
      equipmentSlots: [],
      races: [
        {
          id: 'elf',
          name: 'Elf',
          description: 'Agile forest dwellers',
          skillModifiers: [
            { skillCode: 'DEX', modifier: 2 }, // DEX becomes 10
            { skillCode: 'STR', modifier: -1 }, // STR becomes 9
          ],
        },
      ],
      currencyTiers: [],
      focusStatBonusLevel: 0,
      createdAt: '2024-01-01',
      updatedAt: '2024-01-01',
    };

    const result = calculateCharacterStats(character, config);

    expect(result).toEqual({
      health: 150, // (10 - 1) * 10 + 12 * 5 = 9 * 10 + 60 = 90 + 60
      evasion: 20, // (8 + 2) * 2 = 10 * 2
    });
  });

  it('should calculate stats with multiple races', () => {
    const character: Character = {
      id: '1',
      name: 'Test Character',
      configurationId: 'config1',
      raceIds: ['elf', 'human'],
      mainSkillLevels: {
        STR: 10,
        DEX: 8,
      },
      specialitySkillBaseLevels: {},
      currentStatValues: {},
      inventory: { equippedItems: {}, miscItems: [] },
      createdAt: '2024-01-01',
      updatedAt: '2024-01-01',
    };

    const config: Configuration = {
      id: 'config1',
      name: 'Test Config',
      version: '1.0',
      mainSkills: [
        { id: 'STR', code: 'STR', name: 'Strength', description: '', maxLevel: 20 },
        { id: 'DEX', code: 'DEX', name: 'Dexterity', description: '', maxLevel: 20 },
      ],
      stats: [
        {
          id: 'power',
          name: 'Power',
          description: 'Physical power',
          formula: 'STR + DEX',
        },
      ],
      specialitySkills: [],
      combatSkills: [],
      materials: [],
      materialCategories: [],
      items: [],
      equipmentSlots: [],
      races: [
        {
          id: 'elf',
          name: 'Elf',
          description: 'Agile forest dwellers',
          skillModifiers: [
            { skillCode: 'DEX', modifier: 2 },
            { skillCode: 'STR', modifier: -1 },
          ],
        },
        {
          id: 'human',
          name: 'Human',
          description: 'Versatile and adaptable',
          skillModifiers: [{ skillCode: 'STR', modifier: 1 }],
        },
      ],
      currencyTiers: [],
      focusStatBonusLevel: 0,
      createdAt: '2024-01-01',
      updatedAt: '2024-01-01',
    };

    const result = calculateCharacterStats(character, config);

    expect(result).toEqual({
      power: 20, // (10 - 1 + 1) + (8 + 2) = 10 + 10
    });
  });

  it('should handle character with no races', () => {
    const character: Character = {
      id: '1',
      name: 'Test Character',
      configurationId: 'config1',
      raceIds: [],
      mainSkillLevels: {
        STR: 10,
      },
      specialitySkillBaseLevels: {},
      currentStatValues: {},
      inventory: { equippedItems: {}, miscItems: [] },
      createdAt: '2024-01-01',
      updatedAt: '2024-01-01',
    };

    const config: Configuration = {
      id: 'config1',
      name: 'Test Config',
      version: '1.0',
      mainSkills: [{ id: 'STR', code: 'STR', name: 'Strength', description: '', maxLevel: 20 }],
      stats: [
        {
          id: 'health',
          name: 'Health',
          description: 'Hit points',
          formula: 'STR * 10',
        },
      ],
      specialitySkills: [],
      combatSkills: [],
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

    const result = calculateCharacterStats(character, config);

    expect(result).toEqual({
      health: 100, // 10 * 10
    });
  });
});

/**
 * Fixture configuration for the composed entry point.
 *
 * Main skills STR/DEX/CON, stats derived from them, two speciality skills, one combat skill,
 * and three materials that each target a different kind of skill code.
 */
function createFixtureConfig(overrides: Partial<Configuration> = {}): Configuration {
  return {
    id: 'config1',
    name: 'Fixture Config',
    version: '1.0',
    mainSkills: [
      { id: 'STR', code: 'STR', name: 'Strength', description: '', maxLevel: 20 },
      { id: 'DEX', code: 'DEX', name: 'Dexterity', description: '', maxLevel: 20 },
      { id: 'CON', code: 'CON', name: 'Constitution', description: '', maxLevel: 20 },
    ],
    stats: [
      { id: 'health', name: 'Health', description: '', formula: 'STR * 10 + CON * 5' },
      { id: 'evasion', name: 'Evasion', description: '', formula: 'DEX * 2' },
    ],
    specialitySkills: [
      {
        id: 'STL',
        code: 'STL',
        name: 'Stealth',
        description: '',
        maxBaseLevel: 10,
        bonusFormula: 'DEX / 2',
      },
      {
        id: 'ARC',
        code: 'ARC',
        name: 'Arcana',
        description: '',
        maxBaseLevel: 10,
        bonusFormula: 'CON',
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
    materials: [
      {
        id: 'mat-steel',
        name: 'Steel',
        description: '',
        categoryId: 'metal',
        levels: [
          {
            level: 1,
            name: 'Steel',
            bonuses: [{ skillCode: 'STR', modifier: 2 }],
            value: { tierId: 'gold', amount: 10 },
          },
        ],
      },
      {
        id: 'mat-shadow',
        name: 'Shadowweave',
        description: '',
        categoryId: 'cloth',
        levels: [
          {
            level: 1,
            name: 'Shadowweave',
            bonuses: [{ skillCode: 'STL', modifier: 4 }],
            value: { tierId: 'gold', amount: 20 },
          },
        ],
      },
      {
        id: 'mat-keen',
        name: 'Keen Edge',
        description: '',
        categoryId: 'metal',
        levels: [
          {
            level: 1,
            name: 'Keen Edge',
            bonuses: [{ skillCode: 'MEL', modifier: 5 }],
            value: { tierId: 'gold', amount: 30 },
          },
        ],
      },
    ],
    materialCategories: [
      { id: 'metal', name: 'Metal', description: '' },
      { id: 'cloth', name: 'Cloth', description: '' },
    ],
    items: [
      {
        id: 'item-sword',
        name: 'Sword',
        description: '',
        materialId: 'mat-steel',
        materialLevel: 1,
        equipmentSlotType: 'main_hand',
      },
      {
        id: 'item-cloak',
        name: 'Cloak',
        description: '',
        materialId: 'mat-shadow',
        materialLevel: 1,
        equipmentSlotType: 'cloak',
      },
      {
        id: 'item-charm',
        name: 'Charm',
        description: '',
        materialId: 'mat-keen',
        materialLevel: 1,
        equipmentSlotType: 'trinket',
      },
    ],
    equipmentSlots: [
      { type: 'main_hand', name: 'Main Hand', description: '' },
      { type: 'cloak', name: 'Cloak', description: '' },
      { type: 'trinket', name: 'Trinket', description: '' },
    ],
    races: [
      {
        id: 'elf',
        name: 'Elf',
        description: '',
        skillModifiers: [
          { skillCode: 'DEX', modifier: 2 },
          { skillCode: 'STR', modifier: -1 },
        ],
      },
      {
        id: 'human',
        name: 'Human',
        description: '',
        skillModifiers: [{ skillCode: 'STR', modifier: 1 }],
      },
    ],
    currencyTiers: [{ id: 'gold', name: 'Gold', order: 0, conversionToNext: 10 }],
    focusStatBonusLevel: 3,
    createdAt: '2024-01-01',
    updatedAt: '2024-01-01',
    ...overrides,
  };
}

function createFixtureCharacter(overrides: Partial<Character> = {}): Character {
  return {
    id: 'char1',
    name: 'Fixture Character',
    configurationId: 'config1',
    raceIds: ['elf'],
    mainSkillLevels: { STR: 10, DEX: 8, CON: 12 },
    specialitySkillBaseLevels: { STL: 2, ARC: 1 },
    currentStatValues: { health: 40 },
    inventory: { equippedItems: {}, miscItems: [] },
    createdAt: '2024-01-01',
    updatedAt: '2024-01-01',
    ...overrides,
  };
}

describe('calculateCharacter', () => {
  it('should return a fully populated CalculatedCharacter with no empty fields', () => {
    const result = calculateCharacter(createFixtureCharacter(), createFixtureConfig());

    // Base character data is carried through
    expect(result.id).toBe('char1');
    expect(result.name).toBe('Fixture Character');
    expect(result.mainSkillLevels).toEqual({ STR: 10, DEX: 8, CON: 12 });
    expect(result.currentStatValues).toEqual({ health: 40 });

    // Every derived field is populated
    // STR 10 - 1 (elf) = 9, DEX 8 + 2 (elf) = 10, CON 12
    expect(result.totalMainSkillLevels).toEqual({ STR: 9, DEX: 10, CON: 12 });
    // health = 9 * 10 + 12 * 5, evasion = 10 * 2
    expect(result.maxStatValues).toEqual({ health: 150, evasion: 20 });
    // STL = 2 + (10 / 2), ARC = 1 + 12
    expect(result.specialitySkillTotalLevels).toEqual({ STL: 7, ARC: 13 });
    // MEL = STR 9 + STL 7
    expect(result.combatSkillBonuses).toEqual({ MEL: 16 });
    // Nothing equipped
    expect(result.equipmentBonuses).toEqual([]);
  });

  it('should apply an equipment bonus to a main skill and propagate it into stat values', () => {
    const character = createFixtureCharacter({
      inventory: { equippedItems: { main_hand: 'item-sword' }, miscItems: [] },
    });

    const result = calculateCharacter(character, createFixtureConfig());

    expect(result.equipmentBonuses).toEqual([{ skillCode: 'STR', modifier: 2 }]);
    // STR 9 + 2 from the steel sword
    expect(result.totalMainSkillLevels.STR).toBe(11);
    // health follows the raised STR: 11 * 10 + 12 * 5
    expect(result.maxStatValues.health).toBe(170);
    // and so does the combat formula: STR 11 + STL 7
    expect(result.combatSkillBonuses.MEL).toBe(18);
  });

  it('should apply an equipment bonus to a speciality skill', () => {
    const character = createFixtureCharacter({
      inventory: { equippedItems: { cloak: 'item-cloak' }, miscItems: [] },
    });

    const result = calculateCharacter(character, createFixtureConfig());

    // STL = base 2 + formula 5 + equipment 4
    expect(result.specialitySkillTotalLevels.STL).toBe(11);
    // The other speciality skill is untouched
    expect(result.specialitySkillTotalLevels.ARC).toBe(13);
    // Main skills are untouched by a speciality-targeted bonus
    expect(result.totalMainSkillLevels).toEqual({ STR: 9, DEX: 10, CON: 12 });
  });

  it('should count an equipment bonus to a combat skill exactly once', () => {
    const character = createFixtureCharacter({
      inventory: { equippedItems: { trinket: 'item-charm' }, miscItems: [] },
    });

    const result = calculateCharacter(character, createFixtureConfig());

    // MEL = STR 9 + STL 7 + equipment 5 — not 9 + 7 + 5 + 5
    expect(result.combatSkillBonuses.MEL).toBe(21);
    // The combat-targeted bonus never leaks into main or speciality skills
    expect(result.totalMainSkillLevels).toEqual({ STR: 9, DEX: 10, CON: 12 });
    expect(result.specialitySkillTotalLevels).toEqual({ STL: 7, ARC: 13 });
  });

  it('should return to the pre-equip numbers when everything is unequipped', () => {
    const config = createFixtureConfig();
    const baseline = calculateCharacter(createFixtureCharacter(), config);

    const equipped = calculateCharacter(
      createFixtureCharacter({
        inventory: {
          equippedItems: { main_hand: 'item-sword', cloak: 'item-cloak', trinket: 'item-charm' },
          miscItems: [],
        },
      }),
      config
    );
    expect(equipped.maxStatValues.health).not.toBe(baseline.maxStatValues.health);

    const unequipped = calculateCharacter(
      createFixtureCharacter({ inventory: { equippedItems: {}, miscItems: ['item-sword'] } }),
      config
    );

    expect(unequipped.totalMainSkillLevels).toEqual(baseline.totalMainSkillLevels);
    expect(unequipped.maxStatValues).toEqual(baseline.maxStatValues);
    expect(unequipped.specialitySkillTotalLevels).toEqual(baseline.specialitySkillTotalLevels);
    expect(unequipped.combatSkillBonuses).toEqual(baseline.combatSkillBonuses);
    expect(unequipped.equipmentBonuses).toEqual([]);
  });

  it('should combine racial modifiers from multiple races additively and keep them separable', () => {
    const character = createFixtureCharacter({ raceIds: ['elf', 'human'] });

    const result = calculateCharacter(character, createFixtureConfig());

    // STR 10 - 1 (elf) + 1 (human) = 10, DEX 8 + 2 (elf) = 10
    expect(result.totalMainSkillLevels).toEqual({ STR: 10, DEX: 10, CON: 12 });
    // The allocated base is still available alongside the total, so the racial part is displayable
    expect(result.mainSkillLevels).toEqual({ STR: 10, DEX: 8, CON: 12 });
    expect(result.totalMainSkillLevels.DEX - result.mainSkillLevels.DEX).toBe(2);
  });

  it('should apply the focus stat bonus to a main skill and to nothing else', () => {
    const character = createFixtureCharacter({ focusStatCode: 'STR' });

    const result = calculateCharacter(character, createFixtureConfig());

    // STR 9 + focus 3
    expect(result.totalMainSkillLevels.STR).toBe(12);
    expect(result.totalMainSkillLevels.DEX).toBe(10);
    // health follows: 12 * 10 + 12 * 5
    expect(result.maxStatValues.health).toBe(180);
    // Speciality skills do not also receive the focus bonus
    expect(result.specialitySkillTotalLevels).toEqual({ STL: 7, ARC: 13 });
  });

  it('should apply the focus stat bonus to a speciality skill and to nothing else', () => {
    const character = createFixtureCharacter({ focusStatCode: 'STL' });

    const result = calculateCharacter(character, createFixtureConfig());

    // STL = base 2 + formula 5 + focus 3
    expect(result.specialitySkillTotalLevels.STL).toBe(10);
    expect(result.specialitySkillTotalLevels.ARC).toBe(13);
    // Main skills are untouched
    expect(result.totalMainSkillLevels).toEqual({ STR: 9, DEX: 10, CON: 12 });
    expect(result.maxStatValues.health).toBe(150);
  });

  // TICKET-FORM-05: these used to assert a throw that aborted the whole calculation. The
  // contract is now an error value on the offending entry, with everything else still computed.
  it('should name the stat and the missing code when a stat formula references an undefined skill', () => {
    const config = createFixtureConfig({
      stats: [{ id: 'mana', name: 'Mana', description: '', formula: 'MAG * 5' }],
    });

    const result = calculateCharacter(createFixtureCharacter(), config);

    expect(result.maxStatValues.mana).toMatchObject({
      kind: 'undefined-variable',
      message: 'Undefined variable: MAG',
      source: { kind: 'stat', id: 'mana', name: 'Mana' },
    });
  });

  it('should name the speciality skill when its formula references an undefined skill', () => {
    const config = createFixtureConfig({
      specialitySkills: [
        {
          id: 'STL',
          code: 'STL',
          name: 'Stealth',
          description: '',
          maxBaseLevel: 10,
          bonusFormula: 'MAG',
        },
      ],
    });

    const result = calculateCharacter(createFixtureCharacter(), config);

    expect(result.specialitySkillTotalLevels.STL).toMatchObject({
      kind: 'undefined-variable',
      message: 'Undefined variable: MAG',
      source: { kind: 'speciality-skill', id: 'STL', name: 'Stealth' },
    });
  });

  it('should name the combat skill when its formula references an undefined skill', () => {
    const config = createFixtureConfig({
      combatSkills: [
        {
          id: 'MEL',
          code: 'MEL',
          name: 'Melee',
          description: '',
          dice: { d4: 0, d6: 1, d8: 0, d10: 0, d12: 0, d20: 0 },
          bonusFormula: 'STR + MAG',
        },
      ],
    });

    const result = calculateCharacter(createFixtureCharacter(), config);

    expect(result.combatSkillBonuses.MEL).toMatchObject({
      kind: 'undefined-variable',
      message: 'Undefined variable: MAG',
      source: { kind: 'combat-skill', id: 'MEL', name: 'Melee' },
    });
  });

  it('should compute every other value when one stat formula is broken (TICKET-FORM-05)', () => {
    const config = createFixtureConfig({
      stats: [
        { id: 'health', name: 'Health', description: '', formula: 'MAG * 5' }, // broken
        { id: 'evasion', name: 'Evasion', description: '', formula: 'DEX * 2' },
      ],
    });

    const result = calculateCharacter(createFixtureCharacter(), config);

    // The broken stat is the only casualty
    expect(isFormulaError(result.maxStatValues.health)).toBe(true);

    // …every other derived value is still a number
    expect(result.maxStatValues.evasion).toBe(20); // DEX 10 * 2
    expect(result.specialitySkillTotalLevels.STL).toBe(7); // base 2 + DEX 10 / 2
    expect(result.specialitySkillTotalLevels.ARC).toBe(13); // base 1 + CON 12
    expect(result.combatSkillBonuses.MEL).toBe(16); // STR 9 + STL 7
    expect(result.totalMainSkillLevels).toEqual({ STR: 9, DEX: 10, CON: 12 });
  });

  it('should chain provenance from a broken speciality skill into the combat skill reading it', () => {
    const config = createFixtureConfig({
      specialitySkills: [
        {
          id: 'STL',
          code: 'STL',
          name: 'Stealth',
          description: '',
          maxBaseLevel: 10,
          bonusFormula: 'MAG',
        },
        {
          id: 'ARC',
          code: 'ARC',
          name: 'Arcana',
          description: '',
          maxBaseLevel: 10,
          bonusFormula: 'CON',
        },
      ],
    });

    const result = calculateCharacter(createFixtureCharacter(), config);

    // MEL is `STR + STL`, and STL is broken — so MEL's error names STL as the cause
    expect(result.combatSkillBonuses.MEL).toMatchObject({
      kind: 'upstream',
      message: 'STL could not be calculated',
      source: { kind: 'combat-skill', name: 'Melee' },
      cause: {
        message: 'Undefined variable: MAG',
        source: { kind: 'speciality-skill', name: 'Stealth' },
      },
    });

    // The unrelated speciality skill and the stats are untouched
    expect(result.specialitySkillTotalLevels.ARC).toBe(13); // base 1 + CON 12
    expect(result.maxStatValues.health).toBe(150); // STR 9 * 10 + CON 12 * 5
  });

  it('should agree with calculateCharacterStats, the wrapper over the same chain', () => {
    const character = createFixtureCharacter({
      inventory: { equippedItems: { main_hand: 'item-sword' }, miscItems: [] },
    });
    const config = createFixtureConfig();

    expect(calculateCharacterStats(character, config)).toEqual(
      calculateCharacter(character, config).maxStatValues
    );
  });
});

describe('calculateCharacter over an unallocated main skill (TICKET-CALC-02)', () => {
  /**
   * The reported shape: the ruleset gains WIS and formulas that read it, while the character —
   * created before WIS existed — has no allocation for it.
   */
  const createConfigWithWisdom = (): Configuration =>
    createFixtureConfig({
      mainSkills: [
        { id: 'STR', code: 'STR', name: 'Strength', description: '', maxLevel: 20 },
        { id: 'DEX', code: 'DEX', name: 'Dexterity', description: '', maxLevel: 20 },
        { id: 'CON', code: 'CON', name: 'Constitution', description: '', maxLevel: 20 },
        { id: 'WIS', code: 'WIS', name: 'Wisdom', description: '', maxLevel: 20 }, // newly added
      ],
      stats: [{ id: 'insight', name: 'Insight', description: '', formula: 'WIS * 3' }],
      specialitySkills: [
        {
          id: 'STL',
          code: 'STL',
          name: 'Stealth',
          description: '',
          maxBaseLevel: 10,
          bonusFormula: 'WIS',
        },
      ],
      combatSkills: [
        {
          id: 'MEL',
          code: 'MEL',
          name: 'Melee',
          description: '',
          dice: { d4: 0, d6: 1, d8: 0, d10: 0, d12: 0, d20: 0 },
          bonusFormula: 'STR + WIS',
        },
      ],
    });

  it('should return numbers throughout when stat, speciality and combat formulas read it', () => {
    const result = calculateCharacter(createFixtureCharacter(), createConfigWithWisdom());

    expect(result.totalMainSkillLevels.WIS).toBe(0);
    expect(result.maxStatValues.insight).toBe(0); // WIS 0 * 3
    expect(result.specialitySkillTotalLevels.STL).toBe(2); // base 2 + WIS 0
    expect(result.combatSkillBonuses.MEL).toBe(9); // STR 9 (10 - 1 elf) + WIS 0
    expect(firstCalculationError(result)).toBeUndefined();
  });

  it('should still report a code the configuration does not define as undefined', () => {
    const config = createConfigWithWisdom();
    const result = calculateCharacter(
      createFixtureCharacter(),
      // MAG is in no namespace — unlike WIS, there is nothing to seed it from
      {
        ...config,
        stats: [...config.stats, { id: 'mana', name: 'Mana', description: '', formula: 'MAG * 5' }],
      }
    );

    expect(result.maxStatValues.insight).toBe(0);
    expect(result.maxStatValues.mana).toMatchObject({
      kind: 'undefined-variable',
      message: 'Undefined variable: MAG',
      source: { kind: 'stat', id: 'mana', name: 'Mana' },
    });
  });
});
