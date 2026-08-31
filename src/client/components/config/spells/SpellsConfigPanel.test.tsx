/**
 * Spells Configuration Panel Tests
 *
 * The store is real with storage mocked, so what the panel shows is what the ruleset actually holds
 * and a save really goes through `addSpell` / `updateSpell` / `deleteSpell`.
 *
 * **The scale cases are the ticket.** Every other config panel is tested against three or four
 * entities because that is what a ruleset has; the source workbook has 418 spells, and *the panel
 * stays usable at four hundred rows* is a claim only a four-hundred-row fixture can make. So the
 * search and the pager are asserted against `compendium(418)` rather than against a handful — a
 * panel that lists everything passes the four-row version of these cases perfectly.
 *
 * **Validates: v4 systems/13; Requirements 21.1-21.5**
 */

import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Configuration, Spell } from '#shared/types/config';

vi.mock('../../../services/storage', () => ({
  loadConfiguration: vi.fn(() => null),
  saveConfiguration: vi.fn(),
  loadCharacters: vi.fn(() => []),
  saveCharacters: vi.fn(),
  isStorageAvailable: vi.fn(() => true),
}));

import { useCharacterStore } from '../../../stores/characterStore';
import { useConfigStore } from '../../../stores/configStore';
import { SpellsConfigPanel } from './SpellsConfigPanel';

/** A plain row of the workbook: priced, ranged, with effect text */
const acidSplash: Spell = {
  id: 'acid-splash',
  name: 'Acid Splash',
  manaCost: 90,
  rangeTime: '60f',
  effectTemplate: 'lowers the endurance of creatures hit by 3',
};

/**
 * The compendium at the sheet's own scale
 *
 * Named after the spell's index so a case can name the one it expects to see, and priced off the
 * sheet's own 60–360 ladder so nothing depends on a made-up number.
 */
function compendium(count: number): Spell[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `spell-${index}`,
    name: `Spell ${index}`,
    manaCost: 60 + (index % 11) * 30,
    rangeTime: '60 Feet',
    effectTemplate: `Effect ${index}`,
  }));
}

function createConfig(overrides: Partial<Configuration> = {}): Configuration {
  return {
    id: 'config1',
    name: 'Test Config',
    version: '1.0',
    schemaVersion: 10,
    stats: [],
    skills: [],
    materials: [],
    materialCategories: [],
    items: [],
    equipmentSlots: [],
    races: [],
    currencyTiers: [],
    spells: [acidSplash],
    createdAt: '2024-01-01',
    updatedAt: '2024-01-01',
    ...overrides,
  };
}

const storedSpells = () => useConfigStore.getState().config?.spells ?? [];

const loadRuleset = (overrides: Partial<Configuration> = {}) => {
  act(() => {
    useConfigStore.setState({ config: createConfig(overrides), isLoaded: true });
  });
};

const search = (text: string) =>
  fireEvent.change(screen.getByLabelText(/^Search/), { target: { value: text } });

/** The dialog's submit, told apart from the header button of the same name by its `type` */
const submitDialog = (label: string) => {
  const submit = screen
    .getAllByRole('button', { name: label })
    .find((button) => (button as HTMLButtonElement).type === 'submit');
  fireEvent.click(submit as HTMLElement);
};

describe('SpellsConfigPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useConfigStore.setState({ config: createConfig(), isLoaded: true });
    useCharacterStore.setState({ characters: [], isLoaded: true });
  });

  it('should list a spell with its cost, reach and effect text', () => {
    render(<SpellsConfigPanel />);

    expect(screen.getByText('Acid Splash')).toBeDefined();
    expect(screen.getByText('90 mana')).toBeDefined();
    expect(screen.getByText('60f')).toBeDefined();
    expect(screen.getByText(/lowers the endurance/)).toBeDefined();
  });

  it('should say so rather than draw a zero when the ruleset prices nothing', () => {
    // `mighty fortress`'s shape — the workbook swaps its mana and range columns, so it has no
    // readable cost. Drawing `0 mana` would state a price the compendium does not contain.
    const { manaCost: _unpriced, ...unpriced } = acidSplash;
    loadRuleset({ spells: [{ ...unpriced, rangeTime: '' }] });

    render(<SpellsConfigPanel />);

    expect(screen.getAllByText('Not stated')).toHaveLength(2);
    expect(screen.queryByText('0 mana')).toBeNull();
  });

  it('should render an empty effect as an absence rather than as blank space', () => {
    // The `#VERW!` row: the sheet's effect cell is a live error, so the compendium holds an empty
    // template and the card has to say that it is empty rather than silently drawing nothing
    loadRuleset({ spells: [{ ...acidSplash, effectTemplate: '' }] });

    render(<SpellsConfigPanel />);

    expect(screen.getByText('No effect text.')).toBeDefined();
  });

  it('should show the empty state for a ruleset with no spells at all', () => {
    loadRuleset({ spells: undefined });

    render(<SpellsConfigPanel />);

    expect(screen.getByText(/No spells configured yet/)).toBeDefined();
    // Nothing to search through, so nothing to search with
    expect(screen.queryByLabelText(/^Search/)).toBeNull();
  });

  describe('at the sheet’s own scale', () => {
    beforeEach(() => {
      loadRuleset({ spells: compendium(418) });
    });

    it('should draw one page rather than four hundred cards', () => {
      render(<SpellsConfigPanel />);

      expect(screen.getByText('Showing 1–25 of 418')).toBeDefined();
      expect(screen.getByText('Page 1 of 17')).toBeDefined();
      expect(screen.getByText('Spell 0')).toBeDefined();
      expect(screen.queryByText('Spell 25')).toBeNull();
      expect(screen.queryByText('Spell 417')).toBeNull();
    });

    it('should page forward and back through the compendium', () => {
      render(<SpellsConfigPanel />);

      fireEvent.click(screen.getByRole('button', { name: 'Next' }));

      expect(screen.getByText('Showing 26–50 of 418')).toBeDefined();
      expect(screen.getByText('Spell 25')).toBeDefined();
      expect(screen.queryByText('Spell 0')).toBeNull();

      fireEvent.click(screen.getByRole('button', { name: 'Previous' }));

      expect(screen.getByText('Spell 0')).toBeDefined();
    });

    it('should stop at both ends of the pager', () => {
      render(<SpellsConfigPanel />);

      expect(screen.getByRole('button', { name: 'Previous' })).toHaveProperty('disabled', true);
      expect(screen.getByRole('button', { name: 'Next' })).toHaveProperty('disabled', false);
    });

    it('should find one spell out of four hundred by name, however it is cased', () => {
      render(<SpellsConfigPanel />);

      search('spell 417');

      expect(screen.getByText('Showing 1–1 of 1')).toBeDefined();
      expect(screen.getByText('Spell 417')).toBeDefined();
      expect(screen.queryByText('Spell 0')).toBeNull();
      // One match, so there is nothing left to page through
      expect(screen.queryByText(/^Page /)).toBeNull();
    });

    it('should count the whole match rather than the page in front of you', () => {
      // `Spell 1` matches 1, 1x and 1xx — 111 rows across five pages, and the header has to say
      // 111 rather than the 25 it drew
      render(<SpellsConfigPanel />);

      search('spell 1');

      expect(screen.getByText('Showing 1–25 of 111')).toBeDefined();
    });

    it('should send a narrowed list back to its first page', () => {
      // Otherwise typing a letter on page seven leaves the User staring at a page the new result
      // does not have
      render(<SpellsConfigPanel />);
      fireEvent.click(screen.getByRole('button', { name: 'Next' }));

      // `Spell 41` and `Spell 410`–`Spell 417`: nine rows, one page
      search('spell 41');

      expect(screen.getByText('Showing 1–9 of 9')).toBeDefined();
      expect(screen.getByText('Spell 410')).toBeDefined();
    });

    it('should say a search matched nothing rather than that the compendium is empty', () => {
      render(<SpellsConfigPanel />);

      search('necromancy');

      expect(screen.getByText('No spells match "necromancy".')).toBeDefined();
      expect(screen.queryByText(/No spells configured yet/)).toBeNull();
    });
  });

  describe('the effect preview (TICKET-SPL-03)', () => {
    /** A stat and a skill, so a placeholder has something to resolve against */
    const CASTER: Partial<Configuration> = {
      stats: [
        {
          id: 'stat-wis',
          name: 'Wisdom',
          abbreviation: 'WIS',
          description: '',
          order: 0,
          countsTowardTotal: true,
          isResource: false,
          rounding: 'none',
        },
      ],
      skills: [
        {
          id: 'skill-fire',
          name: 'Fire',
          description: '',
          statWeights: [{ statId: 'stat-wis', weight: 1 }],
        },
      ],
    };

    it('should show nothing for prose with no placeholder in it', () => {
      // 92 of the workbook's 418 effects are plain text, and a preview of a sentence that computes
      // nothing is a box saying the sentence back
      loadRuleset(CASTER);
      render(<SpellsConfigPanel />);

      fireEvent.click(screen.getByRole('button', { name: 'Add Spell' }));
      fireEvent.change(screen.getByLabelText(/^Effect/), {
        target: { value: 'The target falls prone.' },
      });

      expect(screen.queryByText('Preview')).toBeNull();
    });

    it('should resolve a placeholder at the sample values, in the sentence', () => {
      // The boxes default to 10, so Wisdom 10 → Fire level 10
      loadRuleset(CASTER);
      render(<SpellsConfigPanel />);

      fireEvent.click(screen.getByRole('button', { name: 'Add Spell' }));
      fireEvent.change(screen.getByLabelText(/^Effect/), {
        target: { value: 'a {WIS}-foot sphere takes {skills.fire.level} damage' },
      });

      expect(screen.getByText('Preview')).toBeDefined();
      expect(screen.getByText('a')).toBeDefined();
      expect(screen.getAllByText('10').length).toBeGreaterThan(0);
    });

    it('should re-resolve when the User changes a sample value', () => {
      loadRuleset(CASTER);
      render(<SpellsConfigPanel />);

      fireEvent.click(screen.getByRole('button', { name: 'Add Spell' }));
      fireEvent.change(screen.getByLabelText(/^Effect/), {
        target: { value: 'takes {WIS} damage' },
      });
      fireEvent.change(screen.getByLabelText('WIS'), { target: { value: '42' } });

      expect(screen.getByText('42')).toBeDefined();
    });

    it('should name a placeholder the ruleset cannot resolve, quoting which one', () => {
      loadRuleset(CASTER);
      render(<SpellsConfigPanel />);

      fireEvent.click(screen.getByRole('button', { name: 'Add Spell' }));
      fireEvent.change(screen.getByLabelText(/^Effect/), {
        target: { value: 'takes {stats.nonesuch} damage' },
      });

      expect(screen.getByText(/\{stats\.nonesuch\}/)).toBeDefined();
    });
  });

  it('should add a spell through the store', async () => {
    render(<SpellsConfigPanel />);

    fireEvent.click(screen.getByRole('button', { name: 'Add Spell' }));
    fireEvent.change(screen.getByLabelText(/^Name/), { target: { value: 'Fireball' } });
    fireEvent.change(screen.getByLabelText(/^Mana cost/), { target: { value: '150' } });
    fireEvent.change(screen.getByLabelText(/^Range \/ time/), { target: { value: '150 Feet' } });
    fireEvent.change(screen.getByLabelText(/^Effect/), {
      target: { value: 'takes 11 fire damage' },
    });
    submitDialog('Add Spell');

    await waitFor(() => {
      expect(storedSpells()).toHaveLength(2);
    });
    expect(storedSpells()[1]).toEqual({
      id: expect.any(String),
      name: 'Fireball',
      manaCost: 150,
      rangeTime: '150 Feet',
      effectTemplate: 'takes 11 fire damage',
    });
  });

  it('should store nothing for a cost the User leaves blank, rather than a NaN its own import refuses', async () => {
    // A number box registered `valueAsNumber` yields `NaN` when cleared, which serialises as
    // `null` and which `ENTITY_SPECS.spells` turns away — so the panel would be writing a ruleset
    // the app cannot re-import. The field is held as text and filtered on `Number.isFinite`.
    render(<SpellsConfigPanel />);

    fireEvent.click(screen.getByRole('button', { name: 'Add Spell' }));
    fireEvent.change(screen.getByLabelText(/^Name/), { target: { value: 'mighty fortress' } });
    fireEvent.change(screen.getByLabelText(/^Range \/ time/), { target: { value: '270' } });
    submitDialog('Add Spell');

    await waitFor(() => {
      expect(storedSpells()).toHaveLength(2);
    });
    expect(storedSpells()[1]).not.toHaveProperty('manaCost');
    expect(storedSpells()[1]).not.toHaveProperty('description');
    // …and the two free-text fields keep the blanks the sheet actually has
    expect(storedSpells()[1].effectTemplate).toBe('');
  });

  it('should edit a spell through the store', async () => {
    render(<SpellsConfigPanel />);

    fireEvent.click(screen.getByRole('button', { name: 'Edit Acid Splash' }));
    fireEvent.change(screen.getByLabelText(/^Mana cost/), { target: { value: '120' } });
    fireEvent.click(screen.getByRole('button', { name: 'Update Spell' }));

    await waitFor(() => {
      expect(storedSpells()[0].manaCost).toBe(120);
    });
    expect(storedSpells()[0].effectTemplate).toBe(acidSplash.effectTemplate);
  });

  it('should clear a cost back to unpriced rather than leaving the old number behind', async () => {
    render(<SpellsConfigPanel />);

    fireEvent.click(screen.getByRole('button', { name: 'Edit Acid Splash' }));
    fireEvent.change(screen.getByLabelText(/^Mana cost/), { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: 'Update Spell' }));

    await waitFor(() => {
      expect(storedSpells()[0]).not.toHaveProperty('manaCost');
    });
  });

  it('should delete a spell, since nothing can point at one yet', async () => {
    render(<SpellsConfigPanel />);

    fireEvent.click(screen.getByRole('button', { name: 'Delete Acid Splash' }));

    await waitFor(() => {
      expect(storedSpells()).toEqual([]);
    });
  });
});
