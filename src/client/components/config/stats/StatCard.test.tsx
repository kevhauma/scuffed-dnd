/**
 * Stat Card Tests
 *
 * The badge row is the card's claim about what kind of stat this is, and it is derived from the
 * model's own rule rather than from a stored flag — so these assert that a card can never say
 * "Invested" about a stat the engine treats as derived (Concept 01, TICKET-STAT-02).
 *
 * The card **evaluates nothing** since TICKET-FORM-08; the last test here is what keeps it that
 * way. Previewing a formula is the dialog's job now.
 *
 * **Validates: Concept 01; Requirements 3.1, 3.2**
 */

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { Stat } from '#shared/types/config';
import { StatCard } from './StatCard';

const baseStat: Stat = {
  id: 'str-id',
  name: 'Strength',
  abbreviation: 'STR',
  description: 'Physical power',
  order: 0,
  countsTowardTotal: true,
  isResource: false,
  rounding: 'none',
};

function renderCard(stat: Partial<Stat> = {}, props: Partial<Parameters<typeof StatCard>[0]> = {}) {
  const onMove = vi.fn();
  render(
    <StatCard
      stat={{ ...baseStat, ...stat }}
      onEdit={vi.fn()}
      onDelete={vi.fn()}
      onMove={onMove}
      canMoveUp
      canMoveDown
      {...props}
    />
  );
  return { onMove };
}

describe('StatCard', () => {
  it('should call an unbounded, formula-less stat invested', () => {
    renderCard();

    expect(screen.getByText('Invested')).toBeDefined();
    expect(screen.getByText('Counts toward total')).toBeDefined();
    expect(screen.queryByText('Resource')).toBeNull();
    expect(screen.getByText(/Invested — its value is the points put into it/)).toBeDefined();
  });

  it('should call a stat with a formula derived, and show the formula', () => {
    renderCard({ formula: 'STR / 10', countsTowardTotal: false });

    // A formula is the whole distinction — there is no second flag to disagree with it
    expect(screen.getByText('Derived')).toBeDefined();
    expect(screen.queryByText('Invested')).toBeNull();
    expect(screen.queryByText('Counts toward total')).toBeNull();
    expect(screen.getByText('STR / 10')).toBeDefined();
  });

  it('should name every bound the stat carries, and none it does not', () => {
    renderCard({ isResource: true, min: 0, max: 30, rounding: 'down' });

    expect(screen.getByText('Resource')).toBeDefined();
    expect(screen.getByText('Min 0')).toBeDefined();
    expect(screen.getByText('Max 30')).toBeDefined();
    expect(screen.getByText('Round down')).toBeDefined();
  });

  it('should say nothing about rounding when there is none', () => {
    renderCard({ rounding: 'none' });

    expect(screen.queryByText(/^Round /)).toBeNull();
  });

  it('should report a move in the direction asked for', () => {
    const { onMove } = renderCard();

    fireEvent.click(screen.getByRole('button', { name: 'Move Strength up' }));
    fireEvent.click(screen.getByRole('button', { name: 'Move Strength down' }));

    expect(onMove.mock.calls).toEqual([
      ['str-id', -1],
      ['str-id', 1],
    ]);
  });

  it('should not offer a move that would do nothing', () => {
    renderCard({}, { canMoveUp: false });

    expect(screen.getByRole('button', { name: 'Move Strength up' })).toHaveProperty(
      'disabled',
      true
    );
  });

  it('should compute nothing — the formula is shown, not evaluated (TICKET-FORM-08)', () => {
    renderCard({ formula: 'STR * 10' });

    // The card would once have rendered "100" beside a sample box; the preview lives in the
    // dialog now, and one preview in one place is what stops the two wirings drifting
    expect(screen.getByText('STR * 10')).toBeDefined();
    expect(screen.queryByRole('spinbutton')).toBeNull();
    expect(screen.queryByText('100')).toBeNull();
  });
});
