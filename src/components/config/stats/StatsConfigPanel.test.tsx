/**
 * Stats Configuration Panel Tests
 *
 * The store is real with storage mocked, so what the cards show is what the ruleset actually
 * holds. Three things are asserted through the DOM rather than through the hook, because they are
 * the ticket's *surfacings* — a rule the User cannot see is a rule that does not exist: the
 * duplicate-abbreviation refusal, the invested/derived distinction, and Concept 01's
 * resource-without-a-ceiling warning.
 *
 * Reordering is asserted through the arrows rather than through a synthetic drag: both call the
 * same `handleReorder`, and the arrows are the path a keyboard takes.
 *
 * **Validates: Concept 01; Requirements 3.1, 21.1-21.5**
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
import { StatsConfigPanel } from './StatsConfigPanel';

const config: Configuration = {
  id: 'config1',
  name: 'Test Config',
  version: '1.0',
  schemaVersion: 9,
  stats: [
    {
      id: 'str-id',
      name: 'Strength',
      abbreviation: 'STR',
      description: 'Physical power',
      order: 0,
      countsTowardTotal: true,
      isResource: false,
      rounding: 'none',
      max: 30,
    },
    {
      id: 'mana-id',
      name: 'Mana',
      abbreviation: 'MAN',
      description: '',
      order: 1,
      countsTowardTotal: false,
      isResource: true,
      rounding: 'none',
    },
    {
      id: 'apt-id',
      name: 'Attacks per turn',
      abbreviation: 'APT',
      description: '',
      order: 2,
      countsTowardTotal: false,
      isResource: false,
      rounding: 'down',
      formula: 'STR / 10',
    },
  ],
  skills: [
    {
      id: 'heal-id',
      name: 'Healing',
      description: '',
      statWeights: [{ statId: 'str-id', weight: 0.2 }],
    },
  ],
  materials: [],
  materialCategories: [],
  items: [],
  equipmentSlots: [],
  races: [],
  currencyTiers: [],
  createdAt: '2024-01-01',
  updatedAt: '2024-01-01',
};

/** The open dialog, so a query cannot pick up the panel's own "Add Stat" button behind it */
const dialog = () => within(screen.getByRole('dialog'));

/** Open the add dialog and fill the identity fields every save needs */
function openAddDialogWith(name: string, abbreviation: string) {
  fireEvent.click(screen.getByRole('button', { name: 'Add Stat' }));
  fireEvent.change(dialog().getByLabelText(/^Name/), { target: { value: name } });
  fireEvent.change(dialog().getByLabelText(/^Abbreviation/), { target: { value: abbreviation } });
}

/**
 * The preview's single "at these values" number
 *
 * Read off that row rather than by text: the ladder repeats plenty of the same numbers, both as
 * level labels and as results.
 */
function previewResult(): string {
  const row = dialog().getByText('At these values').parentElement as HTMLElement;
  return within(row).getAllByText(/./)[1]?.textContent ?? '';
}

/**
 * The stat names in the order the panel lists them
 *
 * Read off the move buttons rather than the headings: one exists per stat card and nowhere else,
 * so the probe cannot pick up a heading from anything the panel renders around the list.
 */
function listedStatNames(): string[] {
  return screen
    .getAllByRole('button', { name: /^Move .+ down$/ })
    .map(
      (button) => button.getAttribute('aria-label')?.slice('Move '.length, -' down'.length) ?? ''
    );
}

describe('StatsConfigPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useConfigStore.setState({ config: structuredClone(config), isLoaded: true });
  });

  it('should list every stat with what kind it is and what bounds it', () => {
    render(<StatsConfigPanel />);

    expect(listedStatNames()).toEqual(['Strength', 'Mana', 'Attacks per turn']);
    // The badges come from the model's own rule — a formula is what makes a stat derived
    expect(screen.getAllByText('Invested')).toHaveLength(2);
    expect(screen.getByText('Derived')).toBeDefined();
    expect(screen.getByText('Resource')).toBeDefined();
    expect(screen.getByText('Max 30')).toBeDefined();
    expect(screen.getByText('Round down')).toBeDefined();
  });

  it('should say a stat is currently configured with no configuration loaded', () => {
    useConfigStore.setState({ config: null, isLoaded: true });

    render(<StatsConfigPanel />);

    expect(screen.getByText(/No configuration loaded/)).toBeDefined();
  });

  describe('the unified fields, end to end', () => {
    it('should add a stat carrying its flags, bounds and rounding', async () => {
      render(<StatsConfigPanel />);

      openAddDialogWith('Sanity', 'SAN');
      fireEvent.change(dialog().getByLabelText(/^Minimum/), { target: { value: '0' } });
      fireEvent.change(dialog().getByLabelText(/^Maximum/), { target: { value: '100' } });
      fireEvent.change(dialog().getByLabelText(/^Rounding/), { target: { value: 'nearest' } });
      fireEvent.click(dialog().getByRole('button', { name: 'Add Stat' }));

      // react-hook-form validates before it submits, so the store hears about it a tick later
      await waitFor(() => expect(useConfigStore.getState().config?.stats).toHaveLength(4));

      const sanity = useConfigStore
        .getState()
        .config?.stats.find((stat) => stat.abbreviation === 'SAN');
      expect(sanity).toMatchObject({
        name: 'Sanity',
        abbreviation: 'SAN',
        min: 0,
        max: 100,
        rounding: 'nearest',
        countsTowardTotal: true,
        isResource: false,
      });
      // Absent, not zero: an invested stat is one with no formula at all
      expect(sanity?.formula).toBeUndefined();
    });

    it('should clear a bound the User emptied rather than keeping the old number', async () => {
      render(<StatsConfigPanel />);

      // The first card is Strength, the only stat with a bound to clear
      fireEvent.click(screen.getAllByRole('button', { name: 'Edit' })[0]);
      fireEvent.change(dialog().getByLabelText(/^Maximum/), { target: { value: '' } });
      fireEvent.click(dialog().getByRole('button', { name: 'Update Stat' }));

      await waitFor(() =>
        expect(
          useConfigStore.getState().config?.stats.find((s) => s.id === 'str-id')?.max
        ).toBeUndefined()
      );
    });

    it('should load the stat being edited into the form', () => {
      render(<StatsConfigPanel />);

      fireEvent.click(screen.getAllByRole('button', { name: 'Edit' })[0]);

      expect(dialog().getByLabelText(/^Name/)).toHaveProperty('value', 'Strength');
      expect(dialog().getByLabelText(/^Maximum/)).toHaveProperty('value', '30');
      // Unbounded reads as empty, never as 0
      expect(dialog().getByLabelText(/^Minimum/)).toHaveProperty('value', '');
    });
  });

  describe('reordering', () => {
    it('should move a stat down and persist the new order', () => {
      render(<StatsConfigPanel />);

      fireEvent.click(screen.getByRole('button', { name: 'Move Strength down' }));

      expect(listedStatNames()).toEqual(['Mana', 'Strength', 'Attacks per turn']);
      // `order` is rewritten from the position, so the array and the field cannot drift apart
      expect(
        useConfigStore.getState().config?.stats.map((stat) => [stat.abbreviation, stat.order])
      ).toEqual([
        ['MAN', 0],
        ['STR', 1],
        ['APT', 2],
      ]);
    });

    it('should not offer a move that would do nothing', () => {
      render(<StatsConfigPanel />);

      expect(screen.getByRole('button', { name: 'Move Strength up' })).toHaveProperty(
        'disabled',
        true
      );
      expect(screen.getByRole('button', { name: 'Move Attacks per turn down' })).toHaveProperty(
        'disabled',
        true
      );
    });
  });

  describe('the three validation surfacings', () => {
    it('should refuse an abbreviation already taken in the flat formula space', async () => {
      render(<StatsConfigPanel />);

      // `MAN` belongs to the Mana stat. The flat space holds **stat abbreviations and nothing
      // else** since TICKET-ROLL-06 took the combat codes out with the entity — a `Skill` left it
      // in SKL-02, and a roll was never in it — so the only collision left is stat against stat.
      openAddDialogWith('Mana Pool', 'MAN');
      fireEvent.click(dialog().getByRole('button', { name: 'Add Stat' }));

      // The refusal is the store's since CR-17, and it names who holds the abbreviation
      expect(await screen.findByText('MAN is already used by "Mana"')).toBeDefined();
      // Refused, not saved
      expect(useConfigStore.getState().config?.stats).toHaveLength(3);
    });

    it('should say a stat with a formula takes no investment, and one without does', () => {
      render(<StatsConfigPanel />);

      openAddDialogWith('Sanity', 'SAN');
      expect(dialog().getByText(/Invested: this stat takes points/)).toBeDefined();

      // By label since CR-13: `FormulaEditor` associates its own label with its input now
      fireEvent.change(dialog().getByLabelText(/^Formula/), {
        target: { value: 'STR * 2' },
      });

      // The two are mutually exclusive by construction — there is no switch to disagree with
      expect(dialog().getByText(/Derived: this stat accepts no invested points/)).toBeDefined();
      expect(dialog().queryByText(/Invested: this stat takes points/)).toBeNull();
    });

    it('should warn about a resource with no ceiling without refusing it', async () => {
      render(<StatsConfigPanel />);

      openAddDialogWith('Stamina', 'STA');
      fireEvent.click(dialog().getByLabelText(/Is a resource/));

      expect(dialog().getByText(/no ceiling/)).toBeDefined();

      // A warning, not a refusal: the ruleset is coherent, the sheet just cannot draw a bar
      fireEvent.click(dialog().getByRole('button', { name: 'Add Stat' }));
      await waitFor(() =>
        expect(
          useConfigStore.getState().config?.stats.some((stat) => stat.abbreviation === 'STA')
        ).toBe(true)
      );
    });

    it('should preview the formula as the User types it (TICKET-FORM-08)', () => {
      render(<StatsConfigPanel />);

      openAddDialogWith('Vitality', 'VIT');
      const formulaField = dialog().getByPlaceholderText(/STR \* 10/);

      // Nothing to preview yet
      expect(dialog().queryByText('Preview')).toBeNull();

      fireEvent.change(formulaField, { target: { value: 'STR * 2' } });

      expect(dialog().getByText('Preview')).toBeDefined();
      // 10 * 2, at the default sample value
      expect(dialog().getByLabelText('STR')).toHaveProperty('value', '10');
      expect(previewResult()).toBe('20');
    });

    it('should survive an unparseable intermediate state without losing the field', () => {
      render(<StatsConfigPanel />);

      openAddDialogWith('Vitality', 'VIT');
      const formulaField = dialog().getByPlaceholderText(/STR \* 10/);
      formulaField.focus();

      fireEvent.change(formulaField, { target: { value: 'STR *' } });

      // Typing a formula goes through half-written states; the field must not unmount under the
      // User's cursor when it does
      expect(document.activeElement).toBe(formulaField);
      expect(dialog().getByText('Preview')).toBeDefined();
      expect(dialog().queryByLabelText('STR')).toBeNull();

      fireEvent.change(formulaField, { target: { value: 'STR * 3' } });

      expect(document.activeElement).toBe(formulaField);
      expect(previewResult()).toBe('30');
    });

    it('should drop the ceiling warning once the resource has a maximum', () => {
      render(<StatsConfigPanel />);

      openAddDialogWith('Stamina', 'STA');
      fireEvent.click(dialog().getByLabelText(/Is a resource/));
      fireEvent.change(dialog().getByLabelText(/^Maximum/), { target: { value: '50' } });

      expect(dialog().queryByText(/no ceiling/)).toBeNull();
    });
  });
});
