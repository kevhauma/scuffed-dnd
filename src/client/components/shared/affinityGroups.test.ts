/**
 * Affinity Groups Tests
 *
 * The grouping both archetype surfaces render, and the `non`-by-default rule showing through from
 * the engine rather than being re-implemented here.
 *
 * **Validates: Concept 03**
 */

import { describe, expect, it } from 'vitest';
import type { Archetype, Stat } from '#shared/types';
import { groupStatsByAffinity } from './affinityGroups';

function stat(overrides: Partial<Stat> & Pick<Stat, 'id' | 'name' | 'abbreviation'>): Stat {
  return {
    description: '',
    order: 0,
    countsTowardTotal: true,
    isResource: false,
    rounding: 'none',
    ...overrides,
  };
}

const STATS = [
  stat({ id: 'str-id', name: 'Strength', abbreviation: 'STR', order: 0 }),
  stat({ id: 'dex-id', name: 'Dexterity', abbreviation: 'DEX', order: 1 }),
  stat({ id: 'wis-id', name: 'Wisdom', abbreviation: 'WIS', order: 2 }),
];

function archetype(statAffinity: Archetype['statAffinity']): Archetype {
  return { id: 'strong', name: 'Strong', description: '', statAffinity };
}

describe('groupStatsByAffinity', () => {
  it('should list the groups most favoured first', () => {
    const groups = groupStatsByAffinity(archetype({ 'str-id': 'main', 'dex-id': 'sub' }), STATS);

    expect(groups.map((group) => group.affinity)).toEqual(['main', 'sub', 'non']);
    expect(groups.map((group) => group.label)).toEqual(['Main', 'Sub', 'Non']);
  });

  it('should put an untagged stat in non, without the caller applying the default', () => {
    // The rule comes from the engine's `affinityFor`; this module only orders and names
    const groups = groupStatsByAffinity(archetype({ 'str-id': 'main' }), STATS);

    expect(
      groups.find((group) => group.affinity === 'non')?.stats.map((s) => s.abbreviation)
    ).toEqual(['DEX', 'WIS']);
  });

  it('should keep each group in the ruleset’s display order', () => {
    const groups = groupStatsByAffinity(archetype({ 'wis-id': 'main', 'str-id': 'main' }), STATS);

    expect(groups[0].stats.map((s) => s.abbreviation)).toEqual(['STR', 'WIS']);
  });

  it('should drop an empty group rather than render a heading with nothing under it', () => {
    const groups = groupStatsByAffinity(archetype({}), STATS);

    expect(groups).toHaveLength(1);
    expect(groups[0].affinity).toBe('non');
  });

  it('should return nothing at all for a ruleset with no stats', () => {
    expect(groupStatsByAffinity(archetype({ 'str-id': 'main' }), [])).toEqual([]);
  });
});
