/**
 * Combat Roll Aggregator Tests
 *
 * **Validates: Requirements 5.5, 5.6**
 */

import { describe, expect, it } from 'vitest';
import type { CalculatedCharacter } from '../../types/character';
import type { CombatSkill, Configuration } from '../../types/config';
import type { CombatRollResult } from '../../types/formula';
import { calculateCharacter } from '../calculator';
import { isFormulaError } from '../formula/errors';
import { rollCombatSkill } from './combatRoll';

/** A deterministic stand-in for Math.random, cycling through the given values */
function sequenceRng(values: number[]): () => number {
  let index = 0;
  return () => values[index++ % values.length];
}

const melee: CombatSkill = {
  id: 'MEL',
  code: 'MEL',
  name: 'Melee',
  description: '',
  dice: { d4: 0, d6: 2, d8: 0, d10: 0, d12: 0, d20: 1 },
  bonusFormula: 'STR + STL',
};

const unarmed: CombatSkill = {
  id: 'UNA',
  code: 'UNA',
  name: 'Unarmed',
  description: '',
  dice: { d4: 0, d6: 0, d8: 0, d10: 0, d12: 0, d20: 0 },
  bonusFormula: 'STR',
};

function createConfig(overrides: Partial<Configuration> = {}): Configuration {
  return {
    id: 'config1',
    name: 'Test Config',
    version: '1.0',
    schemaVersion: 4,
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
    ],
    combatSkills: [melee, unarmed],
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

function createCharacter(config: Configuration): CalculatedCharacter {
  return calculateCharacter(
    {
      id: 'char1',
      name: 'Test Character',
      configurationId: 'config1',
      raceIds: [],
      investedStatPoints: { STR: 6, DEX: 8 },
      specialitySkillBaseLevels: { STL: 2 },
      currentResourceValues: {},
      inventory: { equippedItems: {}, miscItems: [] },
      createdAt: '2024-01-01',
      updatedAt: '2024-01-01',
    },
    config
  );
}

describe('rollCombatSkill', () => {
  /**
   * Roll, asserting the bonus formula evaluated. `rollCombatSkill` returns a `FormulaError`
   * instead of a result when it does not (TICKET-FORM-05); these cases all expect a real roll.
   */
  const rollOk = (...args: Parameters<typeof rollCombatSkill>): CombatRollResult => {
    const rolled = rollCombatSkill(...args);
    if (isFormulaError(rolled)) {
      throw new Error(`expected a roll, got a formula error: ${rolled.message}`);
    }
    return rolled;
  };

  it('should produce a total equal to the dice total plus the calculated bonus', () => {
    const config = createConfig();
    const character = createCharacter(config);

    // STL = base 2 + DEX 8 / 2 = 6, so MEL's bonus is STR 6 + STL 6 = 12
    expect(character.combatSkillBonuses.MEL).toBe(12);

    // 0 → the lowest face of each die: 1, 1 (d6) and 1 (d20)
    const result = rollOk(melee, character, config, () => 0, '2024-05-05T00:00:00.000Z');

    expect(result.diceResults).toEqual([
      { dieType: 'd6', rolls: [1, 1], total: 2 },
      { dieType: 'd20', rolls: [1], total: 1 },
    ]);
    expect(result.diceTotal).toBe(3);
    expect(result.bonus).toBe(12);
    expect(result.total).toBe(15);
    expect(result.total).toBe(result.diceTotal + result.bonus);
  });

  it('should take the bonus from the combat skill calculator, not a re-evaluation', () => {
    const config = createConfig();
    const character = createCharacter(config);

    const result = rollOk(melee, character, config, () => 0.5);

    expect(result.bonus).toBe(character.combatSkillBonuses.MEL);
  });

  it('should include equipment bonuses, because the calculator does', () => {
    const config = createConfig({
      materials: [
        {
          id: 'mat-keen',
          name: 'Keen Edge',
          description: '',
          categoryId: 'metal',
          levels: [
            {
              level: 1,
              name: 'Keen Edge',
              bonuses: [{ statId: 'STR', modifier: 5 }],
              value: { tierId: 'gold', amount: 1 },
            },
          ],
        },
      ],
      materialCategories: [{ id: 'metal', name: 'Metal', description: '' }],
      items: [
        {
          id: 'item-sword',
          name: 'Sword',
          description: '',
          materialId: 'mat-keen',
          materialLevel: 1,
          equipmentSlotType: 'main_hand',
        },
      ],
      equipmentSlots: [{ type: 'main_hand', name: 'Main Hand', description: '' }],
      currencyTiers: [{ id: 'gold', name: 'Gold', order: 0, conversionToNext: 10 }],
    });

    const base = createCharacter(config);
    const equipped = {
      ...base,
      inventory: { equippedItems: { main_hand: 'item-sword' }, miscItems: [] },
    };
    const character = calculateCharacter(equipped, config);

    const result = rollOk(melee, character, config, () => 0);

    // The sword raises STR by 5 and `STR + STL` follows. Since TICKET-MAT-01 a tier modifier can
    // only name a stat, so this is the one route equipment reaches a combat roll by.
    expect(result.bonus).toBe(17); // 12 + 5 from the equipped sword
  });

  it('should handle an all-zero dice configuration without NaN', () => {
    const config = createConfig();
    const character = createCharacter(config);

    const result = rollOk(unarmed, character, config, () => 0);

    expect(result.diceResults).toEqual([]);
    expect(result.diceTotal).toBe(0);
    expect(result.bonus).toBe(6); // STR
    expect(result.total).toBe(6);
    expect(Number.isNaN(result.total)).toBe(false);
  });

  it('should contribute no bonus for a skill the configuration does not define', () => {
    const config = createConfig({ combatSkills: [] });
    const character = createCharacter(config);

    const result = rollOk(melee, character, config, () => 0);

    expect(result.bonus).toBe(0);
    expect(result.total).toBe(result.diceTotal);
  });

  it('should return the error value when the bonus formula does not evaluate', () => {
    // TICKET-FORM-05: rolling with a silent bonus of 0 would hide a broken ruleset, so the
    // error is returned instead of a result and the caller reports it beside the skill.
    const working = createConfig();
    const character = createCharacter(working);
    const broken = createConfig({
      combatSkills: [{ ...melee, bonusFormula: 'NOPE' }],
    });

    const result = rollCombatSkill(melee, character, broken, () => 0);

    expect(isFormulaError(result)).toBe(true);
    expect(result).toMatchObject({
      kind: 'undefined-variable',
      message: 'Undefined variable: NOPE',
      source: { kind: 'combat-skill', name: 'Melee' },
    });
  });

  it('should carry the skill identity and a timestamp', () => {
    const config = createConfig();
    const character = createCharacter(config);

    const result = rollOk(melee, character, config, () => 0);

    expect(result.skillCode).toBe('MEL');
    expect(result.skillName).toBe('Melee');
    expect(new Date(result.timestamp).toISOString()).toBe(result.timestamp);
  });

  it('should be deterministic under a seeded source of randomness', () => {
    const config = createConfig();
    const character = createCharacter(config);
    const seed = [0.1, 0.7, 0.42];
    const at = '2024-05-05T00:00:00.000Z';

    expect(rollOk(melee, character, config, sequenceRng(seed), at)).toEqual(
      rollOk(melee, character, config, sequenceRng(seed), at)
    );
  });
});
