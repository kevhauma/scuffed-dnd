/**
 * Experience Control
 *
 * Award or deduct experience by a **relative** amount, one action per click — the shape the sheet's
 * own `exp.gs` has (Concept 20, TICKET-RES-01). Relative rather than absolute because that is what
 * happens at a table: a session awards 300, it does not set the total to 1700, and asking a Player
 * to do that subtraction is how totals drift.
 *
 * The control decides nothing. What counts as a legal amount, and whether a deduction would take a
 * character below zero, belongs to the store action — this reads a number and calls it.
 *
 * **Validates: Concept 20; Requirements 21.1-21.5**
 */

import { useId, useState } from 'react';
import { Button } from '../../ui/Button/Button';
import { Input } from '../../ui/Input/Input';
import { Label } from '../../ui/Label/Label';

export interface ExperienceControlProps {
  onAward: (amount: number) => void;
  onDeduct: (amount: number) => void;
}

export function ExperienceControl({ onAward, onDeduct }: ExperienceControlProps) {
  const [amount, setAmount] = useState('');
  const amountId = useId();

  const parsed = Number(amount);
  // The buttons are disabled on anything the store would refuse anyway, so a click always does
  // something — the refusal stays in the store as the rule, this is just not offering a dead button
  const isActionable = amount.trim() !== '' && Number.isFinite(parsed) && parsed > 0;

  const apply = (action: (value: number) => void) => {
    if (!isActionable) return;
    action(parsed);
    setAmount('');
  };

  return (
    <div className="mt-4 flex flex-wrap items-end gap-3 border-t border-stone-200 pt-4">
      <div>
        <Label htmlFor={amountId}>Experience</Label>
        <Input
          id={amountId}
          type="number"
          min="0"
          placeholder="Amount"
          value={amount}
          onChange={(event) => setAmount(event.target.value)}
          className="w-32"
        />
      </div>
      <Button variant="primary" disabled={!isActionable} onClick={() => apply(onAward)}>
        Award XP
      </Button>
      <Button variant="secondary" disabled={!isActionable} onClick={() => apply(onDeduct)}>
        Deduct XP
      </Button>
    </div>
  );
}
