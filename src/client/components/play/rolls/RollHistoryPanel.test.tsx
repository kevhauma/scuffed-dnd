/**
 * The roll history panel, on both of its logs (TICKET-ROLL-07)
 *
 * **The panel earns a test file because it now says two different true things.** A local
 * character's history is `useUIStore`'s in-memory list — clearable, and gone on reload by design. A
 * character at a table reads the session's **Event log** — append-only, so there is nothing to
 * clear, and permanent, so promising the opposite would be worse than saying nothing.
 *
 * One signal drives both: a panel given no `onClear` is looking at a log that is neither its to
 * clear nor its to lose. The browser check is what found the second half — the empty state was still
 * promising *"not saved between visits"* over a log that outlives the browser.
 *
 * **Validates: Requirements 15.5; v3 Req 41.6**
 */

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { RollResult } from '../../../stores/uiStore';
import { RollHistoryPanel } from './RollHistoryPanel';

function aRoll(overrides: Partial<RollResult> = {}): RollResult {
  return {
    id: 'roll-result-1',
    characterId: 'char-1',
    characterName: 'Quackers',
    rollId: 'roll-1',
    rollName: 'Melee',
    input: 11,
    dice: [{ size: 6, rolls: [1], total: 1 }],
    diceTotal: 1,
    flat: 5,
    total: 6,
    notation: '1D6 + 5',
    timestamp: '2026-08-27T00:00:00.000Z',
    ...overrides,
  };
}

describe('RollHistoryPanel', () => {
  it('shows the whole chain rather than only a total', () => {
    render(<RollHistoryPanel history={[aRoll()]} onClear={vi.fn()} />);

    expect(screen.getByText('Melee')).toBeDefined();
    expect(screen.getByText('11 → 1D6 + 5')).toBeDefined();
    expect(screen.getByText('6')).toBeDefined();
  });

  describe("a local character's history", () => {
    it('offers to clear it, and clears on request', () => {
      const onClear = vi.fn();
      render(<RollHistoryPanel history={[aRoll()]} onClear={onClear} />);

      fireEvent.click(screen.getByRole('button', { name: 'Clear History' }));

      expect(onClear).toHaveBeenCalled();
    });

    it('says the rolls are not kept, because they are not', () => {
      render(<RollHistoryPanel history={[]} onClear={vi.fn()} />);

      expect(screen.getByText(/not saved between visits/)).toBeDefined();
    });
  });

  describe("a table's log", () => {
    it('offers no way to clear it, because an Event log is append-only', () => {
      render(<RollHistoryPanel history={[aRoll()]} />);

      expect(screen.queryByRole('button', { name: 'Clear History' })).toBeNull();
    });

    it('says the rolls are kept, which is the opposite of what it used to promise', () => {
      // The browser check found this sentence still claiming the local rule over a server log
      render(<RollHistoryPanel history={[]} />);

      expect(screen.getByText(/kept for the whole game/)).toBeDefined();
      expect(screen.queryByText(/not saved between visits/)).toBeNull();
    });
  });
});
