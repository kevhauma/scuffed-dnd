/**
 * Curve Grid
 *
 * One curve's table, as a table: the key column down the left, one editable cell per value
 * column, and — Concept 06's load-bearing detail — an override rendered visibly differently from
 * a generated value. A source spreadsheet cannot tell "follows the pattern" from "somebody
 * changed this on purpose", which is how `4.642857142857` survived unnoticed in the point-buy
 * table. Here you can see it.
 *
 * Typing into a generated cell is what *makes* it an override (TICKET-CRV-02), so there is no
 * separate "mark as overridden" gesture — only the inverse, a clear that lets the generator refill
 * the cell.
 *
 * Cells are uncontrolled and commit on blur. A store round trip per keystroke would fight the
 * User over half-typed numbers — `0.` would commit as 0 and take the decimal point back.
 *
 * **Validates: Concept 06; Concept 00 §1.1, §7**
 */

import type { CellError } from '#shared/engine/curveGenerator';
import { describeFormulaError } from '#shared/engine/formula/errors';
import type { Curve } from '#shared/types';
import { Button } from '../../ui/Button/Button';
import { ErrorChip } from '../../ui/ErrorChip/ErrorChip';
import { Input } from '../../ui/Input/Input';
import { Text } from '../../ui/Text/Text';
import {
  cellInputStyles,
  cellStyles,
  headerCellStyles,
  keyCellStyles,
  overriddenCellInputStyles,
  tableStyles,
} from './CurveGrid.style';

interface CurveGridProps {
  curve: Curve;
  /** Cells whose generator failed in the last regeneration, addressed by key and column name */
  cellErrors: CellError[];
  onCellChange: (key: number, columnName: string, value: number) => void;
  onClearOverride: (key: number, columnName: string) => void;
  onDeleteRow: (key: number) => void;
  onEditColumn: (columnId: string) => void;
  onDeleteColumn: (columnId: string) => void;
}

export function CurveGrid({
  curve,
  cellErrors,
  onCellChange,
  onClearOverride,
  onDeleteRow,
  onEditColumn,
  onDeleteColumn,
}: CurveGridProps) {
  return (
    <div className="overflow-x-auto">
      <table className={tableStyles}>
        <thead>
          <tr>
            <th className={headerCellStyles} scope="col">
              <Text variant="body-small" as="span" className="font-mono">
                {curve.keyName}
              </Text>
            </th>

            {curve.columns.map((column) => (
              <th key={column.id} className={headerCellStyles} scope="col">
                <div className="flex flex-col gap-1">
                  <Text variant="body-small" as="span" className="font-mono">
                    {column.name}
                  </Text>
                  {column.generator ? (
                    <Text variant="muted" as="span" className="font-mono">
                      = {column.generator}
                    </Text>
                  ) : (
                    <Text variant="muted" as="span">
                      hand-entered
                    </Text>
                  )}
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onEditColumn(column.id)}
                      aria-label={`Edit column ${column.name}`}
                    >
                      Edit
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onDeleteColumn(column.id)}
                      aria-label={`Delete column ${column.name}`}
                    >
                      Remove
                    </Button>
                  </div>
                </div>
              </th>
            ))}

            <th className={headerCellStyles} scope="col">
              <Text variant="body-small" as="span">
                Row
              </Text>
            </th>
          </tr>
        </thead>

        <tbody>
          {curve.rows.map((row) => (
            <tr key={row.key}>
              <th className={keyCellStyles} scope="row">
                {row.key}
              </th>

              {curve.columns.map((column, columnIndex) => {
                const isOverridden = row.overridden?.[columnIndex] === true;
                const failure = cellErrors.find(
                  (error) => error.key === row.key && error.column === column.name
                );
                const label = `${column.name} at ${curve.keyName} ${row.key}${
                  isOverridden ? ' (overridden)' : ''
                }`;

                return (
                  <td key={column.id} className={cellStyles}>
                    <div className="flex items-center gap-2">
                      <Input
                        // Remounted when the stored value changes, so a regeneration or a cleared
                        // override shows up in an uncontrolled field
                        key={`${row.values[columnIndex]}-${isOverridden}`}
                        type="number"
                        step="any"
                        defaultValue={row.values[columnIndex] ?? 0}
                        aria-label={label}
                        className={isOverridden ? overriddenCellInputStyles : cellInputStyles}
                        onBlur={(event) => {
                          const value = Number(event.target.value);
                          if (!Number.isFinite(value) || value === row.values[columnIndex]) return;
                          onCellChange(row.key, column.name, value);
                        }}
                      />

                      {isOverridden && column.generator && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onClearOverride(row.key, column.name)}
                          aria-label={`Clear override for ${column.name} at ${curve.keyName} ${row.key}`}
                        >
                          Clear
                        </Button>
                      )}

                      {failure && (
                        <ErrorChip
                          label={column.name}
                          detail={describeFormulaError(failure.error)}
                        />
                      )}
                    </div>
                  </td>
                );
              })}

              <td className={cellStyles}>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onDeleteRow(row.key)}
                  aria-label={`Delete ${curve.keyName} ${row.key}`}
                >
                  Delete
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
