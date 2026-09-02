/**
 * The quick actions, on a roster row (TICKET-DM-04, v3 Req 49.7's second placement)
 *
 * *Take 7 off somebody's pool* without opening their sheet at all — the round of combat the user
 * story asks for, as a column of presses rather than five page visits.
 *
 * ## The same definition and the same controls as the sidebar
 *
 * The action set is [`quickActionsForCharacter`](../../play/shared/characterQuickActions.ts)'s, the
 * bindings are [`useQuickActionBindings`](../../play/dm/useQuickActions.ts)', and each action is drawn
 * by the sidebar's own [`QuickActionRow`](../../play/dm/QuickActionRow.tsx). **Reused across the
 * feature-folder line deliberately**, on the precedent of `rulesets/` composing
 * `config/shared/FormDialogActions`: v3 Req 49.7 asks that the two placements cannot offer different
 * actions or apply them differently, and the cheapest way to make that true is for there to be one
 * set of controls rather than two that agree.
 *
 * ## Behind a disclosure, and the reason is arithmetic
 *
 * A ruleset with three pools produces ten actions. Six characters is sixty rows of label-chips-box, on
 * a surface whose whole point is that a DM can read the party at a glance. So a row shows its numbers
 * and offers *Actions*; opening one is a press, and the closed state is the one a DM spends the fight
 * in. **The set is not narrowed** — what a row offers when open is exactly what the sidebar offers,
 * which is what the criterion is about.
 *
 * ## Absent, not disabled
 *
 * There is no *is this the DM* check in here: the parent renders this component or does not
 * (v3 Req 49.10). That is what keeps the answer in the one place that can see the member listing, and
 * it means a Player's roster has no dead controls on it. The server refuses every one of these
 * requests regardless of what any browser drew — `requireCharacterDM`.
 *
 * **Validates: v3 Req 49.4, 49.5, 49.6, 49.7, 49.10**
 */

import { useState } from 'react';
import type { CharacterAdjustment } from '#shared/types/api';
import type { AdjustmentVocabulary } from '../../play/dm/adjustmentVocabulary';
import { QuickActionOutcome } from '../../play/dm/QuickActionOutcome';
import { QuickActionRow } from '../../play/dm/QuickActionRow';
import { useQuickActionBindings } from '../../play/dm/useQuickActions';
import type { QuickAction } from '../../play/shared/quickActions';
import { Button } from '../../ui/Button/Button';
import { actionTrayStyles, cellLabelStyles } from './roster.style';

export interface RosterQuickActionsProps {
  /** The character document's id, which is what every write is addressed to */
  characterId: string;
  characterName: string;
  /** The set derived from the Snapshot, in render order */
  actions: QuickAction[];
  /**
   * That character's adjustments, newest first
   *
   * The roster's are the ones it has **watched go past on the feed** rather than a fetched log — see
   * [`useRosterFeed`](./useRosterFeed.ts) for why that is not a shortcut: a request per row is what
   * the alternative costs, and the Event carries the very before → after the endpoint would report.
   */
  adjustments: CharacterAdjustment[];
  /** How this ruleset spells what an adjustment names */
  words: AdjustmentVocabulary;
  /** What the DM has already granted, which a give or take is a total on top of */
  grantedPoints: number;
}

export function RosterQuickActions({
  characterId,
  characterName,
  actions,
  adjustments,
  words,
  grantedPoints,
}: RosterQuickActionsProps) {
  const [isOpen, setIsOpen] = useState(false);
  const quick = useQuickActionBindings(characterId, adjustments, words, grantedPoints);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="secondary" size="xs" onClick={() => setIsOpen(!isOpen)}>
          {isOpen ? 'Hide actions' : 'Actions'}
        </Button>

        {/* Outside the disclosure on purpose: a DM who has just adjusted somebody and closed the
            tray still needs to read what it did, and to be able to take it back (v3 Req 49.5) */}
        <QuickActionOutcome outcome={quick.outcome} undo={quick.undo} isBusy={quick.isBusy} />
      </div>

      {isOpen && (
        <div className={actionTrayStyles}>
          {/* Said once per open tray rather than once per row: the log entry carries the DM's name,
              and a DM adjusting five characters should be told that once */}
          <span className={cellLabelStyles}>
            {`Changes ${characterName}'s sheet, logged with your name`}
          </span>

          {actions.map((action) => (
            <QuickActionRow
              key={action.id}
              action={action}
              isBusy={quick.isBusy}
              onApply={quick.apply}
            />
          ))}
        </div>
      )}
    </div>
  );
}
