/**
 * One quick action: a name, the amounts the ruleset suggests, and a box (TICKET-DM-03)
 *
 * [`AdjustmentField`](../shared/AdjustmentField.tsx)'s near neighbour and deliberately not it. That
 * control is *set this value to what I typed*, with the current value said beside the box; this one
 * is *do this act, this many times*, with the amounts the Snapshot suggests offered as one press.
 * Adding a `presets` prop to `AdjustmentField` for one of its five callers is the shape the house
 * rules name specifically — a prop named after a caller — so this is a second component rather than a
 * fifth branch in that one.
 *
 * **The direction is the action, not the sign of the number**, which is why the box is a plain amount
 * rather than [`useNumericDraft`](../shared/useNumericDraft.ts)'s relative entry. The ticket's to-be
 * asked for that hook; a `-5` typed into *Damage Vigor* would have to mean *restore 5*, and a control
 * where a minus sign silently reverses the act it is labelled with is a trap rather than a
 * convenience. Recorded on the ticket as a divergence rather than left to be noticed.
 *
 * **It decides nothing.** Whether an amount is allowed, whether a pool may go there and whether a
 * revocation would leave the character overspent are the Kernel's answers, reached through a store
 * action. The only thing refused here is an empty or non-numeric box, and that is *not offering a dead
 * button* rather than a rule — `AdjustmentField`'s precedent, one card over.
 *
 * Layout and composition only, on `components/ui` primitives and theme tokens.
 *
 * **Validates: v3 Req 49.4, 49.10; Requirements 21.1-21.5**
 */

import { useId, useState } from 'react';
import { Button } from '../../ui/Button/Button';
import { Input } from '../../ui/Input/Input';
import { Label } from '../../ui/Label/Label';
import type { QuickAction } from '../shared/quickActions';
import { isSendableAmount } from '../shared/quickActions';

export interface QuickActionRowProps {
  action: QuickAction;
  /** True while an adjustment is on the wire, so nothing can be sent twice */
  isBusy: boolean;
  onApply: (action: QuickAction, amount: number) => void;
}

export function QuickActionRow({ action, isBusy, onApply }: QuickActionRowProps) {
  const [entry, setEntry] = useState('');
  const fieldId = useId();

  // The same predicate `useQuickActions.send` guards with, shared rather than restated (the review's
  // finding). It already answers *no* to an empty or unparseable box, because `Number('')` is 0 and
  // `Number('abc')` is `NaN` — so there is no emptiness check here either.
  const typed = Number(entry);
  const isActionable = isSendableAmount(typed);

  const sendTyped = () => {
    if (!isActionable || isBusy) return;

    onApply(action, typed);
    setEntry('');
  };

  return (
    <div className="flex flex-col gap-1">
      <Label htmlFor={fieldId}>{action.label}</Label>

      <div className="flex flex-wrap items-center gap-2">
        {/* The amounts the ruleset itself suggests — a pool's own scale, a point, what the curve
            prices the next level at. A ruleset that supports none renders no chips and the box
            alone, which is `quickActionsFor`'s "absent rather than invented". */}
        {action.steps.map((step) => (
          <Button
            key={step}
            variant="secondary"
            size="xs"
            disabled={isBusy}
            onClick={() => onApply(action, step)}
          >
            {step}
          </Button>
        ))}

        <Input
          id={fieldId}
          type="number"
          min={1}
          value={entry}
          placeholder="amount"
          onChange={(event) => setEntry(event.target.value)}
          // Enter commits, as it does on every other number on this sheet (TICKET-RES-03)
          onKeyDown={(event) => {
            if (event.key === 'Enter') sendTyped();
          }}
          className="w-24"
        />

        <Button
          variant="secondary"
          size="xs"
          disabled={!isActionable || isBusy}
          onClick={sendTyped}
        >
          Apply
        </Button>
      </div>
    </div>
  );
}
