/**
 * Wallet Section Tests
 *
 * Mostly about the total, which is the only number this component decides anything about — and the
 * one that was quietly wrong before the exchange-rate guard went in.
 */

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { CurrencyTier } from '../../../types/config';
import { WalletSection } from './WalletSection';

/** Copper → silver → gold at ten to one, the shape a ruleset with rates has */
const RATED: CurrencyTier[] = [
  { id: 'copper', name: 'Copper', order: 0, conversionToNext: 10 },
  { id: 'silver', name: 'Silver', order: 1, conversionToNext: 10 },
  { id: 'gold', name: 'Gold', order: 2, conversionToNext: 0 },
];

/** What the Ducklets sheet actually has: tiers, and no rates between them at all */
const UNRATED: CurrencyTier[] = RATED.map((tier) => ({ ...tier, conversionToNext: 0 }));

const worth = () =>
  screen.getByText('Worth').parentElement?.textContent?.replace('Worth', '').trim();

describe('WalletSection', () => {
  it('should render nothing at all when the ruleset defines no currency', () => {
    const { container } = render(<WalletSection tiers={[]} wallet={{}} onChangeAmount={vi.fn()} />);

    expect(container.firstChild).toBeNull();
  });

  it('should list the tiers highest first, the way a purse is counted', () => {
    render(<WalletSection tiers={RATED} wallet={{}} onChangeAmount={vi.fn()} />);

    const labels = screen.getAllByText(/Copper|Silver|Gold/).map((node) => node.textContent);
    expect(labels).toEqual(['Gold', 'Silver', 'Copper']);
  });

  it('should say the purse is empty rather than showing a zero', () => {
    render(<WalletSection tiers={RATED} wallet={{}} onChangeAmount={vi.fn()} />);

    expect(worth()).toBe('empty');
  });

  it('should total across tiers through the engine', () => {
    render(
      <WalletSection tiers={RATED} wallet={{ gold: 3, copper: 40 }} onChangeAmount={vi.fn()} />
    );

    // 3 gold = 300 copper, plus 40 = 340 copper, normalised up to 3.4 gold
    expect(worth()).toBe('3.4 Gold');
  });

  it('should refuse to total a ruleset that sets no exchange rates', () => {
    // The regression this test exists for: with every rate at 0 — which is exactly what the
    // Ducklets corpus has, because the source sheet has no rates and the corpus will not invent
    // them — the total came out as "58 Platinum" for three gold and fifty-five copper. A wrong
    // number in the app's own voice is worse than no number.
    render(
      <WalletSection tiers={UNRATED} wallet={{ gold: 3, copper: 55 }} onChangeAmount={vi.fn()} />
    );

    expect(worth()).toBe('this ruleset sets no exchange rates');
  });

  it('should still hold and show the coins when there are no rates', () => {
    // The gap is in *converting* between tiers, not in owning any
    render(<WalletSection tiers={UNRATED} wallet={{ gold: 3 }} onChangeAmount={vi.fn()} />);

    expect((screen.getByLabelText('Gold') as HTMLInputElement).value).toBe('3');
  });

  it('should commit an amount on blur, not per keystroke', () => {
    const onChangeAmount = vi.fn();
    render(<WalletSection tiers={RATED} wallet={{}} onChangeAmount={onChangeAmount} />);

    const gold = screen.getByLabelText('Gold');
    fireEvent.change(gold, { target: { value: '1' } });
    fireEvent.change(gold, { target: { value: '12' } });

    expect(onChangeAmount).not.toHaveBeenCalled();

    fireEvent.blur(gold);

    expect(onChangeAmount).toHaveBeenCalledExactlyOnceWith('gold', 12);
  });

  it('should take a relative entry against what is already held', () => {
    // Selling a shield is `+340`, not three hundred and forty presses — Concept 20's quick entry
    const onChangeAmount = vi.fn();
    render(<WalletSection tiers={RATED} wallet={{ gold: 8 }} onChangeAmount={onChangeAmount} />);

    const gold = screen.getByLabelText('Gold');
    fireEvent.change(gold, { target: { value: '+5' } });
    fireEvent.blur(gold);

    expect(onChangeAmount).toHaveBeenCalledExactlyOnceWith('gold', 13);
  });
});
