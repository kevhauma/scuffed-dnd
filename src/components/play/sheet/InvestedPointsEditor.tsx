/**
 * Invested Points Editor
 *
 * One invested stat's spent points, with the controls to spend more of the pool a character's
 * level grants them (TICKET-RES-02). This is the level-up mechanic: there is no separate wizard,
 * because unspent points simply remain spendable and the sheet is where a Player already is when
 * they gain a level.
 *
 * The budget check lives in the store action, not here — this row reports the requested number and
 * renders whatever came back, the same contract `StatEditor` has for current values. A control that
 * cannot do anything is **disabled** rather than left live and silently refused: `+` when nothing
 * remains, `−` at zero, and every control when the pool could not be priced at all (the store
 * refuses every write in that state, so a live box would be a lie).
 *
 * The entry commits on blur or Enter, never per keystroke. That distinction matters more here than
 * on `StatEditor`: `updateCurrentStatValue` **clamps**, so an intermediate commit lands on the value
 * the store would have reached anyway, but `setInvestedStatPoints` **refuses** — so typing `20` over
 * a `6` used to persist the `2` on the way past and then refuse the `20`, leaving four points
 * silently unspent. Found by the `conventions-reviewer` on TICKET-RES-02 and fixed in the shared
 * hook, so both editors get it.
 *
 * The label is `Points in <stat>` rather than the bare stat name, because a resource stat renders
 * this row *and* the `StatEditor` — two number boxes one above the other, and two controls both
 * called "Strength" is exactly the ambiguity the sheet should not have.
 *
 * **Validates: Concept 06; Requirements 11.3, 21.1-21.5**
 */

import { useId } from 'react';
import { Button } from '../../ui/Button/Button';
import { Input } from '../../ui/Input/Input';
import { Label } from '../../ui/Label/Label';
import { Text } from '../../ui/Text/Text';
import type { DerivedValue } from '../shared/derivedValue';
import { useNumericDraft } from '../shared/useNumericDraft';

export interface InvestedPointsEditorProps {
  name: string;
  /** Points already spent on this stat */
  invested: number;
  /** What is left of the whole pool, shared across every invested stat */
  pointsRemaining: DerivedValue;
  onChange: (points: number) => void;
}

export function InvestedPointsEditor({
  name,
  invested,
  pointsRemaining,
  onChange,
}: InvestedPointsEditorProps) {
  const inputId = useId();
  // No relative entry here: a pool is moved by deltas at the table, but an investment is a number
  // the Player decides on, and `-1` in this box means "one point", not "take one away"
  const draft = useNumericDraft(invested, (entry) => {
    if (entry.kind === 'absolute') onChange(entry.value);
  });

  const remaining = pointsRemaining.value;
  /** Every write is refused while the pool has no number, so nothing here is usable either */
  const canEdit = remaining !== null;
  const canSpend = canEdit && remaining > 0;

  return (
    <div className="flex flex-wrap items-center gap-3 border-b border-stone-200 py-2 last:border-b-0">
      <Label htmlFor={inputId} className="w-40 shrink-0">
        {`Points in ${name}`}
      </Label>

      <Button
        variant="secondary"
        size="sm"
        aria-label={`Remove a point from ${name}`}
        disabled={!canEdit || invested <= 0}
        onClick={() => onChange(invested - 1)}
      >
        −
      </Button>

      <Input
        id={inputId}
        type="number"
        min="0"
        disabled={!canEdit}
        value={draft.value}
        onChange={(event) => draft.handleChange(event.target.value)}
        onBlur={draft.handleBlur}
        onKeyDown={draft.handleKeyDown}
        className="w-24"
      />

      <Button
        variant="secondary"
        size="sm"
        aria-label={`Spend a point on ${name}`}
        disabled={!canSpend}
        onClick={() => onChange(invested + 1)}
      >
        +
      </Button>

      <Text variant="body-small-secondary" as="span">
        {/* The pool's own error is stated once in the section header, so this row just says it has
            no number to work from rather than repeating the explanation on every stat */}
        {pointsRemaining.error !== null
          ? 'no budget available'
          : `${invested} point${invested === 1 ? '' : 's'} invested`}
      </Text>
    </div>
  );
}
