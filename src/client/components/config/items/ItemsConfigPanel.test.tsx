/**
 * Items Configuration Panel Tests
 *
 * Tests for the ItemsConfigPanel component.
 *
 * The TICKET-ITEM-01 half drives the real store: the shop headings are the ruleset's own words
 * rather than a list the app knows, a ruleset naming no shops keeps the flat grid it always had, and
 * a saved template's skill vector is **sparse** — what the panel writes is what the store holds.
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import type { Configuration, Item, Skill } from '#shared/types/config';
import { useConfigStore } from '../../../stores/configStore';
import { ItemsConfigPanel } from './ItemsConfigPanel';

describe('ItemsConfigPanel', () => {
  beforeEach(() => {
    // Initialize empty config
    useConfigStore.getState().initializeConfig('Test Config');
  });

  it('renders without crashing', () => {
    render(<ItemsConfigPanel />);
    expect(screen.getByRole('heading', { name: 'Items' })).toBeDefined();
  });

  it('displays add item button', () => {
    render(<ItemsConfigPanel />);
    expect(screen.getByText('Add Item')).toBeDefined();
  });

  it('does not manage equipment slots itself (CR-20)', () => {
    render(<ItemsConfigPanel />);

    // `EquipmentSlotsConfigPanel` owns the slot flow, on `/config/equipment` since TICKET-INV-02 —
    // a second Add button and a second dialog here were two copies of the same entity
    expect(screen.queryByRole('button', { name: 'Add Equipment Slot' })).toBeNull();
  });

  it('no longer asks for materials before a template can be defined (TICKET-INV-05)', () => {
    // A template names no material since the fused pair retired, so a ruleset with no materials at
    // all can have a complete item catalog — the prerequisite went with the picker it pointed at
    render(<ItemsConfigPanel />);
    expect(screen.queryByText(/No materials configured yet/)).toBeNull();
  });

  it('offers no material picker in the form (TICKET-INV-05)', () => {
    render(<ItemsConfigPanel />);
    fireEvent.click(screen.getByRole('button', { name: 'Add Item' }));

    // What a thing is made of is chosen when a Player builds one — TICKET-INV-06's builder
    expect(screen.queryByLabelText(/^Material/)).toBeNull();
  });

  it('points at the equipment page when no equipment slots are configured', () => {
    render(<ItemsConfigPanel />);
    expect(screen.getByText(/Configuration → Equipment/)).toBeDefined();
  });

  it('shows empty state when no items configured', () => {
    render(<ItemsConfigPanel />);
    expect(screen.getByText(/No items configured yet/)).toBeDefined();
  });

  it('reports a refused save through the shared field, not a raw span (CR-23)', async () => {
    render(<ItemsConfigPanel />);
    fireEvent.click(screen.getByRole('button', { name: 'Add Item' }));

    // `FormField` associates the label, which the hand-rolled generation also did — what it also
    // brings is one error node instead of this file's `<span className="text-xs text-crimson">`
    const nameField = screen.getByLabelText(/^Name/);
    fireEvent.submit(nameField.closest('form') as HTMLFormElement);

    await waitFor(() => {
      const message = screen.getByText('Name is required');
      // `Text variant="error"`'s ground, the one every other dialog's refusal renders in
      expect(message.className).toContain('text-crimson');
    });
  });

  describe('shops and skill vectors (v4 systems/11, TICKET-ITEM-01)', () => {
    const SKILLS: Skill[] = [
      { id: 'athletics-id', name: 'Athletics', description: '', statWeights: [] },
      { id: 'sneaking-id', name: 'Sneaking', description: '', statWeights: [] },
    ];

    /**
     * A ruleset holding the given templates and the two skills a vector may name
     *
     * @param items - The templates to list
     * @returns The configuration
     */
    function createConfig(items: Item[]): Configuration {
      return {
        id: 'config1',
        name: 'Test Config',
        version: '1.0',
        schemaVersion: 10,
        stats: [],
        skills: SKILLS,
        materials: [],
        materialCategories: [],
        items,
        equipmentSlots: [],
        races: [],
        currencyTiers: [],
        createdAt: '2024-01-01',
        updatedAt: '2024-01-01',
      };
    }

    const storedItems = () => useConfigStore.getState().config?.items ?? [];

    const openNewItemDialog = () => {
      fireEvent.click(screen.getByRole('button', { name: 'Add Item' }));
      fireEvent.change(screen.getByLabelText(/^Name/), { target: { value: 'Battleaxe' } });
    };

    // The panel's action and the dialog's submit are both labelled "Add Item", so the save is
    // driven through the form itself — which is what the button does anyway
    const submitNewItem = () => {
      const nameField = screen.getByLabelText(/^Name/);
      fireEvent.submit(nameField.closest('form') as HTMLFormElement);
    };

    it('should list templates under the shop headings the ruleset names', () => {
      useConfigStore.setState({
        config: createConfig([
          { id: 'axe', name: 'Battleaxe', description: '', shop: 'Imperial Forge' },
          { id: 'bread', name: 'Bread', description: '', shop: 'Imperial Grocery' },
          { id: 'sword', name: 'Claymore', description: '', shop: 'Imperial Forge' },
        ]),
        isLoaded: true,
      });

      render(<ItemsConfigPanel />);

      expect(screen.getByRole('heading', { name: 'Imperial Forge' })).toBeDefined();
      expect(screen.getByRole('heading', { name: 'Imperial Grocery' })).toBeDefined();
      expect(screen.getByText('Battleaxe')).toBeDefined();
      expect(screen.getByText('Claymore')).toBeDefined();
    });

    it('should head a shop the app has never heard of, because the headings are the data', () => {
      useConfigStore.setState({
        config: createConfig([
          { id: 'potion', name: 'Elixir', description: '', shop: "Grandma's Cauldron" },
        ]),
        isLoaded: true,
      });

      render(<ItemsConfigPanel />);

      expect(screen.getByRole('heading', { name: "Grandma's Cauldron" })).toBeDefined();
    });

    it('should give a ruleset that names no shops the flat list it always had', () => {
      useConfigStore.setState({
        config: createConfig([
          { id: 'axe', name: 'Battleaxe', description: '', categoryId: 'Weapons' },
        ]),
        isLoaded: true,
      });

      render(<ItemsConfigPanel />);

      // The template is listed, and no heading was invented above it
      expect(screen.getByText('Battleaxe')).toBeDefined();
      expect(screen.queryByRole('heading', { level: 3 })).toBeNull();
    });

    it('should keep the category filter working alongside the shops', () => {
      useConfigStore.setState({
        config: createConfig([
          { id: 'axe', name: 'Battleaxe', description: '', categoryId: 'Arsenal', shop: 'Forge' },
          { id: 'bread', name: 'Bread', description: '', categoryId: 'Bakery', shop: 'Grocery' },
        ]),
        isLoaded: true,
      });

      render(<ItemsConfigPanel />);
      fireEvent.change(screen.getByDisplayValue('All Categories'), {
        target: { value: 'Bakery' },
      });

      // Narrowing to one category leaves that category's shop heading and no other
      expect(screen.getByText('Bread')).toBeDefined();
      expect(screen.queryByText('Battleaxe')).toBeNull();
      expect(screen.getByRole('heading', { name: 'Grocery' })).toBeDefined();
      expect(screen.queryByRole('heading', { name: 'Forge' })).toBeNull();
    });

    it('should spell a saved templates bonuses by skill name on its card', () => {
      useConfigStore.setState({
        config: createConfig([
          {
            id: 'axe',
            name: 'Battleaxe',
            description: '',
            skillBonuses: [
              { skillId: 'athletics-id', modifier: 2 },
              { skillId: 'sneaking-id', modifier: -1 },
            ],
          },
        ]),
        isLoaded: true,
      });

      render(<ItemsConfigPanel />);

      expect(screen.getByText(/Athletics: \+2/)).toBeDefined();
      expect(screen.getByText(/Sneaking: -1/)).toBeDefined();
    });

    it('should store only the skills a template actually moves', async () => {
      useConfigStore.setState({ config: createConfig([]), isLoaded: true });
      render(<ItemsConfigPanel />);

      openNewItemDialog();
      fireEvent.click(screen.getByRole('button', { name: 'Add Skill Bonus' }));
      fireEvent.click(screen.getByRole('button', { name: 'Add Skill Bonus' }));

      fireEvent.change(screen.getByRole('combobox', { name: 'Skill for skill bonus row 1' }), {
        target: { value: 'athletics-id' },
      });
      fireEvent.change(screen.getByLabelText('Modifier for row 1'), { target: { value: '2' } });
      fireEvent.change(screen.getByRole('combobox', { name: 'Skill for skill bonus row 2' }), {
        target: { value: 'sneaking-id' },
      });
      // Left at zero: it moves nothing, so it is not part of the vector
      fireEvent.change(screen.getByLabelText('Modifier for row 2'), { target: { value: '0' } });

      submitNewItem();

      await waitFor(() => {
        expect(storedItems()[0]?.skillBonuses).toEqual([{ skillId: 'athletics-id', modifier: 2 }]);
      });
    });

    it('should drop a row whose number box was cleared, not store NaN', async () => {
      // The modifier registers `{ valueAsNumber: true }`, so an emptied box is **`NaN`** rather
      // than 0. A `!== 0` test alone lets it through, `calculateEquipmentSkillBonuses` sums it into
      // the wielder's bonus as `NaN` on the sheet, and it serialises as `"modifier": null` — which
      // this app's own `itemSkillBonusShapeErrors` then refuses on re-import. The panel must not
      // write a document its own importer rejects.
      useConfigStore.setState({ config: createConfig([]), isLoaded: true });
      render(<ItemsConfigPanel />);

      openNewItemDialog();
      fireEvent.click(screen.getByRole('button', { name: 'Add Skill Bonus' }));
      fireEvent.change(screen.getByRole('combobox', { name: 'Skill for skill bonus row 1' }), {
        target: { value: 'athletics-id' },
      });
      fireEvent.change(screen.getByLabelText('Modifier for row 1'), { target: { value: '' } });

      submitNewItem();

      await waitFor(() => {
        expect(storedItems()).toHaveLength(1);
      });
      expect(storedItems()[0]).not.toHaveProperty('skillBonuses');
    });

    it('should delete the vector key when the User removes every bonus row', async () => {
      // `shop`'s rule on the other optional field: an emptied vector is the same document as one
      // that never had a vector, because `sparseSkillBonuses` returns `undefined` and
      // `mergeClearingAbsent` deletes the key
      useConfigStore.setState({
        config: createConfig([
          {
            id: 'axe',
            name: 'Battleaxe',
            description: '',
            skillBonuses: [{ skillId: 'athletics-id', modifier: 2 }],
          },
        ]),
        isLoaded: true,
      });
      render(<ItemsConfigPanel />);

      fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
      fireEvent.click(screen.getByRole('button', { name: 'Remove' }));
      fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }));

      await waitFor(() => {
        expect(storedItems()[0]).not.toHaveProperty('skillBonuses');
      });
    });

    it('should leave a template that moves nothing without a vector key at all', async () => {
      useConfigStore.setState({ config: createConfig([]), isLoaded: true });
      render(<ItemsConfigPanel />);

      openNewItemDialog();
      submitNewItem();

      await waitFor(() => {
        expect(storedItems()).toHaveLength(1);
      });
      expect(storedItems()[0]).not.toHaveProperty('skillBonuses');
      expect(storedItems()[0]).not.toHaveProperty('shop');
    });

    it('should delete the shop key when the User clears the field', async () => {
      useConfigStore.setState({
        config: createConfig([
          { id: 'axe', name: 'Battleaxe', description: '', shop: 'Imperial Forge' },
        ]),
        isLoaded: true,
      });
      render(<ItemsConfigPanel />);

      fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
      fireEvent.change(screen.getByLabelText(/^Shop/), { target: { value: '   ' } });
      fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }));

      await waitFor(() => {
        expect(storedItems()[0]).not.toHaveProperty('shop');
      });
    });
  });
});
