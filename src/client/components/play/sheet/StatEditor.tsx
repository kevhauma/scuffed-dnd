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
 * **Whether there are controls at all is the reader's** (TICKET-DM-05), `PurseSection`'s arrangement
 * one field over. The three routes behind them are all `requireCharacterPlayer`, so a Player keeps
 * them on a local sheet and at a table alike and the table's **DM** gets none — and reads where the
 * pool stands, which is what they opened the sheet for. A DM who wants a pool moved has the quick
 * actions, and this row says so rather than leaving a missing box to be read as a rendering failure.
 *
 * **Validates: Concept 20; Requirements 14.1, 14.2, 14.3, 14.4, 16.6, 21.1-21.5; v3 Req 42.7, 49.10**
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
  /**
   * Set the pool to an absolute value, or absent when this reader may only read it (TICKET-DM-05)
   *
   * **Absent draws no controls at all**, `PurseSection`'s treatment of a purse the reader cannot
   * change: an absent control says *not yours* where a disabled one says *not now*. The reader who
   * gets none is the table's DM, whose write meets a 404 — they still see where the pool stands.
   */
  onChange?: (value: number) => void;
  /** Move the pool by an amount — the steppers and `+12` / `-7` quick entry. Absent with {@link onChange}. */
  onAdjust?: (delta: number) => void;
  /** Fill the pool to its calculated maximum. Absent with {@link onChange}. */
  onResetToMax?: () => void;
}

/**
 * Where a pool stands, for a reader who cannot move it (TICKET-DM-05)
 *
 * **A module-level function rather than a branch inline**, and the seam is the point: this row makes
 * one decision now — *all three handlers or none* — and `fallow` reads the whole component as a
 * single 108-line unit on its very-high-risk size list, which is a separate list from the complexity
 * one. Naming the read-only half is what lets the decision be read in three lines.
 *
 * The number leads, as the entry box does above it, because for a DM mid-fight *where is this pool*
 * is the whole reason the row is on screen — leaving it to the `of N max` phrase beside it would bury
 * the figure the reader came for. The `sr-only` phrase is `CountRow`'s treatment of the same problem,
 * added here in the same change so the two readings a DM meets on one sheet are spoken alike.
 *
 * @param name The pool's name, as plain text — a `Label` here would name a box that is not rendered
 * @param current Where the pool stands, which is stored player state rather than a derivation
 * @returns The name and the number, and nothing that could be pressed
 */
function PoolReading({ name, current }: { name: string; current: number }) {
  return (
    <>
      <Text variant="body" as="span" className="w-40 shrink-0">
        {name}
      </Text>
      <Text variant="highlight" as="span" className="tabular-nums">
        <span className="sr-only">{`${name} stands at ${current}`}</span>
        <span aria-hidden="true">{current}</span>
      </Text>
    </>
  );
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
        onAdjust?.(entry.delta);
        return;
      }
      onChange?.(entry.value);
    },
    { allowRelative: true }
  );

  // All three or none: the box commits an absolute or a relative entry depending on what was typed
  // and the steppers send deltas, so one handler without the others would be an editor that silently
  // ignores half of what it accepts — `PurseSection`'s line, over three handlers instead of two
  const isEditable = onChange !== undefined && onAdjust !== undefined && onResetToMax !== undefined;

  return (
    <div className="flex flex-wrap items-center gap-3 border-b border-stone-200 py-2 last:border-b-0">
      {isEditable ? (
        <>
          {/* Inside the branch rather than above it: `htmlFor` naming a box that is not rendered is
              a label pointing at nothing, which is worse for a screen reader than plain text */}
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
        </>
      ) : (
        <PoolReading name={name} current={current} />
      )}

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
