/**
 * Stat Editor
 *
 * One resource pool: where it stands against its calculated maximum, and every way a Player moves
 * it at the table. The maximum is derived and read-only; the current value is the one thing on a
 * character a Player edits directly.
 *
 * The cap at the maximum (Requirement 14.3) and the allowance for negatives (Requirement 14.4) are
 * enforced in the store action, not here — this component reports what was asked for and renders
 * whatever came back. **No arithmetic on a pool happens in this file**: the steppers and the quick
 * entry both send a *delta*, and "to full" sends no number at all.
 *
 * Since TICKET-STAT-03 a resource is preceded on the sheet by its own `SkillBreakdownRow`, which
 * carries the maximum and, when the formula behind it fails, the FORM-06 chip explaining why. So
 * this row states the maximum in words rather than chipping the same error a second line down.
 *
 * TICKET-RES-03 added the three pool behaviours Concept 20 describes: **commit on blur or Enter**
 * rather than per keystroke, **relative quick entry** (`-7`, `+12`), and the **over-maximum flag** —
 * a pool left above a maximum that fell is kept and marked, never rewritten.
 *
 * **Validates: Concept 20; Requirements 14.1, 14.2, 14.3, 14.4, 16.6, 21.1-21.5**
 */

import { useId } from 'react';
import { Button } from '../../ui/Button/Button';
import { Input } from '../../ui/Input/Input';
import { Label } from '../../ui/Label/Label';
import { Text } from '../../ui/Text/Text';
import type { DerivedValue } from '../shared/derivedValue';
import { useNumericDraft } from '../shared/useNumericDraft';

export interface StatEditorProps {
  name: string;
  current: number;
  max: DerivedValue;
  /** Whether the stored current sits above the calculated maximum (TICKET-RES-03) */
  isOverMax: boolean;
  /** Set the pool to an absolute value */
  onChange: (value: number) => void;
  /** Move the pool by an amount — the steppers and `+12` / `-7` quick entry */
  onAdjust: (delta: number) => void;
  /** Fill the pool to its calculated maximum */
  onResetToMax: () => void;
}

export function StatEditor({
  name,
  current,
  max,
  isOverMax,
  onChange,
  onAdjust,
  onResetToMax,
}: StatEditorProps) {
  const inputId = useId();

  const draft = useNumericDraft(
    current,
    (entry) => {
      if (entry.kind === 'relative') {
        onAdjust(entry.delta);
        return;
      }
      onChange(entry.value);
    },
    { allowRelative: true }
  );

  return (
    <div className="flex flex-wrap items-center gap-3 border-b border-stone-200 py-2 last:border-b-0">
      <Label htmlFor={inputId} className="w-40 shrink-0">
        {name}
      </Label>

      <Button
        variant="secondary"
        size="sm"
        aria-label={`Decrease ${name}`}
        onClick={() => onAdjust(-1)}
      >
        −
      </Button>

      {/* Not `type="number"`: a browser number input rejects `+12` outright, and the leading sign
          is exactly what tells a quick entry apart from an absolute one */}
      <Input
        id={inputId}
        type="text"
        inputMode="numeric"
        value={draft.value}
        onChange={(event) => draft.handleChange(event.target.value)}
        onBlur={draft.handleBlur}
        onKeyDown={draft.handleKeyDown}
        className="w-24"
      />

      <Button
        variant="secondary"
        size="sm"
        aria-label={`Increase ${name}`}
        // With no calculated maximum there is no ceiling to stop at, so the control stays usable
        disabled={max.value !== null && current >= max.value}
        onClick={() => onAdjust(1)}
      >
        +
      </Button>

      <Button
        variant="secondary"
        size="sm"
        aria-label={`Restore ${name} to full`}
        // Nothing to fill to when the formula behind the maximum failed
        disabled={max.value === null || current >= max.value}
        onClick={onResetToMax}
      >
        To full
      </Button>

      <Text variant={isOverMax ? 'error' : 'body-small-secondary'} as="span">
        {max.error !== null ? 'maximum unavailable' : `of ${max.value} max`}
      </Text>

      {isOverMax && (
        <Text variant="error" as="span">
          {`Above the current maximum of ${max.value} — kept as tracked; the next edit will clamp.`}
        </Text>
      )}
    </div>
  );
}
