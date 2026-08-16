/**
 * Numeric Draft
 *
 * The "let them finish typing" behaviour every editable number on a play surface needs: what the
 * Player has typed is held locally while it is still half-written (`""` on the way to `3`, `"-"` on
 * the way to `-5`), and only a parseable value is committed. Leaving the box drops the draft, so the
 * stored value is what shows again.
 *
 * Extracted when TICKET-RES-02's `InvestedPointsEditor` reproduced `StatEditor`'s copy of it —
 * one behaviour, one definition, so a fix to how a partial entry is handled lands on both.
 *
 * **Validates: Requirements 14.2, 21.1-21.5**
 */

import { useState } from 'react';

export interface NumericDraft {
  /** What the input should show: the draft while one is in progress, otherwise the stored value */
  value: string | number;
  /** Feed the raw input string in; a parseable value is committed, an unfinished one is held */
  handleChange: (raw: string) => void;
  /** Drop the draft — bind to `onBlur` */
  handleBlur: () => void;
}

/**
 * Hold a half-typed number without committing it
 *
 * @param stored - The value the character actually has
 * @param onCommit - Called with each parseable value the Player types
 * @returns The value to render plus the two handlers to bind
 */
export function useNumericDraft(stored: number, onCommit: (value: number) => void): NumericDraft {
  /**
   * What the Player has typed but not finished. `null` means "show the stored value", which is
   * what happens again as soon as they leave.
   */
  const [draft, setDraft] = useState<string | null>(null);

  return {
    value: draft ?? stored,

    handleChange: (raw: string) => {
      setDraft(raw);

      const parsed = Number.parseInt(raw, 10);
      if (Number.isNaN(parsed)) return;

      onCommit(parsed);
    },

    handleBlur: () => setDraft(null),
  };
}
