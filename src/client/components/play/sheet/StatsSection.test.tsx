/**
 * Stats Section Tests
 *
 * The grouped sheet, both ways round (TICKET-STAT-04): a ruleset that names groups draws a heading
 * per distinct name, and one that names none draws the flat list it always has — same rows, same
 * order, no heading invented for them.
 *
 * Pure props, so no store and no mock: the section is given the stats exactly as
 * `useCharacterSheet` produces them.
 *
 * **Validates: Concept 01; Requirements 11.3, 13.4, 21.1-21.5**
 */

import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { StatsSection } from './StatsSection';
import type { StatBreakdown } from './useCharacterSheet';

/**
 * A stat as the sheet's view model holds one
 *
 * @param name - The stat's name, doubling as its id
 * @param group - Which column it belongs to, or undefined for ungrouped
 * @returns A complete `StatBreakdown`
 */
function stat(name: string, group?: string): StatBreakdown {
  return {
    id: name,
    name,
    abbreviation: name.slice(0, 3).toUpperCase(),
    group,
    isResource: false,
    isDerived: false,
    invested: 0,
    gain: { value: 0, error: null },
    race: 0,
    equipment: 0,
    current: 0,
    max: { value: 12, error: null },
    isOverMax: false,
  };
}

/**
 * Render the section over the given stats, with no point pool to spend
 *
 * @param stats - What the ruleset defines
 */
function renderSection(stats: StatBreakdown[]) {
  const onChangeInvestedPoints = vi.fn();
  render(
    <StatsSection
      stats={stats}
      statTotal={0}
      budget={null}
      onChangeInvestedPoints={onChangeInvestedPoints}
    />
  );
}

describe('StatsSection', () => {
  it('should draw a heading per group, with each stat under its own', () => {
    renderSection([stat('Strenght', 'Physical'), stat('Int', 'Mental'), stat('Dex', 'Physical')]);

    const physical = screen.getByRole('heading', { name: 'Physical' });
    const mental = screen.getByRole('heading', { name: 'Mental' });

    // The heading's own column holds its stats and not the other group's
    expect(physical.parentElement?.textContent).toContain('Strenght');
    expect(physical.parentElement?.textContent).toContain('Dex');
    expect(physical.parentElement?.textContent).not.toContain('Int');
    expect(mental.parentElement?.textContent).toContain('Int');
  });

  it('should draw as many columns as there are distinct groups, a fourth included', () => {
    renderSection([
      stat('Strenght', 'Physical'),
      stat('Int', 'Mental'),
      stat('Health', 'Vitals'),
      stat('Luck', 'Fortune'),
    ]);

    const headings = screen.getAllByRole('heading', { level: 3 });

    expect(headings.map((heading) => heading.textContent)).toEqual([
      'Physical',
      'Mental',
      'Vitals',
      'Fortune',
    ]);
  });

  it('should render a ruleset with no groups exactly as before — every stat, no heading', () => {
    renderSection([stat('Strenght'), stat('Dex'), stat('Con')]);

    expect(screen.queryAllByRole('heading', { level: 3 })).toHaveLength(0);
    expect(screen.getByText('Strenght (STR)')).toBeDefined();
    expect(screen.getByText('Dex (DEX)')).toBeDefined();
    expect(screen.getByText('Con (CON)')).toBeDefined();
  });

  it('should leave an ungrouped stat headingless beside the groups it does not join', () => {
    renderSection([stat('Strenght', 'Physical'), stat('Luck')]);

    const headings = screen.getAllByRole('heading', { level: 3 });

    expect(headings.map((heading) => heading.textContent)).toEqual(['Physical']);
    expect(screen.getByText('Luck (LUC)')).toBeDefined();
  });

  it('should still tell a ruleset with no stats at all', () => {
    renderSection([]);

    expect(screen.getByText('This ruleset defines no stats.')).toBeDefined();
  });
});
