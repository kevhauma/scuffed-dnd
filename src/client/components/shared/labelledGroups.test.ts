/**
 * Labelled Group Tests
 *
 * The one rule three surfaces rest on: the headings a list is drawn under are **the distinct labels
 * present**, in the entries' own order — not a list of names the app knows. Three groups make three
 * headings and a fourth makes a fourth, without an edit to the module.
 *
 * The stat cases came from `play/sheet/statGroups.test.ts` when TICKET-ITEM-01 extracted the third
 * copy of the pattern; the shop cases are the new caller, and they are here rather than in a second
 * file because it is one rule being asserted over two shapes.
 *
 * **Validates: Requirements 13.4, 21.1-21.5; v4 systems/10, systems/11**
 */

import { describe, expect, it } from 'vitest';
import type { Item } from '#shared/types';
import type { StatBreakdown } from '../play/sheet/useCharacterSheet';
import { groupByLabel, hasNamedGroups } from './labelledGroups';

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

/**
 * An item template with only the fields the panel's grouping reads set apart
 *
 * @param id - The template's id, doubling as its name
 * @param shop - Which shop sells it, or undefined for a template in no shop
 * @returns A complete `Item`
 */
function item(id: string, shop?: string): Item {
  return { id, name: id, description: '', shop };
}

describe('groupByLabel', () => {
  it('should collect a ruleset that names no groups into one unlabelled group', () => {
    const stats = [stat('str'), stat('dex')];

    const grouped = groupByLabel(stats, (entry) => entry.group);
    const isGrouped = hasNamedGroups(grouped);

    expect(grouped).toHaveLength(1);
    expect(grouped[0].label).toBeNull();
    expect(grouped[0].members.map((entry) => entry.id)).toEqual(['str', 'dex']);
    expect(isGrouped).toBe(false);
  });

  it('should treat a blank group as ungrouped, as an imported file may carry one', () => {
    const stats = [stat('str', ''), stat('dex', '   '), stat('int')];

    const grouped = groupByLabel(stats, (entry) => entry.group);
    const isGrouped = hasNamedGroups(grouped);

    expect(grouped).toHaveLength(1);
    expect(grouped[0].label).toBeNull();
    expect(grouped[0].members.map((entry) => entry.id)).toEqual(['str', 'dex', 'int']);
    expect(isGrouped).toBe(false);
  });

  it('should make one group per distinct label, in the entries own order', () => {
    const stats = [
      stat('str', 'Physical'),
      stat('int', 'Mental'),
      stat('dex', 'Physical'),
      stat('health', 'Vitals'),
    ];

    const grouped = groupByLabel(stats, (entry) => entry.group);
    const labels = grouped.map((column) => column.label);

    const isGrouped = hasNamedGroups(grouped);

    expect(labels).toEqual(['Physical', 'Mental', 'Vitals']);
    expect(grouped[0].members.map((entry) => entry.id)).toEqual(['str', 'dex']);
    expect(isGrouped).toBe(true);
  });

  it('should render a fourth group as a fourth column, with nothing naming the three', () => {
    const stats = [
      stat('str', 'Physical'),
      stat('int', 'Mental'),
      stat('health', 'Vitals'),
      stat('luck', 'Fortune'),
    ];

    const grouped = groupByLabel(stats, (entry) => entry.group);
    const labels = grouped.map((column) => column.label);

    expect(labels).toEqual(['Physical', 'Mental', 'Vitals', 'Fortune']);
  });

  it('should keep ungrouped entries in a group of their own beside the named ones', () => {
    const stats = [stat('str', 'Physical'), stat('luck'), stat('dex', 'Physical')];

    const grouped = groupByLabel(stats, (entry) => entry.group);
    const labels = grouped.map((column) => column.label);

    // Still worth drawing as columns: one of them carries a name
    const isGrouped = hasNamedGroups(grouped);

    expect(labels).toEqual(['Physical', null]);
    expect(grouped[1].members.map((entry) => entry.id)).toEqual(['luck']);
    expect(isGrouped).toBe(true);
  });

  it('should treat two spellings of one word as two groups, because nothing normalises them', () => {
    const stats = [stat('str', 'Physical'), stat('con', 'physical')];

    const grouped = groupByLabel(stats, (entry) => entry.group);
    const labels = grouped.map((column) => column.label);

    expect(labels).toEqual(['Physical', 'physical']);
  });

  it('should read a shop off an item the same way, from a different field (TICKET-ITEM-01)', () => {
    const items = [
      item('battleaxe', 'Imperial Forge'),
      item('bread', 'Imperial Grocery'),
      item('claymore', 'Imperial Forge'),
    ];

    const grouped = groupByLabel(items, (entry) => entry.shop);
    const labels = grouped.map((shop) => shop.label);

    expect(labels).toEqual(['Imperial Forge', 'Imperial Grocery']);
    expect(grouped[0].members.map((entry) => entry.id)).toEqual(['battleaxe', 'claymore']);
  });

  it('should give a ruleset that names no shops the one flat list it always had', () => {
    const items = [item('battleaxe'), item('bread')];

    const grouped = groupByLabel(items, (entry) => entry.shop);
    const isGrouped = hasNamedGroups(grouped);

    expect(grouped).toHaveLength(1);
    expect(grouped[0].label).toBeNull();
    expect(isGrouped).toBe(false);
  });

  it('should have nothing to group when the list is empty', () => {
    const grouped = groupByLabel([], (entry: Item) => entry.shop);
    const isGrouped = hasNamedGroups(grouped);

    expect(grouped).toEqual([]);
    expect(isGrouped).toBe(false);
  });
});
