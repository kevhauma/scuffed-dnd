/**
 * Conversion Calculator
 *
 * Preview component showing currency conversion examples. The arithmetic belongs to
 * `engine/currency.ts`; this only picks the inputs and renders what comes back.
 *
 * **Validates: Requirements 10.5, 21.1-21.5**
 */

import { useId, useState } from 'react';
import { convertCurrency } from '#shared/engine/currency';
import type { CurrencyTier } from '#shared/types';
import { Card } from '../../ui/Card/Card';
import { Input } from '../../ui/Input/Input';
import { Label } from '../../ui/Label/Label';
import { Select } from '../../ui/Select/Select';
import { Text } from '../../ui/Text/Text';

interface ConversionCalculatorProps {
  tiers: CurrencyTier[];
}

export function ConversionCalculator({ tiers }: ConversionCalculatorProps) {
  const calcAmountId = useId();
  const calcFromId = useId();

  const [amount, setAmount] = useState<number>(1);
  const [fromTierId, setFromTierId] = useState<string>(tiers[0]?.id || '');

  if (tiers.length === 0) {
    return null;
  }

  const fromTier = tiers.find((t) => t.id === fromTierId);
  if (!fromTier) return null;

  // Conversions to every other tier — the engine owns the arithmetic
  const conversions = tiers.map((toTier) => ({
    tier: toTier,
    amount: convertCurrency({ tierId: fromTier.id, amount }, toTier.id, tiers).amount,
  }));

  return (
    <Card className="p-6">
      <Text variant="h5" as="h3" className="mb-4">
        Conversion Calculator
      </Text>

      <div className="grid grid-cols-2 gap-4 mb-4">
        <div>
          <Label htmlFor={calcAmountId}>Amount</Label>
          <Input
            id={calcAmountId}
            type="number"
            value={amount}
            onChange={(e) => setAmount(Number(e.target.value) || 0)}
            min={0}
            className="w-full mt-1"
          />
        </div>

        <div>
          <Label htmlFor={calcFromId}>From Tier</Label>
          <Select
            id={calcFromId}
            value={fromTierId}
            onChange={(e) => setFromTierId(e.target.value)}
            options={tiers.map((tier) => ({ value: tier.id, label: tier.name }))}
            className="w-full mt-1"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Text variant="body-small" className="text-ink-600 mb-2">
          Conversions:
        </Text>
        {conversions.map(({ tier, amount: convertedAmount }) => (
          <div
            key={tier.id}
            className="flex justify-between items-center py-2 border-b border-stone-200 last:border-0"
          >
            <Text variant="body">{tier.name}</Text>
            <Text variant="body" className="font-mono">
              {convertedAmount.toFixed(2)}
            </Text>
          </div>
        ))}
      </div>
    </Card>
  );
}
