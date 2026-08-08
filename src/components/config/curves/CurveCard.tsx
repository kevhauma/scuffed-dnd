/**
 * Curve Card
 *
 * One curve: what a formula calls it, how it is read, the table itself, and what the last
 * regeneration did. The three read-mode settings sit inline rather than behind an edit dialog —
 * they change what every lookup answers, so they belong next to the numbers they change.
 *
 * "Add row" extends the table by one key past the last, which is Concept 06's "extend point-buy
 * to 40 points" gesture: add the rows, regenerate, and the generated columns fill in.
 *
 * Everything is handed in already decided; this derives nothing.
 *
 * **Validates: Concept 06; Concept 00 §1.1, §6**
 */

import type { RegenerationReport } from '../../../engine/curveGenerator';
import type { EntityReference } from '../../../engine/dependencies';
import type {
  Curve,
  CurveInterpolation,
  CurveLookupDirection,
  CurveOutOfRange,
} from '../../../types';
import { Button } from '../../ui/Button/Button';
import { Card } from '../../ui/Card/Card';
import { Select } from '../../ui/Select/Select';
import { Text } from '../../ui/Text/Text';
import { UsageList } from '../shared/UsageList';
import { CurveGrid } from './CurveGrid';

interface CurveCardProps {
  curve: Curve;
  /** Formulas calling this curve, from the reference walker */
  usages: EntityReference[];
  /** What the last regeneration in this session did, if there was one */
  report?: RegenerationReport;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  onRegenerate: (id: string) => void;
  onSettingChange: (id: string, updates: Partial<Curve>) => void;
  onAddColumn: (id: string) => void;
  onEditColumn: (id: string, columnId: string) => void;
  onDeleteColumn: (id: string, columnId: string) => void;
  onAddRow: (id: string, key: number) => void;
  onDeleteRow: (id: string, key: number) => void;
  onCellChange: (id: string, key: number, columnName: string, value: number) => void;
  onClearOverride: (id: string, key: number, columnName: string) => void;
}

const INTERPOLATION_OPTIONS = [
  { value: 'step', label: 'Step — hold the last row at or below' },
  { value: 'linear', label: 'Linear — interpolate between rows' },
];

const OUT_OF_RANGE_OPTIONS = [
  { value: 'error', label: 'Error — refuse an input past the table' },
  { value: 'clamp', label: 'Clamp — hold the end value' },
  { value: 'extrapolate', label: 'Extrapolate — keep the pattern going' },
];

const DIRECTION_OPTIONS = [
  { value: 'forward', label: 'Forward — key to value' },
  { value: 'reverse', label: 'Reverse — value to key' },
];

export function CurveCard({
  curve,
  usages,
  report,
  onEdit,
  onDelete,
  onRegenerate,
  onSettingChange,
  onAddColumn,
  onEditColumn,
  onDeleteColumn,
  onAddRow,
  onDeleteRow,
  onCellChange,
  onClearOverride,
}: CurveCardProps) {
  const lastKey = curve.rows.length === 0 ? -1 : curve.rows[curve.rows.length - 1].key;
  const isGenerated = curve.columns.some((column) => column.generator !== undefined);

  return (
    <Card variant="bordered" className="p-4">
      <div className="flex items-start justify-between gap-4 mb-3">
        <div className="flex-1">
          <Text variant="h5" as="h3" className="mb-1">
            {curve.displayName}
          </Text>
          <Text variant="highlight" as="span">
            curve.{curve.name}
          </Text>
        </div>

        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={() => onEdit(curve.id)}>
            Edit
          </Button>
          <Button variant="danger" size="sm" onClick={() => onDelete(curve.id)}>
            Delete
          </Button>
        </div>
      </div>

      <Text variant="body-small-secondary" as="p" className="mb-3">
        {curve.description}
      </Text>

      {/* Read modes — inline, because they change what every lookup answers */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
        <Select
          options={INTERPOLATION_OPTIONS}
          value={curve.interpolation}
          aria-label={`Interpolation for ${curve.displayName}`}
          className="w-full"
          onChange={(event) =>
            onSettingChange(curve.id, {
              interpolation: event.target.value as CurveInterpolation,
            })
          }
        />
        <Select
          options={OUT_OF_RANGE_OPTIONS}
          value={curve.outOfRange}
          aria-label={`Out of range for ${curve.displayName}`}
          className="w-full"
          onChange={(event) =>
            onSettingChange(curve.id, { outOfRange: event.target.value as CurveOutOfRange })
          }
        />
        <Select
          options={DIRECTION_OPTIONS}
          value={curve.lookupDirection}
          aria-label={`Lookup direction for ${curve.displayName}`}
          className="w-full"
          onChange={(event) =>
            onSettingChange(curve.id, {
              lookupDirection: event.target.value as CurveLookupDirection,
            })
          }
        />
      </div>

      <CurveGrid
        curve={curve}
        cellErrors={report?.errors ?? []}
        onCellChange={(key, columnName, value) => onCellChange(curve.id, key, columnName, value)}
        onClearOverride={(key, columnName) => onClearOverride(curve.id, key, columnName)}
        onDeleteRow={(key) => onDeleteRow(curve.id, key)}
        onEditColumn={(columnId) => onEditColumn(curve.id, columnId)}
        onDeleteColumn={(columnId) => onDeleteColumn(curve.id, columnId)}
      />

      <div className="flex flex-wrap items-center gap-2 mt-3">
        <Button variant="secondary" size="sm" onClick={() => onAddRow(curve.id, lastKey + 1)}>
          Add Row
        </Button>
        <Button variant="secondary" size="sm" onClick={() => onAddColumn(curve.id)}>
          Add Column
        </Button>
        {isGenerated && (
          <Button variant="primary" size="sm" onClick={() => onRegenerate(curve.id)}>
            Regenerate
          </Button>
        )}
      </div>

      {report && (
        <div className="mt-3 p-3 bg-parchment-100 border border-stone-200 rounded">
          <Text variant="body-small" as="p">
            Regenerated: {report.written} cell{report.written === 1 ? '' : 's'} written,{' '}
            {report.kept} kept as override{report.kept === 1 ? '' : 's'}
            {report.errors.length > 0 && `, ${report.errors.length} could not be generated`}.
          </Text>
        </div>
      )}

      <div className="pt-3 mt-3 border-t border-stone-200">
        <UsageList usages={usages} emptyMessage="No formula calls this curve yet." />
      </div>
    </Card>
  );
}
