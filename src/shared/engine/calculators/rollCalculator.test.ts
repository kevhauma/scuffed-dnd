/**
 * Roll Input Calculator Tests
 *
 * The successor to `combatSkillCalculator.test.ts`, which went with the entity. What is asserted is
 * the same contract, over the field that replaced it: the expression evaluates at the `roll-input`
 * attachment point, keyed by roll **id**, and an upstream error propagates as an error value
 * naming the roll rather than as a confident zero.
 *
 * **Validates: Concept 08; Requirements 16.6; Concept 00 §7**
 */

import { describe, expect, it } from 'vitest';
import type { Configuration } from '../../types/config';
import type { FormulaError, FormulaResult } from '../../types/formula';
import { describeFormulaError, formulaError, isFormulaError } from '../formula/errors';
import { calculateRollInputs } from './rollCalculator';

function createConfig(overrides: Partial<Configuration> = {}): Configuration {
  return {
    id: 'config1',
    name: 'Test Config',
    version: '1.0',
    schemaVersion: 10,
    stats: [
      {
        id: 'str-id',
        name: 'Strength',
        abbreviation: 'STR',
        description: '',
        order: 0,
        countsTowardTotal: true,
        isResource: false,
        rounding: 'none',
      },
    ],
    skills: [
      {
        id: 'stl-id',
        name: 'Stealth',
        description: '',
        statWeights: [{ statId: 'str-id', weight: 0.5 }],
      },
    ],
    diceLadders: [
      {
        id: 'ladder',
        name: 'Standard',
        description: '',
        dieSizes: [20, 12, 6],
        showZeroTerms: true,
        remainder: 'flat',
      },
    ],
    rollDefinitions: [
      {
        id: 'mel-id',
        name: 'Melee',
        description: '',
        input: 'STR + 2',
        ladderId: 'ladder',
        order: 0,
      },
    ],
    materials: [],
    materialCategories: [],
    items: [],
    equipmentSlots: [],
    races: [],
    currencyTiers: [],
    createdAt: '2024-01-01',
    updatedAt: '2024-01-01',
    ...overrides,
  };
}

const statValues: Record<string, FormulaResult> = { 'str-id': 10 };
const skills = { levels: { 'stl-id': 5 }, bonuses: { 'stl-id': 1 } };

describe('calculateRollInputs', () => {
  it('should evaluate each input and key the result by roll id', () => {
    expect(calculateRollInputs(createConfig(), statValues, skills)).toEqual({ 'mel-id': 12 });
  });

  it('should reach a stat by its abbreviation and by its dotted slug alike', () => {
    const config = createConfig({
      rollDefinitions: [
        {
          id: 'flat-id',
          name: 'Flat',
          description: '',
          input: 'STR',
          ladderId: 'ladder',
          order: 0,
        },
        {
          id: 'dotted-id',
          name: 'Dotted',
          description: '',
          input: 'stats.strength',
          ladderId: 'ladder',
          order: 1,
        },
      ],
    });

    const inputs = calculateRollInputs(config, statValues, skills);

    expect(inputs['flat-id']).toBe(10);
    expect(inputs['dotted-id']).toBe(10);
  });

  it('should reach a skill by name slug, level and bonus', () => {
    const config = createConfig({
      rollDefinitions: [
        {
          id: 'lvl-id',
          name: 'Level',
          description: '',
          input: 'skills.stealth',
          ladderId: 'ladder',
          order: 0,
        },
        {
          id: 'bonus-id',
          name: 'Bonus',
          description: '',
          input: 'skills.stealth.bonus',
          ladderId: 'ladder',
          order: 1,
        },
        {
          // The spelling this module's own header, the grammar docs and `references.ts` all
          // present — and which the resolver used to refuse (CR-10)
          id: 'explicit-lvl-id',
          name: 'Explicit level',
          description: '',
          input: 'skills.stealth.level',
          ladderId: 'ladder',
          order: 2,
        },
      ],
    });

    const inputs = calculateRollInputs(config, statValues, skills);

    expect(inputs['lvl-id']).toBe(5);
    expect(inputs['bonus-id']).toBe(1);
    expect(inputs['explicit-lvl-id']).toBe(5);
  });

  it('should still name the properties a skill has when given one it does not (CR-10)', () => {
    const config = createConfig({
      rollDefinitions: [
        {
          id: 'nope-id',
          name: 'Nope',
          description: '',
          input: 'skills.stealth.modifier',
          ladderId: 'ladder',
          order: 0,
        },
      ],
    });

    const result = calculateRollInputs(config, statValues, skills)['nope-id'];

    expect(isFormulaError(result)).toBe(true);
    // The refusal is the root of the chain the roll reports, and it names both properties
    expect(describeFormulaError(result as FormulaError)).toContain(
      'skills.stealth has no property modifier — a skill has a level and a bonus'
    );
  });

  it('should name the roll when its input references something undefined', () => {
    const config = createConfig({
      rollDefinitions: [
        {
          id: 'mel-id',
          name: 'Melee',
          description: '',
          input: 'STR + NOPE',
          ladderId: 'ladder',
          order: 0,
        },
      ],
    });

    expect(calculateRollInputs(config, statValues, skills)['mel-id']).toMatchObject({
      kind: 'undefined-variable',
      source: { kind: 'roll', id: 'mel-id', name: 'Melee' },
    });
  });

  it('should carry an upstream error rather than reading a broken stat as zero', () => {
    // Concept 00 §7: a value that could not be calculated must stay visibly uncalculated
    const broken = { 'str-id': formulaError('syntax', 'Strength is broken') };

    const result = calculateRollInputs(createConfig(), broken, skills)['mel-id'];

    expect(isFormulaError(result)).toBe(true);
    expect(result).toMatchObject({ source: { kind: 'roll', name: 'Melee' } });
  });

  it('should return an empty map for a ruleset with no rolls', () => {
    const config = createConfig();
    config.rollDefinitions = undefined;

    expect(calculateRollInputs(config, statValues, skills)).toEqual({});
  });
});
