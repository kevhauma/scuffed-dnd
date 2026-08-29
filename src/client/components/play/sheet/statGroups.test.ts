/**
 * Stat Group Tests
 *
 * The one rule TICKET-STAT-04 rests on: the columns a sheet draws are **the distinct group values
 * present**, in the stats' own order — not a list of three names the app knows. Three groups make
 * three columns and a fourth makes a fourth, without an edit here.
 *
 * **Validates: Requirements 13.4, 21.1-21.5**
 */

import { describe, expect, it } from 'vitest';
import { groupStats, hasNamedGroups } from './statGroups';
import type { StatBreakdown } from './useCharacterSheet';

/**
 * A stat as the sheet's view model holds one, with only the fields grouping reads set apart
 *
 * @param id - The stat's id, doubling as its name
 * @param group - Which column it belongs to, or undefined for ungrouped
 * @returns A complete `StatBreakdown`
 */
function stat(id: string, group?: string): StatBreakdown {
  return {
    id,
    name: id,
    abbreviation: id.toUpperCase(),
    group,
    isResource: false,
    isDerived: false,
    invested: 0,
    gain: { value: 0, error: null },
    race: 0,
    equipment: 0,
    current: 0,
    max: { value: 1, error: null },
    isOverMax: false,
  };
}

describe('groupStats', () => {
  it('should collect a ruleset that names no groups into one unlabelled column', () => {
    const stats = [stat('str'), stat('dex')];

    const grouped = groupStats(stats);
    const isGrouped = hasNamedGroups(grouped);

    expect(grouped).toHaveLength(1);
    expect(grouped[0].label).toBeNull();
    expect(grouped[0].stats.map((entry) => entry.id)).toEqual(['str', 'dex']);
    expect(isGrouped).toBe(false);
  });

  it('should treat a blank group as ungrouped, as an imported file may carry one', () => {
    const stats = [stat('str', ''), stat('dex', '   '), stat('int')];

    const grouped = groupStats(stats);
    const isGrouped = hasNamedGroups(grouped);

    expect(grouped).toHaveLength(1);
    expect(grouped[0].label).toBeNull();
    expect(grouped[0].stats.map((entry) => entry.id)).toEqual(['str', 'dex', 'int']);
    expect(isGrouped).toBe(false);
  });

  it('should make one column per distinct group, in the stats own order', () => {
    const stats = [
      stat('str', 'Physical'),
      stat('int', 'Mental'),
      stat('dex', 'Physical'),
      stat('health', 'Vitals'),
    ];

    const grouped = groupStats(stats);
    const labels = grouped.map((column) => column.label);

    const isGrouped = hasNamedGroups(grouped);

    expect(labels).toEqual(['Physical', 'Mental', 'Vitals']);
    expect(grouped[0].stats.map((entry) => entry.id)).toEqual(['str', 'dex']);
    expect(isGrouped).toBe(true);
  });

  it('should render a fourth group as a fourth column, with nothing naming the three', () => {
    const stats = [
      stat('str', 'Physical'),
      stat('int', 'Mental'),
      stat('health', 'Vitals'),
      stat('luck', 'Fortune'),
    ];

    const grouped = groupStats(stats);
    const labels = grouped.map((column) => column.label);

    expect(labels).toEqual(['Physical', 'Mental', 'Vitals', 'Fortune']);
  });

  it('should keep ungrouped stats in a column of their own beside the named ones', () => {
    const stats = [stat('str', 'Physical'), stat('luck'), stat('dex', 'Physical')];

    const grouped = groupStats(stats);
    const labels = grouped.map((column) => column.label);

    // Still worth drawing as columns: one of them carries a name
    const isGrouped = hasNamedGroups(grouped);

    expect(labels).toEqual(['Physical', null]);
    expect(grouped[1].stats.map((entry) => entry.id)).toEqual(['luck']);
    expect(isGrouped).toBe(true);
  });

  it('should treat two spellings of one word as two groups, because nothing normalises them', () => {
    const stats = [stat('str', 'Physical'), stat('con', 'physical')];

    const grouped = groupStats(stats);
    const labels = grouped.map((column) => column.label);

    expect(labels).toEqual(['Physical', 'physical']);
  });
});
