/**
 * Numeric Draft
 *
 * The "let them finish typing" behaviour every editable number on a play surface needs. What the
 * Player types is held locally and **committed on blur or Enter** — never per keystroke, which is
 * what TICKET-RES-03 fixes: typing `12` over a `30` used to persist `1` on the way past, and each
 * intermediate value was a real write the store clamped and the sheet re-read.
 *
 * Extracted when TICKET-RES-02's `InvestedPointsEditor` reproduced `StatEditor`'s copy of it —
 * one behaviour, one definition, so a fix to how a partial entry is handled lands on both.
 *
 * **Relative entry** (Concept 20's quick entry) is opt-in per field. Where it is on, a leading `+`
 * or `-` means *a delta against what is stored*: `-7` takes seven off the pool rather than setting
 * it to seven below zero. The trade-off is real and deliberate — an absolute negative can no longer
 * be typed into a pool, and is reached with the `−` stepper instead (Requirement 14.4 is about what
 * may be *stored*, and a pool still goes below zero; see TICKET-RES-03's implementation notes).
 *
 * **Validates: Concept 20; Requirements 14.2, 14.4, 21.1-21.5**
 */

import type { KeyboardEvent } from 'react';
import { useState } from 'react';

/** What the Player asked for: a value to set, or an amount to move by */
export type NumericEntry =
  | { kind: 'absolute'; value: number }
  | { kind: 'relative'; delta: number };

export interface NumericDraft {
  /** What the input should show: the draft while one is in progress, otherwise the stored value */
  value: string | number;
  /** Feed the raw input string in — this only records it; nothing is committed here */
  handleChange: (raw: string) => void;
  /** Commit and drop the draft — bind to `onBlur` */
  handleBlur: () => void;
  /** Commit on Enter, abandon on Escape — bind to `onKeyDown` */
  handleKeyDown: (event: KeyboardEvent<HTMLInputElement>) => void;
}

export interface NumericDraftOptions {
  /** Read a leading `+`/`-` as a delta rather than as a signed absolute value (Concept 20) */
  allowRelative?: boolean;
}

/**
 * Read one finished entry, or null when there is nothing to commit
 *
 * A blank or unparseable draft commits **nothing** rather than committing zero — leaving a field
 * empty is abandoning the edit, not asking for 0.
 */
function parseEntry(raw: string, allowRelative: boolean): NumericEntry | null {
  const trimmed = raw.trim();
  if (trimmed === '') return null;

  const parsed = Number.parseInt(trimmed, 10);
  if (Number.isNaN(parsed)) return null;

  return allowRelative && (trimmed.startsWith('+') || trimmed.startsWith('-'))
    ? { kind: 'relative', delta: parsed }
    : { kind: 'absolute', value: parsed };
}

/**
 * Hold a half-typed number and commit it once the Player is done
 *
 * @param stored - The value the character actually has
 * @param onCommit - Called once per finished entry, with what the Player asked for
 * @param options - `allowRelative` turns on Concept 20's `+12` / `-7` quick entry
 * @returns The value to render plus the three handlers to bind
 */
export function useNumericDraft(
  stored: number,
  onCommit: (entry: NumericEntry) => void,
  options: NumericDraftOptions = {}
): NumericDraft {
  /**
   * What the Player has typed but not finished. `null` means "show the stored value", which is
   * what happens again as soon as they commit or leave.
   */
  const [draft, setDraft] = useState<string | null>(null);

  const commit = () => {
    if (draft === null) return;

    const entry = parseEntry(draft, options.allowRelative ?? false);
    setDraft(null);

    if (entry !== null) onCommit(entry);
  };

  return {
    value: draft ?? stored,

    handleChange: (raw: string) => setDraft(raw),

    handleBlur: commit,

    handleKeyDown: (event: KeyboardEvent<HTMLInputElement>) => {
      if (event.key === 'Enter') {
        // The sheet's editors sit inside no form, but the wizard's steps do — TICKET-FORM-09 hit
        // the same thing with the preview's sample boxes, and swallows Enter for the same reason
        event.preventDefault();
        commit();
        return;
      }

      if (event.key === 'Escape') setDraft(null);
    },
  };
}
