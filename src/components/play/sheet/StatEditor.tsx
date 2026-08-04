/**
 * Stat Editor
 *
 * One stat's current value against its calculated maximum, with controls to change the current
 * value during play. The maximum is derived and read-only; the current value is the one thing on a
 * character a Player edits directly.
 *
 * The cap at the maximum (Requirement 14.3) and the allowance for negatives (Requirement 14.4) are
 * enforced in the store action, not here — this component reports the requested value and renders
 * whatever came back.
 *
 * **Validates: Requirements 14.1, 14.2, 16.6, 21.1-21.5**
 */

import { useId, useState } from 'react';
import { Button } from '../../ui/Button/Button';
import { ErrorChip } from '../../ui/ErrorChip/ErrorChip';
import { Input } from '../../ui/Input/Input';
import { Label } from '../../ui/Label/Label';
import { Text } from '../../ui/Text/Text';
import type { DerivedValue } from './useCharacterSheet';

export interface StatEditorProps {
  name: string;
  current: number;
  max: DerivedValue;
  onChange: (value: number) => void;
}

export function StatEditor({ name, current, max, onChange }: StatEditorProps) {
  const inputId = useId();

  /**
   * What the Player has typed but not finished, e.g. `""` or `"-"` on the way to `-5`.
   * `null` means "show the stored value", which is what happens again as soon as they leave.
   */
  const [draft, setDraft] = useState<string | null>(null);

  const handleChange = (raw: string) => {
    setDraft(raw);

    const parsed = Number.parseInt(raw, 10);
    if (Number.isNaN(parsed)) return;

    onChange(parsed);
  };

  return (
    <div className="flex flex-wrap items-center gap-3 border-b border-stone-200 py-2 last:border-b-0">
      <Label htmlFor={inputId} className="w-40 shrink-0">
        {name}
      </Label>

      <Button
        variant="secondary"
        size="sm"
        aria-label={`Decrease ${name}`}
        onClick={() => onChange(current - 1)}
      >
        −
      </Button>

      <Input
        id={inputId}
        type="number"
        max={max.value ?? undefined}
        value={draft ?? current}
        onChange={(event) => handleChange(event.target.value)}
        onBlur={() => setDraft(null)}
        className="w-24"
      />

      <Button
        variant="secondary"
        size="sm"
        aria-label={`Increase ${name}`}
        // With no calculated maximum there is no ceiling to stop at, so the control stays usable
        disabled={max.value !== null && current >= max.value}
        onClick={() => onChange(current + 1)}
      >
        +
      </Button>

      {max.error !== null ? (
        <ErrorChip label="max unavailable" detail={max.error} />
      ) : (
        <Text variant="body-small-secondary" as="span">
          of {max.value} max
        </Text>
      )}
    </div>
  );
}
