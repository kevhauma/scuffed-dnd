/**
 * Adjustment Field
 *
 * One number the Dungeon Master types and one button that sends it (TICKET-DM-01). The level, the
 * point grant and each resource pool are the same control with a different label, so they are the
 * same component — three callers, which is where the house rule says to share one. TICKET-RES-04
 * added dream level as the fourth, on this panel and on the Player's own header.
 *
 * **It lives in `play/shared/` rather than `play/dm/` because of that fourth caller**: the moment
 * `SheetHeader` needed it, `sheet/` and `dm/` would have imported each other, and a shared control
 * with callers on both sides belongs beside the other things both sides read
 * (`CharacterSummaryLine`, `PointBudgetSummary`). Moved at RES-04's closeout review.
 *
 * **It decides nothing.** Whether a level is priceable, whether a revocation would leave the
 * character overspent and where a pool may stand are the Kernel's answers, reached through a store
 * action; this reads a number and calls it. The only thing it refuses is an empty or non-numeric
 * box, and that is *not offering a dead button* rather than a rule — `ExperienceControl`'s
 * precedent, beside it on the same panel.
 *
 * **Validates: v3 Req 42.2, 42.3, 42.5; Requirements 21.1-21.5**
 */

import { useId, useState } from 'react';
import { Button } from '../../ui/Button/Button';
import { Input } from '../../ui/Input/Input';
import { Label } from '../../ui/Label/Label';
import { Text } from '../../ui/Text/Text';

export interface AdjustmentFieldProps {
  label: string;
  /** What the button says — the act, in the DM's words */
  actionLabel: string;
  /** Where the value stands now, said beside the box rather than pre-filled into it */
  current: string;
  /**
   * The lowest value the control offers, or nothing for a field with no floor
   *
   * A hint to the browser's stepper, never the rule: the store owns whether a value is allowed, and
   * a resource pool has no floor at all because it may go negative (Requirement 14.4).
   */
  min?: number;
  /**
   * True while a write is on the wire, so nothing can be sent twice
   *
   * **Optional, and absent means never busy**, since TICKET-RES-04 put this control on the local
   * sheet too: a LocalStorage write is synchronous and has no in-flight state to guard, so requiring
   * the prop there would only ever be a `false` typed at the call site.
   */
  isBusy?: boolean;
  onSubmit: (value: number) => void;
}

export function AdjustmentField({
  label,
  actionLabel,
  current,
  min,
  isBusy = false,
  onSubmit,
}: AdjustmentFieldProps) {
  const [entry, setEntry] = useState('');
  const fieldId = useId();

  const parsed = Number(entry);
  const isActionable = entry.trim() !== '' && Number.isFinite(parsed);

  const send = () => {
    if (!isActionable || isBusy) return;

    onSubmit(parsed);
    setEntry('');
  };

  return (
    <div className="flex flex-wrap items-end gap-3">
      <div>
        <Label htmlFor={fieldId}>{label}</Label>
        <Input
          id={fieldId}
          type="number"
          min={min}
          value={entry}
          onChange={(event) => setEntry(event.target.value)}
          // Enter is how a number gets committed everywhere else on this sheet (TICKET-RES-03), and
          // a panel where it did nothing would be the one place it does not
          onKeyDown={(event) => {
            if (event.key === 'Enter') send();
          }}
          className="w-28"
        />
      </div>

      <Button variant="secondary" disabled={!isActionable || isBusy} onClick={send}>
        {actionLabel}
      </Button>

      <Text variant="body-small-secondary" as="span" className="pb-2">
        {current}
      </Text>
    </div>
  );
}
