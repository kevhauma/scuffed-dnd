/**
 * Curves Configuration Panel Tests
 *
 * The store is real with storage mocked, so what the grid shows is what the ruleset actually
 * holds. What is worth asserting through the DOM rather than through the engine is the part the
 * engine cannot have: that a hand-tuned cell is **visibly** different from a generated one
 * (Concept 06 calls that the feature that would have caught all four seed anomalies), that
 * regenerating reports what it kept, and that the two identifier rules refuse a bad name at the
 * form rather than at the import boundary.
 *
 * **Validates: Concept 06; Concept 00 §1.1, §6, §7**
 */

import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Configuration } from '../../../types/config';

vi.mock('../../../services/storage', () => ({
  loadConfiguration: vi.fn(() => null),
  saveConfiguration: vi.fn(),
  loadCharacters: vi.fn(() => []),
  saveCharacters: vi.fn(),
  isStorageAvailable: vi.fn(() => true),
}));

import { useConfigStore } from '../../../stores/configStore';
import { CurvesConfigPanel } from './CurvesConfigPanel';

const config: Configuration = {
  id: 'config1',
  name: 'Test Config',
  version: '1.0',
  schemaVersion: 2,
  stats: [
    {
      id: 'str-id',
      name: 'Strength',
      abbreviation: 'STR',
      description: '',
      order: 0,
      countsTowardTotal: true,
      isResource: false,
      rounding: 'none',
    },
    {
      id: 'gain',
      name: 'Gain',
      abbreviation: 'GAI',
      description: '',
      order: 0,
      countsTowardTotal: true,
      isResource: false,
      rounding: 'none',
      formula: 'curve.point_buy.main(STR)',
    },
  ],
  specialitySkills: [],
  combatSkills: [],
  materials: [],
  materialCategories: [],
  items: [],
  equipmentSlots: [],
  races: [],
  currencyTiers: [],
  constants: [],
  curves: [
    {
      id: 'pb-id',
      name: 'point_buy',
      displayName: 'Point buy',
      description: 'What a point spent on a stat is worth.',
      keyName: 'points',
      columns: [
        { id: 'col-non', name: 'non' },
        { id: 'col-main', name: 'main', generator: '0.75 * (key + 1)' },
      ],
      rows: [
        { key: 0, values: [0, 0.75] },
        { key: 1, values: [1, 1.5] },
        { key: 2, values: [1, 2.25] },
      ],
      interpolation: 'step',
      outOfRange: 'error',
      lookupDirection: 'forward',
    },
  ],
  focusStatBonusLevel: 0,
  createdAt: '2024-01-01',
  updatedAt: '2024-01-01',
};

/** The stored curve, so assertions read the ruleset rather than the render */
const stored = () => useConfigStore.getState().config?.curves?.[0];

/** Type a number into one cell and commit it, the way the grid commits — on blur */
function typeCell(label: string | RegExp, value: string) {
  const cell = screen.getByLabelText(label);
  fireEvent.change(cell, { target: { value } });
  fireEvent.blur(cell);
}

describe('CurvesConfigPanel', () => {
  beforeEach(() => {
    useConfigStore.setState({ config: structuredClone(config), isLoaded: true });
  });

  it('should show each curve with its formula name, settings and grid', () => {
    render(<CurvesConfigPanel />);

    expect(screen.getByText('curve.point_buy')).toBeDefined();
    expect(screen.getByLabelText('Interpolation for Point buy')).toHaveProperty('value', 'step');
    expect(screen.getByLabelText('main at points 1')).toHaveProperty('value', '1.5');
    // The generator is on the header, so the pattern is visible next to what it produced
    expect(screen.getByText('= 0.75 * (key + 1)')).toBeDefined();
  });

  it('should list the formulas that call a curve', () => {
    render(<CurvesConfigPanel />);

    expect(screen.getByText(/Stat: Gain/)).toBeDefined();
  });

  it('should persist a typed cell and mark a generated one as an override', () => {
    render(<CurvesConfigPanel />);

    typeCell('main at points 1', '9');

    expect(stored()?.rows[1].values).toEqual([1, 9]);
    expect(stored()?.rows[1].overridden).toEqual([false, true]);
  });

  it('should show an override as visibly distinct from a generated cell', () => {
    render(<CurvesConfigPanel />);

    typeCell('main at points 1', '9');

    // The accessible name says so, and the field is tinted — Concept 06 wants both
    const overridden = screen.getByLabelText('main at points 1 (overridden)');
    expect(overridden.className).toContain('bg-amber/20');
    expect(screen.getByLabelText('main at points 2').className).not.toContain('bg-amber/20');
  });

  it('should not flag a cell in a hand-entered column — there is no pattern to deviate from', () => {
    render(<CurvesConfigPanel />);

    typeCell('non at points 1', '4');

    expect(stored()?.rows[1].values).toEqual([4, 1.5]);
    expect(stored()?.rows[1].overridden).toBeUndefined();
  });

  it('should keep an override through a regeneration and report that it did', () => {
    render(<CurvesConfigPanel />);
    typeCell('main at points 1', '9');

    fireEvent.click(screen.getByRole('button', { name: 'Regenerate' }));

    expect(stored()?.rows[1].values[1]).toBe(9);
    expect(screen.getByText(/2 cells written, 1 kept as override/)).toBeDefined();
  });

  it('should put the generated value back when an override is cleared', () => {
    render(<CurvesConfigPanel />);
    typeCell('main at points 1', '9');

    fireEvent.click(screen.getByRole('button', { name: 'Clear override for main at points 1' }));

    expect(stored()?.rows[1].values[1]).toBe(1.5);
    expect(stored()?.rows[1].overridden).toBeUndefined();
  });

  it('should highlight the failing cell from the report’s address, not from a message', () => {
    useConfigStore.setState({
      config: {
        ...structuredClone(config),
        curves: [
          {
            ...structuredClone(config).curves?.[0],
            columns: [
              { id: 'col-non', name: 'non' },
              { id: 'col-main', name: 'main', generator: 'const.missing * key' },
            ],
          },
        ],
      } as Configuration,
    });
    render(<CurvesConfigPanel />);

    fireEvent.click(screen.getByRole('button', { name: 'Regenerate' }));

    expect(screen.getByText(/3 could not be generated/)).toBeDefined();
    expect(screen.getAllByRole('img', { name: /main:/ })).toHaveLength(3);
  });

  it('should splice values and flags together when a column is added', async () => {
    render(<CurvesConfigPanel />);

    fireEvent.click(screen.getByRole('button', { name: 'Add Column' }));
    const dialog = within(screen.getByRole('dialog', { name: 'Add Column' }));
    fireEvent.change(dialog.getByLabelText(/Column Name/), { target: { value: 'sub' } });
    fireEvent.click(dialog.getByRole('button', { name: 'Add Column' }));

    await waitFor(() =>
      expect(stored()?.columns.map((column) => column.name)).toEqual(['non', 'main', 'sub'])
    );
    for (const row of stored()?.rows ?? []) {
      expect(row.values).toHaveLength(3);
    }
  });

  it('should carry a surviving override onto its own cell when a column is removed', () => {
    render(<CurvesConfigPanel />);
    typeCell('main at points 1', '9');

    fireEvent.click(screen.getByRole('button', { name: 'Delete column non' }));

    expect(stored()?.columns.map((column) => column.name)).toEqual(['main']);
    expect(stored()?.rows[1].values).toEqual([9]);
    expect(stored()?.rows[1].overridden).toEqual([true]);
  });

  it('should add a row past the last key and delete one by key', () => {
    render(<CurvesConfigPanel />);

    fireEvent.click(screen.getByRole('button', { name: 'Add Row' }));
    expect(stored()?.rows.at(-1)).toEqual({ key: 3, values: [0, 0] });

    fireEvent.click(screen.getByRole('button', { name: 'Delete points 3' }));
    expect(stored()?.rows.some((row) => row.key === 3)).toBe(false);
  });

  it('should persist a settings change through the store', () => {
    render(<CurvesConfigPanel />);

    fireEvent.change(screen.getByLabelText('Out of range for Point buy'), {
      target: { value: 'extrapolate' },
    });

    expect(stored()?.outOfRange).toBe('extrapolate');
  });

  it('should re-spell a formula when a column is renamed', async () => {
    render(<CurvesConfigPanel />);

    fireEvent.click(screen.getByRole('button', { name: 'Edit column main' }));
    const dialog = within(screen.getByRole('dialog', { name: 'Edit Column' }));
    fireEvent.change(dialog.getByLabelText(/Column Name/), { target: { value: 'main_type' } });
    fireEvent.click(dialog.getByRole('button', { name: 'Save Changes' }));

    await waitFor(() =>
      expect(
        useConfigStore.getState().config?.stats.find((candidate) => candidate.formula)?.formula
      ).toBe('curve.point_buy.main_type(STR)')
    );
  });

  it('should refuse to delete a column a formula reads, naming what points at it', async () => {
    render(<CurvesConfigPanel />);

    fireEvent.click(screen.getByRole('button', { name: 'Delete column main' }));

    const dialog = within(await screen.findByRole('dialog', { name: 'Still In Use' }));
    expect(dialog.getByText(/Column Point buy · main cannot be deleted/)).toBeDefined();
    expect(dialog.getByText(/Stat: Gain/)).toBeDefined();
    expect(stored()?.columns).toHaveLength(2);
  });

  it('should refuse a generator that names something out of scope', async () => {
    render(<CurvesConfigPanel />);

    fireEvent.click(screen.getByRole('button', { name: 'Add Column' }));
    const dialog = within(screen.getByRole('dialog', { name: 'Add Column' }));
    fireEvent.change(dialog.getByLabelText(/Column Name/), { target: { value: 'sub' } });
    fireEvent.change(dialog.getByPlaceholderText(/0.75/), {
      target: { value: 'const.missing * key' },
    });
    fireEvent.click(dialog.getByRole('button', { name: 'Add Column' }));

    // Refused at the form, not survived to a failed cell after Regenerate
    expect(await screen.findByText(/Unknown member: const.missing/)).toBeDefined();
    expect(stored()?.columns).toHaveLength(2);
  });

  it('should keep a hand-entered column’s numbers when it is given a generator', async () => {
    render(<CurvesConfigPanel />);

    fireEvent.click(screen.getByRole('button', { name: 'Edit column non' }));
    const dialog = within(screen.getByRole('dialog', { name: 'Edit Column' }));
    fireEvent.change(dialog.getByPlaceholderText(/0.75/), { target: { value: 'key * 10' } });
    fireEvent.click(dialog.getByRole('button', { name: 'Save Changes' }));

    // Everything somebody typed is flagged, so regenerating cannot overwrite it silently
    await waitFor(() => expect(stored()?.columns[0].generator).toBe('key * 10'));
    expect(stored()?.rows.map((row) => row.overridden?.[0])).toEqual([true, true, true]);

    fireEvent.click(screen.getByRole('button', { name: 'Regenerate' }));
    expect(stored()?.rows.map((row) => row.values[0])).toEqual([0, 1, 1]);
  });

  it('should refuse a column name that is not a lowercase identifier', async () => {
    render(<CurvesConfigPanel />);

    fireEvent.click(screen.getByRole('button', { name: 'Add Column' }));
    const dialog = within(screen.getByRole('dialog', { name: 'Add Column' }));
    fireEvent.change(dialog.getByLabelText(/Column Name/), { target: { value: 'Main Type' } });
    fireEvent.click(dialog.getByRole('button', { name: 'Add Column' }));

    expect(await screen.findByText(/Use lowercase letters, digits and underscores/)).toBeDefined();
    expect(stored()?.columns).toHaveLength(2);
  });

  it('should refuse a second column with a name this curve already has', async () => {
    render(<CurvesConfigPanel />);

    fireEvent.click(screen.getByRole('button', { name: 'Add Column' }));
    const dialog = within(screen.getByRole('dialog', { name: 'Add Column' }));
    fireEvent.change(dialog.getByLabelText(/Column Name/), { target: { value: 'main' } });
    fireEvent.click(dialog.getByRole('button', { name: 'Add Column' }));

    expect(await screen.findByText(/Point buy already has a column named main/)).toBeDefined();
    expect(stored()?.columns).toHaveLength(2);
  });

  it('should refuse a curve name that is not a lowercase identifier or is taken', async () => {
    render(<CurvesConfigPanel />);

    fireEvent.click(screen.getByRole('button', { name: 'Add Curve' }));
    const dialog = within(screen.getByRole('dialog', { name: 'Add Curve' }));
    fireEvent.change(dialog.getByLabelText(/Display Name/), { target: { value: 'XP' } });
    fireEvent.change(dialog.getByLabelText(/Input Axis/), { target: { value: 'level' } });
    fireEvent.change(dialog.getByLabelText(/Formula Name/), { target: { value: 'XP Table' } });
    fireEvent.click(dialog.getByRole('button', { name: 'Add Curve' }));

    expect(await screen.findByText(/Use lowercase letters, digits and underscores/)).toBeDefined();

    // A duplicate splits identity from behaviour — the same argument as for constants
    fireEvent.change(dialog.getByLabelText(/Formula Name/), { target: { value: 'point_buy' } });
    fireEvent.click(dialog.getByRole('button', { name: 'Add Curve' }));

    expect(await screen.findByText(/A curve named point_buy already exists/)).toBeDefined();
    expect(useConfigStore.getState().config?.curves).toHaveLength(1);
  });

  it('should refuse to delete a curve a formula calls, naming what points at it', () => {
    render(<CurvesConfigPanel />);

    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));

    const dialog = within(screen.getByRole('dialog', { name: 'Still In Use' }));
    expect(dialog.getByText(/Curve Point buy cannot be deleted/)).toBeDefined();
    expect(dialog.getByText(/Stat: Gain/)).toBeDefined();
    expect(useConfigStore.getState().config?.curves).toHaveLength(1);
  });

  it('should show the empty state for a ruleset with no curves', () => {
    useConfigStore.setState({ config: { ...structuredClone(config), curves: [] } });

    render(<CurvesConfigPanel />);

    expect(screen.getByText(/No curves configured yet/)).toBeDefined();
  });
});
