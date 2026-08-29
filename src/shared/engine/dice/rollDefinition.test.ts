/**
 * Roll Definition Aggregator Tests
 *
 * The successor to `combatRoll.test.ts`, which went with `rollCombatSkill`. The contract it tested
 * is kept and strengthened: **the roll reads the calculated input rather than re-evaluating the
 * formula**, which is what makes "a roll can never disagree with the sheet" structural rather than
 * a promise — the sheet labels its button from the same map.
 *
 * **Validates: Concepts 07, 08; Requirements 15.1, 15.2**
 */

import { describe, expect, it } from 'vitest';
import type { CalculatedCharacter } from '../../types/character';
import type { Configuration, RollDefinition } from '../../types/config';
import type { FormulaResult } from '../../types/formula';
import { formulaError, isFormulaError } from '../formula/errors';
import { rollRollDefinition } from './rollDefinition';

const ladder = {
  id: 'ladder',
  name: 'Standard',
  description: '',
  dieSizes: [20, 12, 6],
  showZeroTerms: true,
  remainder: 'flat' as const,
};

const melee: RollDefinition = {
  id: 'mel-id',
  name: 'Melee',
  description: '',
  input: 'STR',
  ladderId: 'ladder',
  order: 0,
};

function createConfig(overrides: Partial<Configuration> = {}): Configuration {
  return {
    id: 'config1',
    name: 'Test Config',
    version: '1.0',
    schemaVersion: 10,
    stats: [],
    skills: [],
    diceLadders: [ladder],
    rollDefinitions: [melee],
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

/** A calculated character carrying just the one map this function reads */
function createCharacter(rollInputs: Record<string, FormulaResult>): CalculatedCharacter {
  return {
    id: 'char1',
    name: 'Aria',
    configurationId: 'config1',
    raceIds: [],
    investedStatPoints: {},
    investedSkillPoints: {},
    currentResourceValues: {},
    experience: 0,
    inventory: { equippedItems: {}, composedItems: [] },
    createdAt: '2024-01-01',
    updatedAt: '2024-01-01',
    statValues: {},
    statTotal: 0,
    skillLevels: {},
    skillBonuses: {},
    skillContributions: {},
    skillFocus: {},
    rollInputs,
    equipmentBonuses: [],
  };
}

/** A deterministic stand-in for Math.random, cycling through the given values */
function sequenceRng(values: number[]): () => number {
  let index = 0;
  return () => values[index++ % values.length];
}

describe('rollRollDefinition', () => {
  it('should decompose the calculated input and roll the resulting pool', () => {
    // 39 is Concept 07's headline row: 1D20 + 1D12 + 1D6 + 1
    const result = rollRollDefinition(
      melee,
      createCharacter({ 'mel-id': 39 }),
      createConfig(),
      sequenceRng([0, 0.5, 0.999]),
      '2024-01-01T00:00:00.000Z'
    );

    if (isFormulaError(result)) throw new Error('expected a roll, got an error');

    expect(result.input).toBe(39);
    expect(result.notation).toBe('1D20 + 1D12 + 1D6 + 1');
    expect(result.dice).toEqual([
      { size: 20, rolls: [1], total: 1 },
      { size: 12, rolls: [7], total: 7 },
      { size: 6, rolls: [6], total: 6 },
    ]);
    expect(result.diceTotal).toBe(14);
    expect(result.flat).toBe(1);
    expect(result.total).toBe(15);
    expect(result.rollName).toBe('Melee');
    expect(result.timestamp).toBe('2024-01-01T00:00:00.000Z');
  });

  it('should read the calculated input rather than re-evaluating the formula', () => {
    // The definition's own `input` string says `STR`, and there is no STR in this ruleset at all.
    // The roll still works, because the *number* is what it reads — which is exactly the guarantee:
    // the sheet's button and this function cannot disagree, since they read the same map.
    const result = rollRollDefinition(
      melee,
      createCharacter({ 'mel-id': 12 }),
      createConfig({ stats: [] }),
      () => 0
    );

    if (isFormulaError(result)) throw new Error('expected a roll, got an error');
    expect(result.notation).toBe('0D20 + 1D12 + 0D6 + 0');
  });

  it('should return the input error rather than rolling zero', () => {
    const broken = formulaError('undefined-variable', 'Undefined variable: STR');

    const result = rollRollDefinition(melee, createCharacter({ 'mel-id': broken }), createConfig());

    expect(result).toBe(broken);
  });

  it('should refuse a roll whose ladder is gone, naming the roll', () => {
    const result = rollRollDefinition(
      melee,
      createCharacter({ 'mel-id': 12 }),
      createConfig({ diceLadders: [] })
    );

    expect(result).toMatchObject({
      kind: 'not-evaluable',
      source: { kind: 'roll', id: 'mel-id', name: 'Melee' },
    });
  });

  it('should refuse a roll the calculation never saw', () => {
    // Reachable when a definition is added to the ruleset after the character was calculated
    const result = rollRollDefinition(melee, createCharacter({}), createConfig());

    expect(result).toMatchObject({
      kind: 'not-evaluable',
      source: { kind: 'roll', name: 'Melee' },
    });
  });

  it('should take its randomness from the injected source, never from Math.random', () => {
    const first = rollRollDefinition(
      melee,
      createCharacter({ 'mel-id': 39 }),
      createConfig(),
      () => 0
    );
    const second = rollRollDefinition(
      melee,
      createCharacter({ 'mel-id': 39 }),
      createConfig(),
      () => 0.999
    );

    if (isFormulaError(first) || isFormulaError(second)) throw new Error('expected rolls');
    expect(first.total).toBe(1 + 1 + 1 + 1); // every die at its minimum, plus the flat
    expect(second.total).toBe(20 + 12 + 6 + 1); // every die at its maximum
  });
});
