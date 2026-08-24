/**
 * Blocked Delete Dialog Tests
 *
 * **Validates: Concept 00 §6; Requirements 2.5, 2.6**
 */

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { BlockedDeleteDialog } from './BlockedDeleteDialog';
import type { BlockedDelete } from './useGuardedDelete';

function createBlocked(overrides: Partial<BlockedDelete> = {}): BlockedDelete {
  return {
    label: 'Main skill STR',
    references: [
      { holderKind: 'Stat', holderName: 'Health', field: 'formula', holderId: 'id-hp' },
      { holderKind: 'Character', holderName: 'Aria', field: 'skill levels', holderId: 'char1' },
    ],
    force: vi.fn(),
    ...overrides,
  };
}

describe('BlockedDeleteDialog', () => {
  it('renders every reference the action returned', () => {
    render(<BlockedDeleteDialog blocked={createBlocked()} onClose={vi.fn()} />);

    expect(screen.getByText(/Main skill STR cannot be deleted/)).toBeDefined();
    expect(screen.getByText(/Stat: Health/)).toBeDefined();
    expect(screen.getByText(/Character: Aria/)).toBeDefined();
    expect(screen.getByText('(formula)')).toBeDefined();
    expect(screen.getByText('(skill levels)')).toBeDefined();
  });

  it('stays closed when nothing was refused', () => {
    render(<BlockedDeleteDialog blocked={null} onClose={vi.fn()} />);

    expect(screen.queryByText('Still In Use')).toBeNull();
  });

  it('closes on cancel without forcing', () => {
    const blocked = createBlocked();
    const onClose = vi.fn();
    render(<BlockedDeleteDialog blocked={blocked} onClose={onClose} />);

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(blocked.force).not.toHaveBeenCalled();
  });

  it('forces the delete when the User insists', () => {
    const blocked = createBlocked();
    render(<BlockedDeleteDialog blocked={blocked} onClose={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: 'Delete Anyway' }));

    expect(blocked.force).toHaveBeenCalledTimes(1);
  });
});
