/**
 * Wallet Section
 *
 * What the character is carrying in coin, one row per configured currency tier — the sheet's own
 * purse (`Charactersheet!Q18:S23`, beside the equipment boxes, which is why this sits in the same
 * rail).
 *
 * The app had currency tiers in the ruleset and nowhere on a character to hold any, so a ruleset
 * could define gold, silver and copper and a Player could never own a coin. This is that gap.
 *
 * **Amounts are stored per tier, exactly as entered.** 15 silver stays 15 silver; the store never
 * rolls it up. The *total* line underneath is where `normalizeCurrency` runs, because how much
 * money this is altogether is a question with one right answer, and which coins it is made of is
 * the Player's business. Both come from `engine/currency.ts` — this component does no arithmetic.
 *
 * **Validates: Concept 16; Requirements 10.4, 10.5, 21.1-21.5**
 */

import { convertCurrency, formatCurrency, normalizeCurrency } from '../../../engine/currency';
import type { CurrencyTier } from '../../../types/config';
import { Card } from '../../ui/Card/Card';
import { Text } from '../../ui/Text/Text';
import { CoinRow } from './CoinRow';

export interface WalletSectionProps {
  /** The ruleset's tiers, in the order the User arranged them */
  tiers: CurrencyTier[];
  /** What is held in each, keyed by tier id; a tier absent from it holds nothing */
  wallet: Record<string, number>;
  onChangeAmount: (tierId: string, amount: number) => void;
}

/**
 * Everything in the purse, expressed in the largest tier it still reads sensibly in
 *
 * Every holding is converted down to the lowest tier, added, then normalised back up — a purse of
 * 3 gold and 40 copper is one amount of money, not two. The walking of the rates is
 * `convertCurrency`'s job and stays there: a second implementation of "how many coppers is a gold"
 * in a component is exactly the drift the engine exists to prevent.
 */
function walletTotal(
  tiers: CurrencyTier[],
  wallet: Record<string, number>
): { kind: 'total'; text: string } | { kind: 'empty' } | { kind: 'unconvertible' } {
  const ordered = [...tiers].sort((a, b) => a.order - b.order);
  const lowest = ordered[0];
  if (!lowest) return { kind: 'empty' };

  const held = tiers
    .map((tier) => ({ tierId: tier.id, amount: wallet[tier.id] ?? 0 }))
    .filter((value) => value.amount > 0);

  if (held.length === 0) return { kind: 'empty' };

  // Every tier but the topmost needs a rate to the one above it, or there is no such thing as
  // "what this is worth altogether".
  //
  // This is not hypothetical: the Ducklets ruleset has `conversionToNext: 0` on all five tiers,
  // because the source sheet has no exchange rates at all and the corpus refuses to invent them.
  // Totalling anyway produced "58 Platinum" for three gold and fifty-five copper, which is worse
  // than no total — it is a wrong one, in the app's own voice. So the gap is stated instead.
  const convertible = ordered
    .slice(0, -1)
    .every((tier) => Number.isFinite(tier.conversionToNext) && tier.conversionToNext > 0);

  if (!convertible) return { kind: 'unconvertible' };

  const inLowest = held.reduce(
    (sum, value) => sum + convertCurrency(value, lowest.id, tiers).amount,
    0
  );

  return {
    kind: 'total',
    text: formatCurrency(normalizeCurrency({ tierId: lowest.id, amount: inLowest }, tiers), tiers),
  };
}

export function WalletSection({ tiers, wallet, onChangeAmount }: WalletSectionProps) {
  if (tiers.length === 0) return null;

  // Highest denomination first, the way a purse is counted and the way the sheet lists it
  const ordered = [...tiers].sort((a, b) => b.order - a.order);
  const total = walletTotal(tiers, wallet);

  return (
    <Card className="p-6">
      <Text variant="h4" as="h2" className="mb-3">
        Wallet
      </Text>

      {ordered.map((tier) => (
        <CoinRow
          key={tier.id}
          tier={tier}
          amount={wallet[tier.id] ?? 0}
          onChange={(amount) => onChangeAmount(tier.id, amount)}
        />
      ))}

      <div className="mt-3 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-t border-ink-700/20 pt-3">
        <Text variant="body-small-secondary" as="span">
          Worth
        </Text>
        {total.kind === 'total' && (
          <Text variant="highlight" as="span">
            {total.text}
          </Text>
        )}
        {total.kind === 'empty' && (
          <Text variant="body-small-secondary" as="span">
            empty
          </Text>
        )}
        {total.kind === 'unconvertible' && (
          <Text variant="body-small-secondary" as="span">
            this ruleset sets no exchange rates
          </Text>
        )}
      </div>
    </Card>
  );
}
