/**
 * Equipment Slot Display Builder
 *
 * Where the User draws the figure their character sheets will show: a grid they size themselves,
 * a slot on each cell, and a glyph on each slot. Before this, the arrangement was a recognition
 * table in play-mode code — a ruleset whose slots happened to be called `head` and `chest` got a
 * body, and one with `horns` got a row of boxes, with nothing the User could do about either.
 *
 * Layout and composition only; every decision lives in `useEquipmentLayoutBuilder`, and every write
 * goes through a `configStore` action.
 *
 * **Validates: Requirements 7.5, 12.1, 12.2, 21.1-21.5, 22.1-22.6**
 */

import { useId } from 'react';
import { gridTrackClasses } from '../../shared/equipmentGrid';
import { Label } from '../../ui/Label/Label';
import { Select } from '../../ui/Select/Select';
import { Text } from '../../ui/Text/Text';
import { ConfigEmptyState } from '../shared/ConfigEmptyState';
import { ConfigPanelShell, NoConfigurationNotice } from '../shared/ConfigPanelShell';
import { EquipmentLayoutCell } from './EquipmentLayoutCell';
import { GlyphPickerDialog } from './GlyphPickerDialog';
import { useEquipmentLayoutBuilder } from './useEquipmentLayoutBuilder';

/** `1`…`6` as the options a size picker offers */
function sizeOptions(max: number) {
  return Array.from({ length: max }, (_, index) => ({
    value: String(index + 1),
    label: String(index + 1),
  }));
}

const boardStyles = [
  'rounded-md p-3',
  'bg-oak-800 surface-fibre',
  'border-2 border-brass-dark',
  'ring-1 ring-inset ring-brass/25',
  'shadow-parchment-lg',
].join(' ');

export function EquipmentLayoutPanel() {
  const {
    config,
    layout,
    columns,
    rows,
    maxColumns,
    maxRows,
    cells,
    unplaced,
    glyphSlot,
    openGlyphPicker,
    closeGlyphPicker,
    handleResize,
    handleAssign,
    handleChooseGlyph,
  } = useEquipmentLayoutBuilder();

  const columnsId = useId();
  const rowsId = useId();

  if (!config) {
    return <NoConfigurationNotice />;
  }

  return (
    <ConfigPanelShell
      title="Equipment Display"
      description="Arrange the slots on the figure a character sheet draws"
      headerExtra={
        <div className="mt-4 flex flex-wrap items-end gap-4">
          <div>
            <Label htmlFor={columnsId}>Columns</Label>
            <Select
              id={columnsId}
              value={String(columns)}
              options={sizeOptions(maxColumns)}
              disabled={!layout}
              onChange={(event) => handleResize({ columns: Number(event.target.value) })}
              className="mt-1 w-20"
            />
          </div>
          <div>
            <Label htmlFor={rowsId}>Rows</Label>
            <Select
              id={rowsId}
              value={String(rows)}
              options={sizeOptions(maxRows)}
              disabled={!layout}
              onChange={(event) => handleResize({ rows: Number(event.target.value) })}
              className="mt-1 w-20"
            />
          </div>
          <Text variant="body-small-secondary" className="max-w-md">
            Shrinking the grid takes any slot outside it off the figure — the slot itself is kept,
            and shows up under “Not on the figure” for you to place again.
          </Text>
        </div>
      }
    >
      {config.equipmentSlots.length === 0 ? (
        <ConfigEmptyState message="No equipment slots to arrange yet. Add one above, and it will appear here to place." />
      ) : (
        <div className="space-y-4">
          <div className={boardStyles}>
            <ul className={`grid gap-2 ${gridTrackClasses(columns, rows)}`}>
              {cells.map((cell) => (
                <EquipmentLayoutCell
                  key={`${cell.column}:${cell.row}`}
                  column={cell.column}
                  row={cell.row}
                  slot={cell.slot}
                  slots={config.equipmentSlots}
                  onAssign={handleAssign}
                  onEditGlyph={openGlyphPicker}
                />
              ))}
            </ul>
          </div>

          <div>
            <Text variant="h5" as="h3" className="mb-2">
              Not on the figure
            </Text>
            {unplaced.length === 0 ? (
              <Text variant="body-small-secondary">Every slot is placed.</Text>
            ) : (
              <ul className="flex flex-wrap gap-2">
                {unplaced.map((slot) => (
                  <li key={slot.type}>
                    <Text
                      variant="body-small"
                      className="rounded border border-stone-200 px-2 py-1"
                    >
                      {slot.name}
                    </Text>
                  </li>
                ))}
              </ul>
            )}
            <Text variant="body-small-secondary" className="mt-2">
              A slot listed here still works — the sheet shows it in a plain row beneath the figure.
            </Text>
          </div>
        </div>
      )}

      <GlyphPickerDialog
        open={glyphSlot !== null}
        slotName={glyphSlot?.name ?? ''}
        current={glyphSlot?.placement?.glyph ?? null}
        onClose={closeGlyphPicker}
        onChoose={handleChooseGlyph}
      />
    </ConfigPanelShell>
  );
}
