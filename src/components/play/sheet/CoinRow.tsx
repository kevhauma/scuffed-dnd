/**
 * Coin Row
 *
 * One currency tier's holding, with the box to change it.
 *
 * A number field rather than the stepper the stats use, because money moves in amounts nobody
 * wants to click for: selling a shield is `+340`, not three hundred and forty presses. It takes
 * relative entry for exactly that reason — `+50` and `-12` against what is already there — which
 * is Concept 20's quick entry, the same behaviour a resource pool has.
 *
 * The entry commits on blur or Enter, never per keystroke, so typing `340` cannot persist a `3`
 * and then a `34` on the way (TICKET-RES-03).
 *
 * **Validates: Concept 16; Concept 20; Requirements 10.4, 21.1-21.5**
 */

import { useId } from 'react';
import type { CurrencyTier } from '../../../types/config';
import { Input } from '../../ui/Input/Input';
import { Label } from '../../ui/Label/Label';
import { useNumericDraft } from '../shared/useNumericDraft';

export interface CoinRowProps {
  tier: CurrencyTier;
  amount: number;
  onChange: (amount: number) => void;
}

export function CoinRow({ tier, amount, onChange }: CoinRowProps) {
  const inputId = useId();

  const draft = useNumericDraft(
    amount,
    (entry) => {
      onChange(entry.kind === 'relative' ? amount + entry.delta : entry.value);
    },
    { allowRelative: true }
  );

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-ink-700/15 py-2 last:border-b-0">
      <Label htmlFor={inputId}>{tier.name}</Label>

      <Input
        id={inputId}
        type="text"
        inputMode="decimal"
        value={draft.value}
        onChange={(event) => draft.handleChange(event.target.value)}
        onBlur={draft.handleBlur}
        onKeyDown={draft.handleKeyDown}
        className="w-28 text-right"
      />
    </div>
  );
}
