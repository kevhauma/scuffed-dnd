/**
 * Resources Section
 *
 * The pools a Player spends against during play — health, mana, anything else the ruleset flags
 * `isResource` (Concept 20).
 *
 * They are here rather than among the stats because they are read for a different reason. A stat
 * is a fact about the character that changes when they level; a resource is a number that moves
 * every few minutes at the table, and it is the one thing on the sheet somebody looks at mid-fight.
 * Mixed into the stat list, each pool also had to carry two rows — its maximum and its current
 * value — which broke the one-line rhythm of every stat around it.
 *
 * Each pool keeps both numbers and both sets of controls: `CountRow` for the maximum, which is
 * composed from points and race and equipment like any other stat, and `StatEditor` for where the
 * pool currently stands, which is player state and nothing else (TICKET-STAT-03).
 *
 * **The pools are laid out in the ruleset's own groups too** (TICKET-STAT-04), through the same
 * `shared/labelledGroups.ts` the stats use. The sheet's *Vitals* column holds Health, Mana and
 * Speed, and this app puts the first two here and the third among the stats — so a group that spans
 * the split draws a column on each side rather than one section quietly swallowing the other's rows.
 *
 * **Every handler is optional since TICKET-DM-05.** The four routes behind them are all
 * `requireCharacterPlayer`, so the table's DM gets none of them and reads the pools instead — the
 * maxima on their `CountRow`s and where each pool stands on its `StatEditor`, with the spend and the
 * pool controls simply absent. What a DM does instead is the quick actions in the rail, which this
 * section says out loud rather than leaving four missing controls to be read as a rendering failure.
 *
 * **Validates: Concept 20; Requirements 11.3, 13.4, 14.1, 14.2, 14.3, 14.4, 16.6, 21.1-21.5;
 * v3 Req 42.7, 49.10**
 */

import { Fragment } from 'react';
import { groupByLabel } from '../../shared/labelledGroups';
import { Card } from '../../ui/Card/Card';
import { Text } from '../../ui/Text/Text';
import { CountRow } from '../shared/CountRow';
import { NoControlsNotice } from '../shared/NoControlsNotice';
import type { PointBudgetView } from '../shared/pointBudgetView';
import { investedContribution } from './investedContribution';
import { StatEditor } from './StatEditor';
import { StatGroupColumns } from './StatGroupColumns';
import type { StatBreakdown } from './useCharacterSheet';

export interface ResourcesSectionProps {
  /** The `isResource` stats, in the ruleset's order */
  resources: StatBreakdown[];
  /** The pool every invested stat spends from, or null when there is none to show */
  budget: PointBudgetView | null;
  /**
   * Set a pool to an absolute value, or absent when this reader may only read it (TICKET-DM-05)
   *
   * The three pool handlers travel together — `StatEditor` draws all its controls or none — and the
   * reader who gets none is the table's DM, refused by `requireCharacterPlayer`.
   */
  onChangeStatValue?: (statId: string, value: number) => void;
  /** Move a pool by a delta. Absent with {@link ResourcesSectionProps.onChangeStatValue}. */
  onAdjustStatValue?: (statId: string, delta: number) => void;
  /** Fill a pool to its maximum. Absent with {@link ResourcesSectionProps.onChangeStatValue}. */
  onResetStatValueToMax?: (statId: string) => void;
  /** Spend on a pool's maximum, or absent for the DM — whose points meet the same refusal */
  onChangeInvestedPoints?: (statId: string, points: number) => void;
}

/**
 * What a reader with no controls is told to do instead
 *
 * Its own sentence rather than `POINTS_ARE_THE_PLAYERS`, because this card loses **two** things — the
 * spend and the pool editor — and the DM's route to the second is the quick actions' damage/restore
 * pair specifically. It names the sidebar the DM actually has, because the DM is the only reader who
 * ever sees it: a Player keeps every control here, at a table and off it.
 */
const NO_CONTROLS =
  'Only the Player spends points and moves their own pools — damage and restore them from the quick ' +
  'actions in the rail.';

export function ResourcesSection({
  resources,
  budget,
  onChangeStatValue,
  onAdjustStatValue,
  onResetStatValueToMax,
  onChangeInvestedPoints,
}: ResourcesSectionProps) {
  if (resources.length === 0) return null;

  const groups = groupByLabel(resources, (resource) => resource.group);

  return (
    <Card className="p-6">
      <Text variant="h4" as="h2" className="mb-3">
        Resources
      </Text>

      {/* Said once for the whole card rather than under each pool: a table with six resources would
          otherwise carry the same sentence six times */}
      {onChangeStatValue === undefined && <NoControlsNotice message={NO_CONTROLS} />}

      <StatGroupColumns groups={groups}>
        {(group) =>
          // A `Fragment` rather than a wrapper: `CountRow`'s `last:border-b-0` reads its
          // siblings, so boxing each pool would drop every row's rule
          group.members.map((resource) => (
            <Fragment key={resource.id}>
              <CountRow
                name={resource.name}
                code={resource.abbreviation}
                total={resource.max}
                invested={resource.invested}
                // Three ways to have no spend control, and they mean different things: a derived
                // pool takes no points *ever*, a sheet with no budget has none to spend, and a
                // reader with no handler may not spend at all (TICKET-DM-05)
                onAdjust={
                  resource.isDerived || !budget || !onChangeInvestedPoints
                    ? undefined
                    : (points) => onChangeInvestedPoints(resource.id, points)
                }
                canSpend={(budget?.pointsRemaining.value ?? 0) > 0}
                // The same row `StatsSection` draws, from the same function — a pool's maximum is
                // composed exactly like a stat, so the two must not disagree about the spelling
                contributions={[
                  investedContribution(resource),
                  { label: 'race', value: resource.race },
                  { label: 'equipment', value: resource.equipment },
                ]}
              />

              {/* All three or none, which is `StatEditor`'s own rule: bound to this pool's id where
                  the reader has them, and passed straight through as absent where they do not */}
              <StatEditor
                name={resource.name}
                current={resource.current}
                max={resource.max}
                isOverMax={resource.isOverMax}
                onChange={onChangeStatValue && ((value) => onChangeStatValue(resource.id, value))}
                onAdjust={onAdjustStatValue && ((delta) => onAdjustStatValue(resource.id, delta))}
                onResetToMax={onResetStatValueToMax && (() => onResetStatValueToMax(resource.id))}
              />
            </Fragment>
          ))
        }
      </StatGroupColumns>
    </Card>
  );
}
