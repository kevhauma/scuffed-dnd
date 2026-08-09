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
      investedStatPoints: {
        STR: 10,
        DEX: 8,
        CON: 12,
      },
      specialitySkillBaseLevels: {},
      currentResourceValues: {},
      inventory: { equippedItems: {}, miscItems: [] },
      createdAt: '2024-01-01',
      updatedAt: '2024-01-01',
    };

    const config: Configuration = {
      id: 'config1',
      name: 'Test Config',
      version: '1.0',
      schemaVersion: 2,
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
          id: 'CON',
          name: 'Constitution',
          abbreviation: 'CON',
          description: '',
          order: 2,
          countsTowardTotal: true,
          isResource: false,
          rounding: 'none',
        },
        {
          id: 'health',
          name: 'Health',
          abbreviation: 'HEA',
          description: 'Hit points',
          order: 0,
          countsTowardTotal: true,
          isResource: true,
          rounding: 'none',
          formula: 'STR * 10 + CON * 5',
        },
        {
          id: 'evasion',
          name: 'Evasion',
          abbreviation: 'EVA',
          description: 'Dodge chance',
          order: 0,
          countsTowardTotal: true,
          isResource: false,
          rounding: 'none',
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
      STR: 9, // 10 - 1 (elf)
      DEX: 10, // 8 + 2 (elf)
      CON: 12,
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
      investedStatPoints: {
        STR: 10,
        DEX: 8,
      },
      specialitySkillBaseLevels: {},
      currentResourceValues: {},
      inventory: { equippedItems: {}, miscItems: [] },
      createdAt: '2024-01-01',
      updatedAt: '2024-01-01',
    };

    const config: Configuration = {
      id: 'config1',
      name: 'Test Config',
      version: '1.0',
      schemaVersion: 2,
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
          id: 'power',
          name: 'Power',
          abbreviation: 'POW',
          description: 'Physical power',
          order: 0,
          countsTowardTotal: true,
          isResource: false,
          rounding: 'none',
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
      STR: 10, // 10 - 1 (elf) + 1 (human)
      DEX: 10, // 8 + 2 (elf)
      power: 20, // (10 - 1 + 1) + (8 + 2) = 10 + 10
    });
  });

  it('should handle character with no races', () => {
    const character: Character = {
      id: '1',
      name: 'Test Character',
      configurationId: 'config1',
      raceIds: [],
      investedStatPoints: {
        STR: 10,
      },
      specialitySkillBaseLevels: {},
      currentResourceValues: {},
      inventory: { equippedItems: {}, miscItems: [] },
      createdAt: '2024-01-01',
      updatedAt: '2024-01-01',
    };

    const config: Configuration = {
      id: 'config1',
      name: 'Test Config',
      version: '1.0',
      schemaVersion: 2,
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
          id: 'health',
          name: 'Health',
          abbreviation: 'HEA',
          description: 'Hit points',
          order: 0,
          countsTowardTotal: true,
          isResource: true,
          rounding: 'none',
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
      STR: 10,
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
    schemaVersion: 2,
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
        id: 'CON',
        name: 'Constitution',
        abbreviation: 'CON',
        description: '',
        order: 2,
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
        formula: 'STR * 10 + CON * 5',
      },
      {
        id: 'evasion',
        name: 'Evasion',
        abbreviation: 'EVA',
        description: '',
        order: 0,
        countsTowardTotal: true,
        isResource: false,
        rounding: 'none',
        formula: 'DEX * 2',
      },
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
    investedStatPoints: { STR: 10, DEX: 8, CON: 12 },
    specialitySkillBaseLevels: { STL: 2, ARC: 1 },
    currentResourceValues: { health: 40 },
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
    expect(result.investedStatPoints).toEqual({ STR: 10, DEX: 8, CON: 12 });
    expect(result.currentResourceValues).toEqual({ health: 40 });

    // Every derived field is populated
    // STR 10 - 1 (elf) = 9, DEX 8 + 2 (elf) = 10, CON 12
    expect(result.statValues).toEqual({ STR: 9, DEX: 10, CON: 12, health: 150, evasion: 20 });
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
    expect(result.statValues.STR).toBe(11);
    // health follows the raised STR: 11 * 10 + 12 * 5
    expect(result.statValues.health).toBe(170);
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
    expect(result.statValues).toEqual({ STR: 9, DEX: 10, CON: 12, health: 150, evasion: 20 });
  });

  it('should count an equipment bonus to a combat skill exactly once', () => {
    const character = createFixtureCharacter({
      inventory: { equippedItems: { trinket: 'item-charm' }, miscItems: [] },
    });

    const result = calculateCharacter(character, createFixtureConfig());

    // MEL = STR 9 + STL 7 + equipment 5 — not 9 + 7 + 5 + 5
    expect(result.combatSkillBonuses.MEL).toBe(21);
    // The combat-targeted bonus never leaks into main or speciality skills
    expect(result.statValues).toEqual({ STR: 9, DEX: 10, CON: 12, health: 150, evasion: 20 });
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
    expect(equipped.statValues.health).not.toBe(baseline.statValues.health);

    const unequipped = calculateCharacter(
      createFixtureCharacter({ inventory: { equippedItems: {}, miscItems: ['item-sword'] } }),
      config
    );

    expect(unequipped.statValues).toEqual(baseline.statValues);
    expect(unequipped.statValues).toEqual(baseline.statValues);
    expect(unequipped.specialitySkillTotalLevels).toEqual(baseline.specialitySkillTotalLevels);
    expect(unequipped.combatSkillBonuses).toEqual(baseline.combatSkillBonuses);
    expect(unequipped.equipmentBonuses).toEqual([]);
  });

  it('should combine racial modifiers from multiple races additively and keep them separable', () => {
    const character = createFixtureCharacter({ raceIds: ['elf', 'human'] });

    const result = calculateCharacter(character, createFixtureConfig());

    // STR 10 - 1 (elf) + 1 (human) = 10, DEX 8 + 2 (elf) = 10
    expect(result.statValues).toEqual({ STR: 10, DEX: 10, CON: 12, health: 160, evasion: 20 });
    // The allocated base is still available alongside the total, so the racial part is displayable
    expect(result.investedStatPoints).toEqual({ STR: 10, DEX: 8, CON: 12 });
    expect(Number(result.statValues.DEX) - result.investedStatPoints.DEX).toBe(2);
  });

  it('should apply the focus stat bonus to a main skill and to nothing else', () => {
    const character = createFixtureCharacter({ focusStatCode: 'STR' });

    const result = calculateCharacter(character, createFixtureConfig());

    // STR 9 + focus 3
    expect(result.statValues.STR).toBe(12);
    expect(result.statValues.DEX).toBe(10);
    // health follows: 12 * 10 + 12 * 5
    expect(result.statValues.health).toBe(180);
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
    expect(result.statValues).toEqual({ STR: 9, DEX: 10, CON: 12, health: 150, evasion: 20 });
    expect(result.statValues.health).toBe(150);
  });

  // TICKET-FORM-05: these used to assert a throw that aborted the whole calculation. The
  // contract is now an error value on the offending entry, with everything else still computed.
  it('should name the stat and the missing code when a stat formula references an undefined skill', () => {
    const config = createFixtureConfig({
      stats: [
        {
          id: 'mana',
          name: 'Mana',
          abbreviation: 'MAN',
          description: '',
          order: 0,
          countsTowardTotal: true,
          isResource: false,
          rounding: 'none',
          formula: 'MAG * 5',
        },
      ],
    });

    const result = calculateCharacter(createFixtureCharacter(), config);

    expect(result.statValues.mana).toMatchObject({
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
          id: 'CON',
          name: 'Constitution',
          abbreviation: 'CON',
          description: '',
          order: 2,
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
          formula: 'MAG * 5',
        }, // broken
        {
          id: 'evasion',
          name: 'Evasion',
          abbreviation: 'EVA',
          description: '',
          order: 0,
          countsTowardTotal: true,
          isResource: false,
          rounding: 'none',
          formula: 'DEX * 2',
        },
      ],
    });

    const result = calculateCharacter(createFixtureCharacter(), config);

    // The broken stat is the only casualty
    expect(isFormulaError(result.statValues.health)).toBe(true);

    // …every other derived value is still a number
    expect(result.statValues.evasion).toBe(20); // DEX 10 * 2
    expect(result.specialitySkillTotalLevels.STL).toBe(7); // base 2 + DEX 10 / 2
    expect(result.specialitySkillTotalLevels.ARC).toBe(13); // base 1 + CON 12
    expect(result.combatSkillBonuses.MEL).toBe(16); // STR 9 + STL 7
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
    expect(result.statValues.health).toBe(150); // STR 9 * 10 + CON 12 * 5
  });

  it('should agree with calculateCharacterStats, the wrapper over the same chain', () => {
    const character = createFixtureCharacter({
      inventory: { equippedItems: { main_hand: 'item-sword' }, miscItems: [] },
    });
    const config = createFixtureConfig();

    expect(calculateCharacterStats(character, config)).toEqual(
      calculateCharacter(character, config).statValues
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
          id: 'CON',
          name: 'Constitution',
          abbreviation: 'CON',
          description: '',
          order: 2,
          countsTowardTotal: true,
          isResource: false,
          rounding: 'none',
        },
        {
          id: 'WIS',
          name: 'Wisdom',
          abbreviation: 'WIS',
          description: '',
          order: 3,
          countsTowardTotal: true,
          isResource: false,
          rounding: 'none',
        },
        {
          id: 'insight',
          name: 'Insight',
          abbreviation: 'INS',
          description: '',
          order: 0,
          countsTowardTotal: true,
          isResource: false,
          rounding: 'none',
          formula: 'WIS * 3',
        },
      ],
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

    expect(result.statValues.WIS).toBe(0);
    expect(result.statValues.insight).toBe(0); // WIS 0 * 3
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
        stats: [
          ...config.stats,
          {
            id: 'mana',
            name: 'Mana',
            abbreviation: 'MAN',
            description: '',
            order: 0,
            countsTowardTotal: true,
            isResource: false,
            rounding: 'none',
            formula: 'MAG * 5',
          },
        ],
      }
    );

    expect(result.statValues.insight).toBe(0);
    expect(result.statValues.mana).toMatchObject({
      kind: 'undefined-variable',
      message: 'Undefined variable: MAG',
      source: { kind: 'stat', id: 'mana', name: 'Mana' },
    });
  });
});

/**
 * The abbreviation bridge — scaffolding, not a design
 *
 * A speciality skill's `bonusFormula` and a combat skill's are still written in the **flat**
 * variable space, so `(STR + DEX) / 2` reaches stats by their `abbreviation`. That space is a
 * carry-across from v1, where `MainSkill` was the invested atom; TICKET-STAT-01 kept it pointed at
 * stat abbreviations rather than redesigning both skill kinds in the same change.
 *
 * It is temporary, and these tests exist to fail loudly when it is removed:
 *
 * - **TICKET-SKL-02** replaces `SpecialitySkill` with the weighted Skill entity, which names its
 *   stats through `stats.*` rather than through the flat space;
 * - **TICKET-ROLL-06** replaces `CombatSkill` with roll definitions, which do the same.
 *
 * When either lands, delete the half of this block it retires — do not "fix" it by re-adding the
 * flat spelling. When both have landed, the whole block goes, and with it `statVariables`.
 */
describe('the flat abbreviation bridge (retired by TICKET-SKL-02 and TICKET-ROLL-06)', () => {
  it('should let a speciality formula reach a stat by its abbreviation', () => {
    // TICKET-SKL-02 retires this: the Skill entity weights `stats.*` instead
    const result = calculateCharacter(createFixtureCharacter(), createFixtureConfig());

    // STL is `base 2 + DEX / 2`, and DEX composes to 10
    expect(result.specialitySkillTotalLevels.STL).toBe(7);
  });

  it('should let a combat formula reach a stat by its abbreviation', () => {
    // TICKET-ROLL-06 retires this: a roll definition names `stats.*` instead
    const result = calculateCharacter(createFixtureCharacter(), createFixtureConfig());

    // MEL is `STR + STL`, and STR composes to 9
    expect(result.combatSkillBonuses.MEL).toBe(16);
  });

  it('should lose the reference when the abbreviation is renamed without the formula', () => {
    // The bridge is spelled, not stored: `statVariables` rebuilds it from the current
    // abbreviations at calculation time. So renaming a stat and leaving the old spelling in a
    // formula is an undefined variable rather than a stale number — which is exactly why
    // TICKET-REF-01 rewrites the formulas on rename, and why moving both skill kinds onto
    // `stats.*` removes the class of problem rather than managing it.
    const config = createFixtureConfig();
    const renamed: Configuration = {
      ...config,
      stats: config.stats.map((stat) =>
        stat.id === 'DEX' ? { ...stat, abbreviation: 'AGI' } : stat
      ),
    };

    const stale = calculateCharacter(createFixtureCharacter(), renamed);

    expect(stale.specialitySkillTotalLevels.STL).toMatchObject({
      kind: 'undefined-variable',
      message: 'Undefined variable: DEX',
    });
  });
});
