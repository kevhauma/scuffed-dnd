/**
 * Skills Section Tests
 *
 * The grid had no tests of its own before TICKET-DM-05 — `CharacterSheet.test.tsx` covered what it
 * *renders* end to end, and there was nothing to say about it in isolation. There is now: the spend
 * handler became optional, so *what a row looks like without one* is a decision this component makes
 * and nothing else does.
 *
 * With no handler — the table's DM, whose `invest-skill-points` meets a 404 — each row keeps its
 * level, its bonus and **what is already invested in it**, and loses the two buttons.
 *
 * Pure props, so no store and no mock.
 *
 * **Validates: Concept 02; Requirements 13.4, 21.1-21.5; v3 Req 42.7, 49.10**
 */

import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { PointBudgetView } from '../shared/pointBudgetView';
import { SkillsSection } from './SkillsSection';
import type { SkillBreakdown } from './useCharacterSheet';

/**
 * A skill as the sheet's view model holds one
 *
 * @param name - The skill's name, doubling as its id
 * @param invested - Points the Player has put into it
 * @returns A complete `SkillBreakdown`
 */
function skill(name: string, invested = 0): SkillBreakdown {
  return {
    id: name,
    name,
    invested,
    bonus: { value: 2, error: null },
    total: { value: 7, error: null },
    statContributions: [{ label: 'STR × 0.5', value: 4 }],
  };
}

/** A pool with points left in it, so nothing but the reader closes a spend control */
const BUDGET: PointBudgetView = {
  pointsSpent: 3,
  grantedPoints: 0,
  pointBudget: { value: 15, error: null },
  pointsRemaining: { value: 12, error: null },
  isOverBudget: false,
};

/** One skill with three points in it, the fixture every case below reads */
const STEALTH = skill('Stealth', 3);

describe('SkillsSection', () => {
  it('should give a Player the spend controls out of the shared pool', () => {
    const onChangeInvestedPoints = vi.fn();
    render(
      <SkillsSection
        skills={[STEALTH]}
        budget={BUDGET}
        onChangeInvestedPoints={onChangeInvestedPoints}
      />
    );

    const spend = screen.getByRole('button', { name: 'Spend a point on Stealth' });
    const refund = screen.getByRole('button', { name: 'Remove a point from Stealth' });

    expect(spend).toBeDefined();
    expect(refund).toBeDefined();
  });

  describe('with no spend handler, which is the table’s DM (TICKET-DM-05)', () => {
    it('should draw no spend controls, though the pool has points left in it', () => {
      render(<SkillsSection skills={[STEALTH]} budget={BUDGET} />);

      const spend = screen.queryByRole('button', { name: 'Spend a point on Stealth' });
      const refund = screen.queryByRole('button', { name: 'Remove a point from Stealth' });

      expect(spend).toBeNull();
      expect(refund).toBeNull();
    });

    it('should still show the level and what has been invested in it', () => {
      render(<SkillsSection skills={[STEALTH]} budget={BUDGET} />);

      const name = screen.getByText('Stealth');
      const level = screen.getByText('7');
      const invested = screen.getByText('3 points spent');

      expect(name).toBeDefined();
      expect(level).toBeDefined();
      expect(invested).toBeDefined();
    });

    it('should say who grants the pool instead', () => {
      render(<SkillsSection skills={[STEALTH]} budget={BUDGET} />);

      const notice = screen.getByText(/quick actions/);

      expect(notice).toBeDefined();
    });

    it('should still tell a ruleset with no skills at all', () => {
      render(<SkillsSection skills={[]} budget={BUDGET} />);

      const empty = screen.getByText('This ruleset defines no skills.');

      expect(empty).toBeDefined();
    });
  });
});
