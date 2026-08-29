/**
 * Resources Section Tests
 *
 * The pools obey the ruleset's stat groups too (TICKET-STAT-04). The sheet's *Vitals* column holds
 * Health and Mana — both `isResource`, so both land here rather than among the stats — and a group
 * that names them draws a heading here as it does there. A ruleset naming none is unchanged.
 *
 * Pure props, so no store and no mock.
 *
 * **Validates: Concept 20; Requirements 13.4, 14.1, 14.2, 21.1-21.5**
 */

import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ResourcesSection } from './ResourcesSection';
import type { StatBreakdown } from './useCharacterSheet';

/**
 * A resource as the sheet's view model holds one
 *
 * @param name - The pool's name, doubling as its id
 * @param group - Which column it belongs to, or undefined for ungrouped
 * @returns A complete `StatBreakdown` flagged as a resource
 */
function pool(name: string, group?: string): StatBreakdown {
  return {
    id: name,
    name,
    abbreviation: name.slice(0, 3).toUpperCase(),
    group,
    isResource: true,
    isDerived: false,
    invested: 0,
    gain: { value: 0, error: null },
    race: 0,
    equipment: 0,
    current: 4,
    max: { value: 8, error: null },
    isOverMax: false,
  };
}

/**
 * Render the section over the given pools, with no point pool to spend
 *
 * @param resources - What the ruleset flags `isResource`
 */
function renderSection(resources: StatBreakdown[]) {
  render(
    <ResourcesSection
      resources={resources}
      budget={null}
      onChangeStatValue={vi.fn()}
      onAdjustStatValue={vi.fn()}
      onResetStatValueToMax={vi.fn()}
      onChangeInvestedPoints={vi.fn()}
    />
  );
}

describe('ResourcesSection', () => {
  it('should draw a heading per group, with each pool under its own', () => {
    renderSection([pool('Health', 'Vitals'), pool('Focus', 'Mental'), pool('Mana', 'Vitals')]);

    const vitals = screen.getByRole('heading', { name: 'Vitals' });
    const headings = screen.getAllByRole('heading', { level: 3 });

    expect(headings.map((heading) => heading.textContent)).toEqual(['Vitals', 'Mental']);
    expect(vitals.parentElement?.textContent).toContain('Health');
    expect(vitals.parentElement?.textContent).toContain('Mana');
    expect(vitals.parentElement?.textContent).not.toContain('Focus');
  });

  it('should render a ruleset with no groups exactly as before — every pool, no heading', () => {
    renderSection([pool('Health'), pool('Mana')]);

    expect(screen.queryAllByRole('heading', { level: 3 })).toHaveLength(0);
    expect(screen.getByText('Health (HEA)')).toBeDefined();
    expect(screen.getByText('Mana (MAN)')).toBeDefined();
  });
});
