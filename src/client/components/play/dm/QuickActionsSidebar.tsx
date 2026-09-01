/**
 * The Dungeon Master's quick actions, beside the sheet (TICKET-DM-03, v3 Req 49.7's first placement)
 *
 * *Take 7 off somebody's pool* without hunting for the right field on their sheet — and the word for
 * that pool is the ruleset's, which is why this docblock does not use one. The action set is
 * [`quickActionsFor`](../shared/quickActions.ts)'s — **derived from the Snapshot**, so the labels are
 * the ruleset's own words and a table playing *Vigor* and *Focus* reads *Damage Vigor* and *Restore
 * Focus* with nothing recompiled. TICKET-DM-04 renders the same set on the session roster, from the
 * same definition, so the two placements cannot offer different actions.
 *
 * **Drawn only for the table's DM, and absent rather than disabled for anybody else** (v3 Req 49.10).
 * [`useQuickActions`](./useQuickActions.ts) answers `null` and this returns nothing — **which is why
 * the decision is here rather than in a conditional on the sheet**: `InventoryPanel`,
 * `SpellbookPanel` and `PassivesPanel` are all rail panels that take a character and decide for
 * themselves, and `fallow` measured `CharacterSheet` over the cognitive threshold when this one did
 * not. A disabled control tells a Player a power exists and invites a request to use it; the server
 * refuses these requests regardless of what any browser drew.
 *
 * It sits at the top of the sheet's right rail, above the pack: a DM with the sheet open has it
 * open in order to change something, and the panel that does that should not be found by scrolling
 * past somebody else's stat rows. [`DmControlsPanel`](./DmControlsPanel.tsx) stays above the grid
 * for the slower per-field edits — a level, a dream level, a pool set to an exact number.
 *
 * Layout and composition only. Every rule is the Kernel's, every refusal comes back in the server's
 * own words through the sheet's `actionError` banner, and every number shown here was written by an
 * Event rather than computed on this side.
 *
 * **Validates: v3 Req 49.1, 49.4, 49.5, 49.6, 49.7, 49.10; Requirements 21.1-21.5**
 */

import type { CharacterAdjustment } from '#shared/types/api';
import { Button } from '../../ui/Button/Button';
import { Card } from '../../ui/Card/Card';
import { Text } from '../../ui/Text/Text';
import type { QuickAction } from '../shared/quickActions';
import type { AdjustmentVocabulary } from './adjustmentVocabulary';
import { QuickActionRow } from './QuickActionRow';
import { useQuickActions } from './useQuickActions';

export interface QuickActionsSidebarProps {
  characterId: string;
  characterName: string;
  /** The set derived from the Snapshot, in render order */
  actions: QuickAction[];
  /**
   * The sheet's adjustment history, newest first
   *
   * Taken as a prop rather than fetched again: the sheet already reads it for the log, and the
   * newest row past the one an action was sent against *is* that action's before → after.
   */
  adjustments: CharacterAdjustment[];
  /** How this ruleset spells what an adjustment names — see `adjustmentVocabulary.ts` */
  words: AdjustmentVocabulary;
  /**
   * What the DM has already granted, which a give or take is a total on top of
   *
   * **A number rather than the whole `PointBudgetView`**, narrowed at the review: the panel read one
   * field off it and the `?? 0` that came with the nullable shape described a state that does not
   * arise — `toPointBudgetView` is only `null` for a null allocation, which `CharacterSheet` has
   * already turned into a `SheetStatusNotice`, and a budget the ruleset cannot *price* still carries a
   * real `grantedPoints` because only `pointBudget` and `pointsRemaining` are `DerivedValue`. Had it
   * ever fired, *give 1 point* would have written `1` over a real grant instead of incrementing it.
   */
  grantedPoints: number;
}

export function QuickActionsSidebar({
  characterId,
  characterName,
  actions,
  adjustments,
  words,
  grantedPoints,
}: QuickActionsSidebarProps) {
  const quick = useQuickActions(characterId, adjustments, words, grantedPoints);

  if (!quick) return null;

  return (
    <Card className="border-amber p-6">
      <Text variant="h4" as="h2" className="mb-1">
        Quick actions
      </Text>
      <Text variant="body-small-secondary" as="p" className="mb-4">
        {`Everything here changes ${characterName}'s sheet and is written to the table's log with your name on it.`}
      </Text>

      <div className="flex flex-col gap-4">
        {actions.map((action) => (
          <QuickActionRow
            key={action.id}
            action={action}
            isBusy={quick.isBusy}
            onApply={quick.apply}
          />
        ))}
      </div>

      {quick.outcome !== null && (
        <div className="mt-4 border-t border-stone-200 pt-4">
          {/* What the Event says happened, not what was asked for: a restore that clamped reads as
              the points it actually put back (v3 Req 49.5) */}
          <Text variant="body-small" as="p">
            {quick.outcome}
          </Text>

          {quick.undo !== null && (
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Button variant="secondary" size="xs" disabled={quick.isBusy} onClick={quick.undo}>
                Undo
              </Button>

              {/* Load-bearing, and the ticket says so: undo goes back through the same route under
                  the same rules, so a pool whose maximum has fallen does not come back to where it
                  was. Saying it here rather than only in a docblock is the point — the DM is the one
                  who has to decide whether that matters (v3 Req 49.6). */}
              <Text variant="body-small-secondary" as="span">
                Undo applies the opposite action, not a rewind — a clamped pool does not come back.
              </Text>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
