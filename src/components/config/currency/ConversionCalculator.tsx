/**
 * Conversion Calculator
 * 
 * Preview component showing currency conversion examples.
 */

import { useState } from 'react';
import type { CurrencyTier } from '../../../types';
import { Card } from '../../ui/Card/Card';
import { Text } from '../../ui/Text/Text';
import { Input } from '../../ui/Input/Input';
import { Label } from '../../ui/Label/Label';
import { Select } from '../../ui/Select/Select';

interface ConversionCalculatorProps {
  tiers: CurrencyTier[];
}

export function ConversionCalculator({ tiers }: ConversionCalculatorProps) {
  const [amount, setAmount] = useState<number>(1);
  const [fromTierId, setFromTierId] = useState<string>(tiers[0]?.id || '');

  if (tiers.length === 0) {
    return null;
  }

  const fromTier = tiers.find(t => t.id === fromTierId);
  if (!fromTier) return null;

  // Calculate conversions to all other tiers
  const conversions = tiers.map(toTier => {
    if (toTier.id === fromTier.id) {
      return { tier: toTier, amount };
    }

    let convertedAmount = amount;
    
    // Convert up (to higher value tiers)
    if (toTier.order > fromTier.order) {
      for (let i = fromTier.order; i < toTier.order; i++) {
        const currentTier = tiers.find(t => t.order === i);
        if (currentTier) {
          convertedAmount = convertedAmount / currentTier.conversionToNext;
        }
      }
    }
    
    // Convert down (to lower value tiers)
    if (toTier.order < fromTier.order) {
      for (let i = toTier.order; i < fromTier.order; i++) {
        const currentTier = tiers.find(t => t.order === i);
        if (currentTier) {
          convertedAmount = convertedAmount * currentTier.conversionToNext;
        }
      }
    }

    return { tier: toTier, amount: convertedAmount };
  });

  return (
    <Card className="p-6">
      <Text variant="h5" as="h3" className="mb-4">Conversion Calculator</Text>
      
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div>
          <Label htmlFor="calc-amount">Amount</Label>
          <Input
            id="calc-amount"
            type="number"
            value={amount}
            onChange={(e) => setAmount(Number(e.target.value) || 0)}
            min={0}
            className="w-full mt-1"
          />
        </div>
        
        <div>
          <Label htmlFor="calc-from">From Tier</Label>
          <Select
            id="calc-from"
            value={fromTierId}
            onChange={(e) => setFromTierId(e.target.value)}
            className="w-full mt-1"
          >
            {tiers.map(tier => (
              <option key={tier.id} value={tier.id}>
                {tier.name}
              </option>
            ))}
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        <Text variant="body-small" className="text-ink-600 mb-2">
          Conversions:
        </Text>
        {conversions.map(({ tier, amount: convertedAmount }) => (
          <div key={tier.id} className="flex justify-between items-center py-2 border-b border-stone-200 last:border-0">
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
