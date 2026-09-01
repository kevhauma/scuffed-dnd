/**
 * Purse Section
 *
 * What the character is carrying in coin — the sheet's own purse (`Charactersheet!Q18:S23`, beside
 * the equipment boxes, which is why this sits in the same rail).
 *
 * **One amount, shown in the tier it reads best in** (TICKET-CUR-02). The stored number is in the
 * ruleset's base tier and never moves when the rates do; `formatPurse` decides what to *call* it,
 * every render, so retuning gold-to-silver relabels every purse in the game and rewrites none of
 * them. This component does no arithmetic — `engine/currency.ts` owns all of it, because a second
 * implementation of *how many coppers is a gold* is exactly the drift the engine exists to prevent.
 *
 * **It replaced a tier-by-tier wallet**, which is the decision the ticket exists to defend: a
 * per-tier purse makes every payment a change-making problem and lets one amount of wealth have two
 * representations.
 *
 * Entry is relative (`+340`, `-12`) and commits on blur or Enter, never per keystroke — Concept 20's
 * quick entry, the same behaviour a resource pool has, because selling a shield is `+340` rather
 * than three hundred and forty presses.
 *
 * **The box takes whole numbers**, though the stored purse need not be one. `useNumericDraft` parses
 * with `Number.parseInt`, which every numeric entry on the sheet has done since TICKET-RES-03 — so a
 * typed `0.5` commits `0`. A *fraction* is still a perfectly good purse and arrives by the one path
 * that produces one: a conversion across fractional rates. Widening the entry is
 * a change to the shared draft hook and every editor that uses it, which is its own ticket rather
 * than a line here; the limitation is recorded on TICKET-CUR-02.
 *
 * **Validates: Concept 16; Concept 20; v3 Req 43.1, 43.2; Requirements 10.4, 10.5, 21.1-21.5**
 */

import { useId } from 'react';
import { baseTier, formatPurse } from '#shared/engine/currency';
import type { CurrencyTier } from '#shared/types/config';
import { Card } from '../../ui/Card/Card';
import { Input } from '../../ui/Input/Input';
import { Label } from '../../ui/Label/Label';
import { Text } from '../../ui/Text/Text';
import { useNumericDraft } from '../shared/useNumericDraft';

export interface PurseSectionProps {
  /** The ruleset's tiers, for naming the amount — an empty list shows a bare number */
  tiers: CurrencyTier[];
  /** What the character carries, in the base tier */
  purse: number;
  /** A new balance the Player typed */
  onSet: (amount: number) => void;
  /** An amount to move by — what a leading `+` or `-` means */
  onAdjust: (delta: number) => void;
}

export function PurseSection({ tiers, purse, onSet, onAdjust }: PurseSectionProps) {
  const inputId = useId();

  const draft = useNumericDraft(
    purse,
    (entry) => {
      if (entry.kind === 'relative') {
        onAdjust(entry.delta);
        return;
      }

      onSet(entry.value);
    },
    { allowRelative: true }
  );

  // The stored tier is what the box edits, so it is what the box is labelled with. A ruleset with no
  // currency gets a plain label rather than an invented tier name — it may define none, as it may
  // define no races (TICKET-CUR-02's fifth criterion).
  const base = baseTier(tiers);

  return (
    <Card className="p-6">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-3">
        <Text variant="h4" as="h2">
          Purse
        </Text>
        <Text variant="highlight" as="span">
          {formatPurse(purse, tiers)}
        </Text>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Label htmlFor={inputId}>{base ? base.name : 'Amount'}</Label>

        <Input
          id={inputId}
          type="text"
          inputMode="numeric"
          className="w-28 text-right"
          value={draft.value}
          onChange={(event) => draft.handleChange(event.target.value)}
          onBlur={draft.handleBlur}
          onKeyDown={draft.handleKeyDown}
        />
      </div>

      <Text variant="caption" as="p" className="mt-2">
        Type an amount, or <span className="font-mono">+340</span> and{' '}
        <span className="font-mono">-12</span> to add and spend.
      </Text>
    </Card>
  );
}
