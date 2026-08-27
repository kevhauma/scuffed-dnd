/**
 * Purse Section Tests (TICKET-CUR-02)
 *
 * Three claims, and the middle one is the ticket's whole argument for a single stored amount:
 *
 * 1. The amount is rendered through the **engine**, in the tier it reads best in.
 * 2. **Retuning the ruleset's rates changes the display and not the stored number** — which a
 *    per-tier wallet could not do, because there its numbers *are* the denominations.
 * 3. A ruleset with no currency shows a bare number rather than erroring or hiding the purse.
 *
 * **Validates: Concept 16; Concept 20; v3 Req 43.1, 43.2; Requirements 10.4**
 */

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { CurrencyTier } from '#shared/types/config';
import { PurseSection } from './PurseSection';

/** 100 copper = 1 silver, 10 silver = 1 gold */
const tiers: CurrencyTier[] = [
  { id: 'copper', name: 'Copper', order: 0, conversionToNext: 100 },
  { id: 'silver', name: 'Silver', order: 1, conversionToNext: 10 },
  { id: 'gold', name: 'Gold', order: 2, conversionToNext: 1 },
];

function renderPurse(purse: number, currency: CurrencyTier[] = tiers) {
  const onSet = vi.fn();
  const onAdjust = vi.fn();

  render(<PurseSection tiers={currency} purse={purse} onSet={onSet} onAdjust={onAdjust} />);

  return { onSet, onAdjust };
}

describe('PurseSection', () => {
  it('reads the amount in the tier it makes most sense in', () => {
    renderPurse(2500);

    expect(screen.getByText('2.5 Gold')).toBeDefined();
  });

  it('labels the box with the tier the number is actually stored in', () => {
    // The box edits the base tier, so that is what it is labelled with — a box saying *Gold* over a
    // number in copper is the confusion this whole shape exists to avoid
    renderPurse(2500);

    expect(screen.getByLabelText('Copper')).toBeDefined();
  });

  it('changes what it displays when the ruleset does, with the same stored number', () => {
    const cheaperGold: CurrencyTier[] = [
      { id: 'copper', name: 'Copper', order: 0, conversionToNext: 10 },
      { id: 'silver', name: 'Silver', order: 1, conversionToNext: 10 },
      { id: 'gold', name: 'Gold', order: 2, conversionToNext: 1 },
    ];

    renderPurse(2500, cheaperGold);

    expect(screen.getByText('25 Gold')).toBeDefined();
  });

  it('shows a bare number for a ruleset that defines no currency', () => {
    // TICKET-CUR-02's fifth criterion — a ruleset may define no currency as it may define no races,
    // and refusing to show a Player their own money because of it would be the wrong way round
    renderPurse(340, []);

    expect(screen.getByText('340')).toBeDefined();
    expect(screen.getByLabelText('Amount')).toBeDefined();
  });

  it('sets an absolute amount on blur', () => {
    const { onSet, onAdjust } = renderPurse(40);

    const input = screen.getByLabelText('Copper');
    fireEvent.change(input, { target: { value: '120' } });
    fireEvent.blur(input);

    expect(onSet).toHaveBeenCalledWith(120);
    expect(onAdjust).not.toHaveBeenCalled();
  });

  it('reads a leading + or - as an amount to move by, not a number to become', () => {
    // Concept 20's quick entry, through `useNumericDraft`'s `allowRelative` rather than a second
    // parser — selling a shield is `+340`, not three hundred and forty presses
    const { onSet, onAdjust } = renderPurse(40);

    const input = screen.getByLabelText('Copper');
    fireEvent.change(input, { target: { value: '+340' } });
    fireEvent.blur(input);

    expect(onAdjust).toHaveBeenCalledWith(340);
    expect(onSet).not.toHaveBeenCalled();

    fireEvent.change(input, { target: { value: '-12' } });
    fireEvent.blur(input);

    expect(onAdjust).toHaveBeenLastCalledWith(-12);
  });

  it('commits nothing per keystroke, so typing 340 cannot persist a 3', () => {
    const { onSet } = renderPurse(0);

    fireEvent.change(screen.getByLabelText('Copper'), { target: { value: '3' } });
    fireEvent.change(screen.getByLabelText('Copper'), { target: { value: '34' } });
    fireEvent.change(screen.getByLabelText('Copper'), { target: { value: '340' } });

    expect(onSet).not.toHaveBeenCalled();

    fireEvent.blur(screen.getByLabelText('Copper'));

    expect(onSet).toHaveBeenCalledExactlyOnceWith(340);
  });
});
