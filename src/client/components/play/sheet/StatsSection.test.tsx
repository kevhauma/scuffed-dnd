/**
 * Stats Section Tests
 *
 * The grouped sheet, both ways round (TICKET-STAT-04): a ruleset that names groups draws a heading
 * per distinct name, and one that names none draws the flat list it always has — same rows, same
 * order, no heading invented for them.
 *
 * **And the rows survive their controls** (TICKET-DM-05): with no spend handler — the table's DM,
 * whose `invest-stat-points` meets a 404 — each row keeps its value and **what is already invested in
 * it**, and loses the two buttons.
 *
 * Pure props, so no store and no mock: the section is given the stats exactly as
 * `useCharacterSheet` produces them.
 *
 * **Validates: Concept 01; Requirements 11.3, 13.4, 21.1-21.5; v3 Req 42.7, 49.10**
 */

import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { PointBudgetView } from '../shared/pointBudgetView';
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

  describe('with no spend handler, which is the table’s DM (TICKET-DM-05)', () => {
    /** A stat with points in it and a pool to spend, so only the reader decides the controls */
    function spent(): StatBreakdown {
      return { ...stat('Strenght'), invested: 6 };
    }

    /** The pool as the header states it, so `canSpend` is not what closes the buttons here */
    const budget: PointBudgetView = {
      pointsSpent: 6,
      grantedPoints: 0,
      pointBudget: { value: 15, error: null },
      pointsRemaining: { value: 9, error: null },
      isOverBudget: false,
    };

    it('should draw no spend controls, though the pool has points left in it', () => {
      const strength = spent();
      render(<StatsSection stats={[strength]} statTotal={99} budget={budget} />);

      const spend = screen.queryByRole('button', { name: 'Spend a point on Strenght' });
      const refund = screen.queryByRole('button', { name: 'Remove a point from Strenght' });

      expect(spend).toBeNull();
      expect(refund).toBeNull();
    });

    it('should still show the value and what has been invested in it', () => {
      // Criterion 4: the buttons go, the number does not. A DM reading somebody's sheet is reading
      // exactly *how many points are in this*.
      const strength = spent();
      render(<StatsSection stats={[strength]} statTotal={99} budget={budget} />);

      const name = screen.getByText('Strenght (STR)');
      const value = screen.getByText('12');
      const invested = screen.getByText('6 points spent');

      expect(name).toBeDefined();
      expect(value).toBeDefined();
      expect(invested).toBeDefined();
    });

    it('should leave a stat with nothing invested unlabelled, as it always was', () => {
      // The `!== 0` in `CountRow`: a derived stat takes no points ever and gets no reading, rather
      // than a 0 drawn on every row that cannot be spent on
      const evasion = stat('Evasion');
      render(<StatsSection stats={[evasion]} statTotal={99} budget={budget} />);

      const reading = screen.queryByText('0 points spent');

      expect(reading).toBeNull();
    });

    it('should say who grants the pool instead', () => {
      const strength = spent();
      render(<StatsSection stats={[strength]} statTotal={99} budget={budget} />);

      const notice = screen.getByText(/quick actions/);

      expect(notice).toBeDefined();
    });
  });
});
