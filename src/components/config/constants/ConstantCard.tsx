/**
 * Constant Card
 *
 * One constant: what it is called in a formula, what it is worth, why it exists, and — Concept
 * 05's editor requirement — **what breaks if you change it**. The usage list is the blast radius,
 * so it sits on the card rather than behind the delete dialog: the point of naming a balance lever
 * is knowing what turning it moves.
 *
 * The references are handed in already resolved; this derives nothing.
 *
 * **Validates: Concept 05; Concept 00 §6; Requirements 21.1-21.5**
 */

import type { EntityReference } from '../../../engine/dependencies';
import type { Constant } from '../../../types';
import { Button } from '../../ui/Button/Button';
import { Card } from '../../ui/Card/Card';
import { Text } from '../../ui/Text/Text';
import { UsageList } from '../shared/UsageList';

interface ConstantCardProps {
  constant: Constant;
  /** Formulas naming this constant, from the reference walker */
  usages: EntityReference[];
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
}

export function ConstantCard({ constant, usages, onEdit, onDelete }: ConstantCardProps) {
  return (
    <Card variant="bordered" className="p-4">
      <div className="flex items-start justify-between gap-4 mb-3">
        <div className="flex-1">
          <Text variant="h5" as="h3" className="mb-1">
            {constant.displayName}
          </Text>
          <Text variant="highlight" as="span">
            const.{constant.name}
          </Text>
        </div>

        <div className="flex items-center gap-2">
          <Text variant="h4" as="p" className="text-forest">
            {constant.value}
          </Text>
          {constant.unit && (
            <Text variant="body-small-secondary" as="span">
              {constant.unit}
            </Text>
          )}
        </div>

        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={() => onEdit(constant.id)}>
            Edit
          </Button>
          <Button variant="danger" size="sm" onClick={() => onDelete(constant.id)}>
            Delete
          </Button>
        </div>
      </div>

      <Text variant="body-small-secondary" as="p" className="mb-3">
        {constant.description}
      </Text>

      <div className="pt-3 border-t border-stone-200">
        <UsageList usages={usages} emptyMessage="No formula names this constant yet." />
      </div>
    </Card>
  );
}
