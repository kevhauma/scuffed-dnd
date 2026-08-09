/**
 * Stat Card Component
 *
 * One stat as the panel lists it: what kind it is, what bounds it, and its formula if it has one.
 * Carries the reorder controls too, so a keyboard reaches the ordering the drag handle offers a
 * mouse (TICKET-STAT-02).
 *
 * It **evaluates nothing** (TICKET-FORM-08). A card showed a sample-value preview of the saved
 * formula, which was the preview on the wrong side of the edit — the question is what a formula
 * does *while you are writing it*. `FormulaPreview` answers that in the dialog, and one preview in
 * one place is what stops two copies of the wiring drifting apart.
 *
 * **Validates: Concept 01; Requirements 3.1, 21.1-21.5**
 */

import type { Stat } from '../../../types';
import { Button } from '../../ui/Button/Button';
import { Card } from '../../ui/Card/Card';
import { Text } from '../../ui/Text/Text';

export interface StatCardProps {
  stat: Stat;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  /** Move this stat one place up or down — the keyboard half of reordering (TICKET-STAT-02) */
  onMove: (id: string, delta: number) => void;
  /** False for the first stat, so "up" is not offered where it would do nothing */
  canMoveUp: boolean;
  /** False for the last stat */
  canMoveDown: boolean;
}

/**
 * The short labels describing what kind of stat this is, in the order they read best
 *
 * Derived by the same rule the model uses — a formula makes a stat derived, and nothing else does
 * (Concept 01) — so a card can never disagree with the engine about what it is showing.
 *
 * @param stat - The stat being described
 * @returns One badge label per property worth naming, possibly empty
 */
function statBadges(stat: Stat): string[] {
  const badges = [stat.formula === undefined ? 'Invested' : 'Derived'];

  if (stat.isResource) badges.push('Resource');
  if (stat.countsTowardTotal) badges.push('Counts toward total');
  if (stat.min !== undefined) badges.push(`Min ${stat.min}`);
  if (stat.max !== undefined) badges.push(`Max ${stat.max}`);
  if (stat.rounding !== 'none') badges.push(`Round ${stat.rounding}`);

  return badges;
}

export function StatCard({
  stat,
  onEdit,
  onDelete,
  onMove,
  canMoveUp,
  canMoveDown,
}: StatCardProps) {
  return (
    <Card variant="bordered" className="p-4">
      <div className="flex justify-between items-start mb-3">
        <div className="flex-1">
          <Text variant="h5" as="h3" className="mb-1">
            {stat.name} <span className="font-mono text-ink-500">{stat.abbreviation}</span>
          </Text>
          {stat.description && (
            <Text variant="body-small-secondary" as="p" className="mb-2">
              {stat.description}
            </Text>
          )}
        </div>
        <div className="flex gap-2">
          <Button
            variant="ghost"
            onClick={() => onMove(stat.id, -1)}
            disabled={!canMoveUp}
            aria-label={`Move ${stat.name} up`}
            className="text-sm px-2 py-1"
          >
            ↑
          </Button>
          <Button
            variant="ghost"
            onClick={() => onMove(stat.id, 1)}
            disabled={!canMoveDown}
            aria-label={`Move ${stat.name} down`}
            className="text-sm px-2 py-1"
          >
            ↓
          </Button>
          <Button variant="secondary" onClick={() => onEdit(stat.id)} className="text-sm px-2 py-1">
            Edit
          </Button>
          <Button variant="danger" onClick={() => onDelete(stat.id)} className="text-sm px-2 py-1">
            Delete
          </Button>
        </div>
      </div>

      {/* What kind of stat this is, and what bounds it */}
      <div className="flex flex-wrap gap-2 mb-3">
        {statBadges(stat).map((badge) => (
          <Text
            key={badge}
            variant="body-small-secondary"
            className="px-2 py-0.5 bg-parchment-100 border border-stone-200 rounded"
          >
            {badge}
          </Text>
        ))}
      </div>

      {/* Formula Display — absent means the stat is invested rather than derived */}
      <div className="mb-3">
        <Text variant="body-small-secondary" className="mb-1">
          Formula:
        </Text>
        {stat.formula === undefined ? (
          <Text variant="muted" as="p">
            Invested — its value is the points put into it, plus race and equipment.
          </Text>
        ) : (
          <Text variant="body-small" className="font-mono bg-parchment-100 px-2 py-1 rounded">
            {stat.formula}
          </Text>
        )}
      </div>
    </Card>
  );
}
