/**
 * Dungeon Master Controls
 *
 * The powers a DM has over a character they do not own (TICKET-DM-01, v3 Req 42.1–42.5): experience,
 * the level it derives to, the extra stat points they have handed out, where each resource pool
 * stands, and — since TICKET-RES-04 — how far they stand in their dream.
 *
 * **It is drawn only when the reader is the DM**, which the sheet decides — the server opens a
 * character to its owner or to the DM of its table and nobody else, so *at a table and not mine*
 * means *I run this table*. That is v3 Req 42.7's first half, and the server enforces the same rule
 * again on every route behind it.
 *
 * ## What "set level to N" is, and what it is not
 *
 * It is a box the DM types a level into and a button that asks the server to write the experience
 * the ruleset's `xp_thresholds` curve prices that level at. **No level is stored anywhere**
 * ([D9](../../../../../docs/v3.0_backend/overview.md#d9--level-stays-derived-points-to-spend-becomes-a-grant)),
 * and a ruleset whose curve cannot price the level refuses with the curve's own sentence rather than
 * putting the character somewhere approximate.
 *
 * Layout and composition only. Every rule is the Kernel's, reached through a store action, and every
 * refusal comes back as the sheet's `actionError` banner in the server's own words.
 *
 * **Validates: v3 Req 42.1, 42.2, 42.3, 42.4, 42.5, 42.7; Requirements 21.1-21.5**
 */

import { DEFAULT_DREAM_LEVEL } from '#shared/engine/dreamLevel';
import { Card } from '../../ui/Card/Card';
import { Text } from '../../ui/Text/Text';
import { AdjustmentField } from '../shared/AdjustmentField';
import type { PointBudgetView } from '../shared/pointBudgetView';
import { ExperienceControl } from '../sheet/ExperienceControl';
import type { StatBreakdown } from '../sheet/useCharacterSheet';

export interface DmControlsPanelProps {
  characterName: string;
  /** The character's accumulated experience, so the DM can see what they are moving */
  experience: number;
  /** The pool, so a grant can be typed against a number rather than blind */
  budget: PointBudgetView | null;
  /** Where the character's dream stands, so it is typed against a number too (TICKET-RES-04) */
  dreamLevel: number;
  /** The `isResource` stats, in the ruleset's order */
  resources: StatBreakdown[];
  /** True while an adjustment is on the wire */
  isBusy: boolean;
  onAwardExperience: (amount: number) => void;
  onDeductExperience: (amount: number) => void;
  onSetLevel: (level: number) => void;
  onSetGrantedPoints: (points: number) => void;
  onSetResource: (statId: string, value: number) => void;
  onSetDreamLevel: (level: number) => void;
}

export function DmControlsPanel({
  characterName,
  experience,
  budget,
  dreamLevel,
  resources,
  isBusy,
  onAwardExperience,
  onDeductExperience,
  onSetLevel,
  onSetGrantedPoints,
  onSetResource,
  onSetDreamLevel,
}: DmControlsPanelProps) {
  return (
    <Card className="border-amber p-6">
      <Text variant="h4" as="h2" className="mb-1">
        Dungeon Master controls
      </Text>
      <Text variant="body-small-secondary" as="p" className="mb-4">
        {`${characterName} is another player's character. Everything you change here is written to the table's log with your name on it.`}
      </Text>

      <div className="flex flex-col gap-4">
        <div>
          <Text variant="body-small-secondary" as="p">
            {`Experience: ${experience}`}
          </Text>
          {/* The Player's own control, on the DM's panel — the act is identical and the store
              action behind it is what differs (TICKET-DM-01). `isBusy` is load-bearing here and not
              on the local sheet: an award is a delta, and the store swallows a second write while
              one is in flight, so a second tap would clear the box having lost the amount. */}
          <ExperienceControl
            onAward={onAwardExperience}
            onDeduct={onDeductExperience}
            isBusy={isBusy}
          />
        </div>

        <AdjustmentField
          label="Set level to"
          actionLabel="Set level"
          current="writes the experience this ruleset prices that level at"
          min={1}
          isBusy={isBusy}
          onSubmit={onSetLevel}
        />

        <AdjustmentField
          label="Points granted"
          actionLabel="Set grant"
          current={
            budget
              ? `${budget.grantedPoints} now, on top of the pool their level earns`
              : 'this ruleset cannot price a pool'
          }
          min={0}
          isBusy={isBusy}
          onSubmit={onSetGrantedPoints}
        />

        {/* Beside the level rather than among the pools: dream level is progression, and the sheet's
            identity block shows the two together (TICKET-RES-04, v4 systems/02) */}
        <AdjustmentField
          label="Dream level"
          actionLabel="Set dream level"
          current={`${dreamLevel} now — their archetype's gains grow with it`}
          min={DEFAULT_DREAM_LEVEL}
          isBusy={isBusy}
          onSubmit={onSetDreamLevel}
        />

        {resources.length > 0 && (
          <div className="flex flex-col gap-3 border-t border-stone-200 pt-4">
            <Text variant="h5" as="h3">
              Resources
            </Text>

            {resources.map((resource) => (
              <AdjustmentField
                key={resource.id}
                label={resource.name}
                actionLabel="Set"
                current={
                  resource.max.error === null
                    ? `${resource.current} of ${resource.max.value}`
                    : `${resource.current}, maximum unavailable`
                }
                // No floor: a pool may go negative — a table tracking somebody bleeding out needs
                // somewhere to put it (Requirement 14.4)
                isBusy={isBusy}
                onSubmit={(value) => onSetResource(resource.id, value)}
              />
            ))}
          </div>
        )}
      </div>
    </Card>
  );
}
