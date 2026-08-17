/**
 * Calculation Engine Tests
 *
 * Tests for the main calculator convenience function.
 * Individual calculator tests are in their respective files.
 */

import { describe, expect, it } from 'vitest';
import type { Character } from '../types/character';
import type { Archetype, Configuration, Curve } from '../types/config';
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
      investedSkillPoints: {},
      currentResourceValues: {},
      experience: 0,
      inventory: { equippedItems: {}, miscItems: [] },
      createdAt: '2024-01-01',
      updatedAt: '2024-01-01',
    };

    const config: Configuration = {
      id: 'config1',
      name: 'Test Config',
      version: '1.0',
      schemaVersion: 8,
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
      skills: [],
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
          statValues: { DEX: 2, STR: -1 },
        },
      ],
      currencyTiers: [],
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

  it('should blend the bases of two races into the composition (TICKET-RACE-02)', () => {
    const character: Character = {
      id: '1',
      name: 'Test Character',
      configurationId: 'config1',
      raceIds: ['elf', 'human'],
      investedStatPoints: {
        STR: 10,
        DEX: 8,
      },
      investedSkillPoints: {},
      currentResourceValues: {},
      experience: 0,
      inventory: { equippedItems: {}, miscItems: [] },
      createdAt: '2024-01-01',
      updatedAt: '2024-01-01',
    };

    const config: Configuration = {
      id: 'config1',
      name: 'Test Config',
      version: '1.0',
      schemaVersion: 8,
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
      skills: [],
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
          statValues: { DEX: 2, STR: -1 },
        },
        {
          id: 'human',
          name: 'Human',
          description: 'Versatile and adaptable',
          statValues: { STR: 1 },
        },
      ],
      currencyTiers: [],
      createdAt: '2024-01-01',
      updatedAt: '2024-01-01',
    };

    const result = calculateCharacterStats(character, config);

    // The bases are the round-up average of the two blocks, not their sum: a human's Strength of 1
    // pulls an elf's -1 to 0 rather than cancelling it, and the DEX the human block says nothing
    // about is a real 0 in the average
    expect(result).toEqual({
      STR: 10, // 10 invested + roundup((-1 + 1) / 2) = 10 + 0
      DEX: 9, // 8 invested + roundup((2 + 0) / 2) = 8 + 1
      power: 19, // 10 + 9
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
      investedSkillPoints: {},
      currentResourceValues: {},
      experience: 0,
      inventory: { equippedItems: {}, miscItems: [] },
      createdAt: '2024-01-01',
      updatedAt: '2024-01-01',
    };

    const config: Configuration = {
      id: 'config1',
      name: 'Test Config',
      version: '1.0',
      schemaVersion: 8,
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
      skills: [],
      combatSkills: [],
      materials: [],
      materialCategories: [],
      items: [],
      equipmentSlots: [],
      races: [],
      currencyTiers: [],
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
    schemaVersion: 8,
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
    skills: [
      {
        id: 'STL',
        name: 'Stealth',
        description: '',
        // The weighted equivalents of v1's `DEX / 2` and `CON` formulas (TICKET-SKL-02)
        statWeights: [{ statId: 'DEX', weight: 0.5 }],
      },
      {
        id: 'ARC',
        name: 'Arcana',
        description: '',
        statWeights: [{ statId: 'CON', weight: 1 }],
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
            bonuses: [{ statId: 'STR', modifier: 2 }],
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
            bonuses: [{ statId: 'DEX', modifier: 4 }],
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
            bonuses: [{ statId: 'CON', modifier: 5 }],
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
        statValues: { DEX: 2, STR: -1 },
      },
      {
        id: 'human',
        name: 'Human',
        description: '',
        statValues: { STR: 1 },
      },
    ],
    currencyTiers: [{ id: 'gold', name: 'Gold', order: 0, conversionToNext: 10 }],
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
    investedSkillPoints: { STL: 2, ARC: 1 },
    currentResourceValues: { health: 40 },
    experience: 0,
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
    expect(result.skillLevels).toEqual({ STL: 7, ARC: 13 });
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

    expect(result.equipmentBonuses).toEqual([{ statId: 'STR', modifier: 2 }]);
    // STR 9 + 2 from the steel sword
    expect(result.statValues.STR).toBe(11);
    // health follows the raised STR: 11 * 10 + 12 * 5
    expect(result.statValues.health).toBe(170);
    // and so does the combat formula: STR 11 + STL 7
    expect(result.combatSkillBonuses.MEL).toBe(18);
  });

  it('should reach a speciality skill only through the stat its formula reads (TICKET-MAT-01)', () => {
    // The cloak's material used to name `STL` directly. A tier modifier targets a **stat** now
    // (Concept 09), so it raises DEX and the speciality skill follows because its formula reads
    // DEX — one route instead of two, and the one the sheet actually has.
    const character = createFixtureCharacter({
      inventory: { equippedItems: { cloak: 'item-cloak' }, miscItems: [] },
    });

    const result = calculateCharacter(character, createFixtureConfig());

    expect(result.equipmentBonuses).toEqual([{ statId: 'DEX', modifier: 4 }]);
    expect(result.statValues.DEX).toBe(14); // 8 invested + 2 elf + 4 equipment
    expect(result.statValues.evasion).toBe(28); // DEX * 2 follows
    expect(result.skillLevels.STL).toBe(9); // base 2 + DEX 14 / 2
    // The speciality skill that reads a different stat is untouched
    expect(result.skillLevels.ARC).toBe(13);
  });

  it('should count a stat-targeted bonus exactly once across every consumer', () => {
    const character = createFixtureCharacter({
      inventory: { equippedItems: { trinket: 'item-charm' }, miscItems: [] },
    });

    const result = calculateCharacter(character, createFixtureConfig());

    // The charm gives CON +5 once, and each consumer reads the raised stat rather than adding the
    // bonus again on its own account (Requirement 13.2)
    expect(result.statValues.CON).toBe(17);
    expect(result.statValues.health).toBe(175); // STR 9 * 10 + CON 17 * 5
    expect(result.skillLevels.ARC).toBe(18); // base 1 + CON 17
    // Nothing reaches a combat skill's own code any more — a material cannot name one
    expect(result.combatSkillBonuses.MEL).toBe(16); // STR 9 + STL 7, unchanged
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
    expect(unequipped.skillLevels).toEqual(baseline.skillLevels);
    expect(unequipped.combatSkillBonuses).toEqual(baseline.combatSkillBonuses);
    expect(unequipped.equipmentBonuses).toEqual([]);
  });

  it('should blend two races into the base and keep the terms separable (TICKET-RACE-02)', () => {
    const character = createFixtureCharacter({ raceIds: ['elf', 'human'] });

    const result = calculateCharacter(character, createFixtureConfig());

    // elf is { DEX 2, STR -1 }, human is { STR 1 } — the base is their round-up average, so
    // STR = roundup((-1 + 1) / 2) = 0 and DEX = roundup((2 + 0) / 2) = 1
    expect(result.statValues).toEqual({ STR: 10, DEX: 9, CON: 12, health: 160, evasion: 18 });
    // The allocated points are still available alongside the total, so the racial part is
    // displayable rather than having to be recovered from a difference
    expect(result.investedStatPoints).toEqual({ STR: 10, DEX: 8, CON: 12 });
    expect(Number(result.statValues.DEX) - result.investedStatPoints.DEX).toBe(1);
  });

  it('should sum the blended base, the invested points and equipment per stat', () => {
    // The whole composition through the composed entry point (TICKET-RACE-02 acceptance criterion)
    const character = createFixtureCharacter({
      raceIds: ['elf', 'human'],
      inventory: { equippedItems: { main_hand: 'item-sword' }, miscItems: [] },
    });

    const result = calculateCharacter(character, createFixtureConfig());
    const sword = result.equipmentBonuses.find((bonus) => bonus.statId === 'STR');

    expect(sword).toBeDefined();
    // base 0 (blended) + 10 invested + the sword's STR bonus
    expect(result.statValues.STR).toBe(10 + (sword?.modifier ?? 0));
  });

  it('should raise a resource maximum by the tier that grants it — the +50 Mana case', () => {
    // Concept 09's fur tier, which is the thing v1's shape could not say at all: a modifier on a
    // *resource*. The maximum moves; what the Player currently has does not (TICKET-MAT-02).
    const config = createFixtureConfig({
      stats: [
        ...createFixtureConfig().stats,
        {
          id: 'mana',
          name: 'Mana',
          abbreviation: 'MANA',
          description: '',
          order: 5,
          countsTowardTotal: false,
          isResource: true,
          rounding: 'none',
        },
      ],
      materials: [
        ...createFixtureConfig().materials,
        {
          id: 'mat-fur',
          name: 'Fur',
          description: '',
          categoryId: 'cloth',
          levels: [
            {
              level: 1,
              name: 'Fur 1',
              bonuses: [{ statId: 'mana', modifier: 50 }],
              value: { tierId: 'gold', amount: 1 },
            },
          ],
        },
      ],
      items: [
        ...createFixtureConfig().items,
        {
          id: 'item-fur-cloak',
          name: 'Fur Cloak',
          description: '',
          materialId: 'mat-fur',
          materialLevel: 1,
          equipmentSlotType: 'cloak',
        },
      ],
    });

    const unarmoured = createFixtureCharacter({
      investedStatPoints: { STR: 10, DEX: 8, CON: 12, mana: 10 },
      currentResourceValues: { health: 40, mana: 10 },
    });
    const equipped = {
      ...unarmoured,
      inventory: { equippedItems: { cloak: 'item-fur-cloak' }, miscItems: [] },
    };

    expect(calculateCharacter(unarmoured, config).statValues.mana).toBe(10);
    expect(calculateCharacter(equipped, config).statValues.mana).toBe(60);
    // Stored player state is untouched — the maximum is derived, the current value is not
    expect(equipped.currentResourceValues.mana).toBe(10);
  });

  it('should revert on the next read when the item comes off, with nothing recalculated', () => {
    // v1.0's property, preserved: equipping is a change to stored *inventory*, and every derived
    // number is computed at read time, so unequipping needs no recalculation call at all
    const config = createFixtureConfig();
    const bare = createFixtureCharacter();
    const equipped = {
      ...bare,
      inventory: { equippedItems: { main_hand: 'item-sword' }, miscItems: [] },
    };

    const before = calculateCharacter(bare, config);
    const during = calculateCharacter(equipped, config);
    const after = calculateCharacter({ ...equipped, inventory: bare.inventory }, config);

    expect(during.statValues.STR).not.toBe(before.statValues.STR);
    expect(after.statValues).toEqual(before.statValues);
    expect(after.equipmentBonuses).toEqual([]);
  });

  it('should apply no flat specialisation bonus to any stat (TICKET-ARC-03)', () => {
    // The focus stat is gone: it was a flat adder on one stat, which the spec does not recognise,
    // and an archetype shapes the whole sheet through the invested term instead. A stat is now
    // exactly `race base + what the points bought + equipment` — three terms, never four.
    const result = calculateCharacter(createFixtureCharacter(), createFixtureConfig());

    expect(result.statValues).toEqual({ STR: 9, DEX: 10, CON: 12, health: 150, evasion: 20 });
    expect(result.skillLevels).toEqual({ STL: 7, ARC: 13 });
  });

  it('should give an archetype-less character no specialisation anywhere (TICKET-ARC-03)', () => {
    // Nothing on a character can single a stat out any more. Picking no archetype routes every
    // stat through `non`, and with no point_buy curve in this fixture that is the 1:1 fallback —
    // so the numbers are the same whichever way a Player leaves the wizard.
    const withArchetype = calculateCharacter(
      createFixtureCharacter({ archetypeId: 'nonexistent' }),
      createFixtureConfig()
    );
    const without = calculateCharacter(createFixtureCharacter(), createFixtureConfig());

    expect(withArchetype.statValues).toEqual(without.statValues);
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

  it('should name the skill when a stat it is weighted on could not be calculated', () => {
    // A skill has no formula of its own to hold an undefined code (TICKET-SKL-02), so the way it
    // fails is upstream: a derived stat in its weight rows that did not compute.
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
      skills: [
        {
          id: 'STL',
          name: 'Stealth',
          description: '',
          statWeights: [{ statId: 'mana', weight: 0.5 }],
        },
      ],
    });

    const result = calculateCharacter(createFixtureCharacter(), config);

    expect(result.skillLevels.STL).toMatchObject({
      kind: 'upstream',
      message: 'Mana could not be calculated',
      source: { kind: 'skill', id: 'STL', name: 'Stealth' },
      cause: {
        message: 'Undefined variable: MAG',
        source: { kind: 'stat', id: 'mana', name: 'Mana' },
      },
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
    expect(result.skillLevels.STL).toBe(7); // base 2 + DEX 10 / 2
    expect(result.skillLevels.ARC).toBe(13); // base 1 + CON 12
    expect(result.combatSkillBonuses.MEL).toBe(16); // STR 9 + STL 7
  });

  it('should chain provenance from a broken skill into the combat skill reading it', () => {
    // Stealth is weighted on a derived stat that cannot compute, so its level is an error and the
    // combat skill reading `skills.stealth` reports it as the cause rather than a bare 0
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
          id: 'CON',
          name: 'Constitution',
          abbreviation: 'CON',
          description: '',
          order: 1,
          countsTowardTotal: true,
          isResource: false,
          rounding: 'none',
        },
        {
          id: 'mana',
          name: 'Mana',
          abbreviation: 'MAN',
          description: '',
          order: 2,
          countsTowardTotal: false,
          isResource: false,
          rounding: 'none',
          formula: 'MAG * 5',
        },
      ],
      skills: [
        {
          id: 'STL',
          name: 'Stealth',
          description: '',
          statWeights: [{ statId: 'mana', weight: 0.5 }],
        },
        {
          id: 'ARC',
          name: 'Arcana',
          description: '',
          statWeights: [{ statId: 'CON', weight: 1 }],
        },
      ],
    });

    const result = calculateCharacter(createFixtureCharacter(), config);

    // MEL is `STR + skills.stealth`, and Stealth is broken — so MEL's error names it as the cause
    expect(result.combatSkillBonuses.MEL).toMatchObject({
      kind: 'upstream',
      source: { kind: 'combat-skill', name: 'Melee' },
      cause: {
        kind: 'upstream',
        source: { kind: 'skill', name: 'Stealth' },
        cause: { message: 'Undefined variable: MAG', source: { kind: 'stat', name: 'Mana' } },
      },
    });

    // The unrelated skill is untouched
    expect(result.skillLevels.ARC).toBe(13); // invested 1 + CON 12
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
      skills: [
        {
          id: 'STL',
          name: 'Stealth',
          description: '',
          statWeights: [{ statId: 'WIS', weight: 1 }],
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
    expect(result.skillLevels.STL).toBe(2); // base 2 + WIS 0
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
 * A combat skill's `bonusFormula` is still written in the **flat** variable space, so `STR + 2`
 * reaches a stat by its `abbreviation`. That space is a carry-across from v1, where `MainSkill`
 * was the invested atom; TICKET-STAT-01 kept it pointed at stat abbreviations rather than
 * redesigning both skill kinds in the same change.
 *
 * **The equipment half is already gone** (TICKET-MAT-02): an equipment bonus used to reach a stat
 * by matching its abbreviation, and now matches the stat's id. **The speciality half is gone too**
 * (TICKET-SKL-02): a `Skill` names its stats by **id** in `statWeights`, so no spelling is
 * involved and a rename cannot orphan it — which is what the deleted half of this block used to
 * demonstrate going wrong.
 *
 * What is left is the combat formula's spelling, and it is temporary too — this test exists to
 * fail loudly when **TICKET-ROLL-06** replaces `CombatSkill` with roll definitions that name
 * `stats.*`. When that lands the whole block goes, and with it `statVariables`. Do not "fix" it by
 * re-adding a flat spelling.
 */
describe('the flat abbreviation bridge (half retired by TICKET-SKL-02, rest by TICKET-ROLL-06)', () => {
  it('should let a combat formula reach a stat by its abbreviation', () => {
    const result = calculateCharacter(createFixtureCharacter(), createFixtureConfig());

    // MEL is `STR + skills.stealth`, STR composes to 9 and Stealth to 7
    expect(result.combatSkillBonuses.MEL).toBe(16);
  });

  it('should lose the reference when the abbreviation is renamed without the formula', () => {
    // The bridge is spelled, not stored: `statVariables` rebuilds it from the current
    // abbreviations at calculation time. So renaming a stat and leaving the old spelling in a
    // formula is an undefined variable rather than a stale number — which is exactly why
    // TICKET-REF-01 rewrites the formulas on rename, and why moving off the flat space removes
    // the class of problem rather than managing it.
    const config = createFixtureConfig();
    const renamed: Configuration = {
      ...config,
      stats: config.stats.map((stat) =>
        stat.id === 'STR' ? { ...stat, abbreviation: 'STG' } : stat
      ),
    };

    const stale = calculateCharacter(createFixtureCharacter(), renamed);

    expect(stale.combatSkillBonuses.MEL).toMatchObject({
      kind: 'undefined-variable',
      message: 'Undefined variable: STR',
    });

    // The skill beside it is keyed by id and does not budge (TICKET-SKL-02)
    expect(stale.skillLevels.STL).toBe(7);
  });
});

/**
 * The archetype changes the exchange rate between points spent and stats gained (Concept 03,
 * TICKET-ARC-02). Asserted through the composed entry point, because that is where the change has
 * to be visible — every screen reads `calculateCharacter`.
 */
describe('calculateCharacter — curve-routed stat gains (TICKET-ARC-02)', () => {
  /** The seeded table, cut to the two keys these cases read */
  const pointBuy: Curve = {
    id: 'curve-point-buy',
    name: 'point_buy',
    displayName: 'Point buy',
    description: '',
    keyName: 'points',
    columns: [
      { id: 'col-non', name: 'non' },
      { id: 'col-sub', name: 'sub' },
      { id: 'col-main', name: 'main' },
    ],
    rows: [
      { key: 0, values: [0, 0, 0] },
      { key: 10, values: [4, 5, 8.25] },
      { key: 15, values: [5, 7, 12] },
    ],
    interpolation: 'step',
    outOfRange: 'error',
    lookupDirection: 'forward',
  };

  const archetype: Archetype = {
    id: 'strong',
    name: 'Strong',
    description: '',
    // CON is deliberately untagged, so the default-to-non path is exercised in the composition too
    statAffinity: { STR: 'main', DEX: 'sub' },
  };

  /** No races and no equipment, so each stat's value is exactly what its points bought */
  function bareConfig(overrides: Partial<Configuration> = {}): Configuration {
    return createFixtureConfig({
      races: [],
      curves: [pointBuy],
      archetypes: [archetype],
      ...overrides,
    });
  }

  const bareCharacter = (overrides: Partial<Character> = {}) =>
    createFixtureCharacter({
      raceIds: [],
      investedStatPoints: { STR: 15, DEX: 15, CON: 15 },
      ...overrides,
    });

  it('should replace the raw points with what the affinity’s column buys', () => {
    const result = calculateCharacter(bareCharacter({ archetypeId: 'strong' }), bareConfig());

    // The same 15 points, three different values — the whole point of the concept
    expect(result.statValues.STR).toBe(12);
    expect(result.statValues.DEX).toBe(7);
    expect(result.statValues.CON).toBe(5);
  });

  it('should route every stat through non for a character with no archetype', () => {
    const result = calculateCharacter(bareCharacter(), bareConfig());

    expect(result.statValues.STR).toBe(5);
    expect(result.statValues.DEX).toBe(5);
    expect(result.statValues.CON).toBe(5);
  });

  it('should route every stat through non when the archetype was deleted', () => {
    const result = calculateCharacter(
      bareCharacter({ archetypeId: 'gone' }),
      bareConfig({ archetypes: [] })
    );

    expect(result.statValues.STR).toBe(5);
  });

  it('should leave the race base and equipment terms untouched', () => {
    // Elf gives DEX 2; the fixture's cloak is not equipped, so the terms in play are base + gain
    const result = calculateCharacter(
      bareCharacter({ archetypeId: 'strong', raceIds: ['elf'] }),
      bareConfig({ races: createFixtureConfig().races })
    );

    const base = createFixtureConfig().races.find((race) => race.id === 'elf')?.statValues.DEX ?? 0;
    expect(result.statValues.DEX).toBe(base + 7);
  });

  it('should chip a stat whose spend the table cannot price', () => {
    // 40 points is past the last row, and the seed refuses out-of-range
    const result = calculateCharacter(
      bareCharacter({ archetypeId: 'strong', investedStatPoints: { STR: 40 } }),
      bareConfig()
    );

    expect(result.statValues.STR).toMatchObject({ kind: 'out-of-range' });
    // Named, so the sheet's chip says which stat rather than only which curve
    expect((result.statValues.STR as { source?: { name: string } }).source?.name).toBe('Strength');
  });

  it('should leave the other stats calculable when one spend cannot be priced', () => {
    const result = calculateCharacter(
      bareCharacter({ archetypeId: 'strong', investedStatPoints: { STR: 40, DEX: 15 } }),
      bareConfig()
    );

    expect(result.statValues.DEX).toBe(7);
  });

  it('should fall back to 1:1 for a ruleset with no point_buy curve', () => {
    // Every ruleset written before TICKET-ARC-02 is this one, and they keep working
    const result = calculateCharacter(bareCharacter(), bareConfig({ curves: [] }));

    expect(result.statValues.STR).toBe(15);
  });
});
