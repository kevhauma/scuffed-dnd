/**
 * Spellbook Panel Tests (TICKET-SPL-02)
 *
 * The stores are real with storage mocked, so a learn really goes through the store action and back
 * out as rendered state — `InventoryPanel.test.tsx`'s arrangement, and for its reason: what these
 * cases are about is the *loop* (search → learn → read → cast → watch the pool), which a hook tested
 * in isolation cannot show.
 *
 * Four things:
 *
 * 1. **The book is the sheet's `FILTER`** — learning puts a spell in it and takes it out of the
 *    search, with neither control touching the other, because there is one list.
 * 2. **A cast moves the pool**, and an unaffordable one is refused with the shortfall on screen.
 * 3. **The pool selector appears only when the ruleset has a choice to make**, which is what the
 *    User's ruling asks for.
 * 4. **A spell the ruleset has lost is a row a Player can clear**, not a crash and not a silent gap.
 *
 * **Validates: v4 systems/13 gaps 2, 3; Requirements 21.1-21.5**
 */

import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Character } from '#shared/types/character';
import type { Configuration } from '#shared/types/config';

vi.mock('../../../services/storage', () => ({
  loadConfiguration: vi.fn(() => null),
  saveConfiguration: vi.fn(),
  loadCharacters: vi.fn(() => []),
  saveCharacters: vi.fn(),
  isStorageAvailable: vi.fn(() => true),
}));

import { useCharacterStore } from '../../../stores/characterStore';
import { useConfigStore } from '../../../stores/configStore';
import { SpellbookPanel } from './SpellbookPanel';

/** One resource stat at a maximum of 100, and three spells the cases pick from */
function createConfig(overrides: Partial<Configuration> = {}): Configuration {
  return {
    id: 'config1',
    name: 'Test Config',
    version: '1.0',
    schemaVersion: 10,
    stats: [
      {
        id: 'mana',
        name: 'Mana',
        abbreviation: 'MAN',
        description: '',
        order: 0,
        countsTowardTotal: false,
        isResource: true,
        rounding: 'none',
        formula: '100',
      },
    ],
    skills: [
      {
        id: 'skill-fire',
        name: 'Fire',
        description: '',
        statWeights: [{ statId: 'mana', weight: 0.1 }],
      },
    ],
    materials: [],
    materialCategories: [],
    items: [],
    equipmentSlots: [],
    races: [],
    spells: [
      {
        id: 'bolt',
        name: 'Firebolt',
        manaCost: 10,
        rangeTime: '120 Feet',
        effectTemplate: 'A mote of fire streaks toward a creature.',
      },
      { id: 'storm', name: 'Meteor Storm', manaCost: 400, rangeTime: '1 mile', effectTemplate: '' },
      { id: 'ward', name: 'Ward', manaCost: 60, rangeTime: 'touch', effectTemplate: '' },
    ],
    currencyTiers: [],
    createdAt: '2024-01-01',
    updatedAt: '2024-01-01',
    ...overrides,
  } as unknown as Configuration;
}

function createCharacter(overrides: Partial<Character> = {}): Character {
  return {
    id: 'char1',
    name: 'Aria',
    configurationId: 'config1',
    raceIds: [],
    investedStatPoints: {},
    investedSkillPoints: {},
    currentResourceValues: { mana: 30 },
    experience: 0,
    inventory: { equippedItems: {}, composedItems: [] },
    createdAt: '2024-01-01',
    updatedAt: '2024-01-01',
    ...overrides,
  };
}

/** Put a ruleset and one character in the stores, and draw the panel against them */
function drawSpellbook(config: Configuration, character: Character) {
  useConfigStore.setState({ config });
  useCharacterStore.setState({ characters: [character], isLoaded: true, actionError: null });

  return render(<SpellbookPanel characterId={character.id} />);
}

/** The character as the store now holds it */
function stored(): Character {
  return useCharacterStore.getState().characters[0];
}

describe('SpellbookPanel', () => {
  beforeEach(() => {
    useCharacterStore.setState({ characters: [], isLoaded: false, actionError: null });
    useConfigStore.setState({ config: null });
    vi.clearAllMocks();
  });

  it('draws nothing at all for a ruleset that knows no magic', () => {
    const { container } = drawSpellbook(createConfig({ spells: [] }), createCharacter());

    expect(container.innerHTML).toBe('');
  });

  it('still draws for a character holding an id after the ruleset lost every spell', () => {
    // **The browser check found this**, and it is the one arrangement where hiding the panel is a
    // trap rather than tidiness: force-deleting the last spell a Player had learned empties the
    // compendium *and* leaves them an id, so a panel gated on the compendium alone would make the
    // leftover permanent — visible to nothing, clearable by nothing.
    drawSpellbook(createConfig({ spells: [] }), createCharacter({ learnedSpellIds: ['bolt'] }));

    expect(screen.getByText('A spell this ruleset no longer has')).toBeDefined();

    fireEvent.click(screen.getByRole('button', { name: 'Unlearn' }));

    expect('learnedSpellIds' in stored()).toBe(false);
  });

  it('starts empty and says so', () => {
    drawSpellbook(createConfig(), createCharacter());

    expect(screen.getByText('No spells learned yet.')).toBeDefined();
  });

  it('learns what the search found, which then leaves the search', () => {
    // One list: `spellbookOf` derives the book, and the picker offers what is *not* in it — so a
    // learned spell cannot be offered twice and cannot be missing from the book
    drawSpellbook(createConfig(), createCharacter());

    fireEvent.change(screen.getByLabelText('Learn a spell'), { target: { value: 'fire' } });
    fireEvent.click(screen.getByRole('button', { name: 'Learn' }));

    expect(stored().learnedSpellIds).toEqual(['bolt']);
    expect(screen.getByText('Firebolt')).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Learn' })).toBeNull();
  });

  it('shows the cost, the range and the effect the sheet stored', () => {
    drawSpellbook(createConfig(), createCharacter({ learnedSpellIds: ['bolt'] }));

    expect(screen.getByText('10 mana · 120 Feet')).toBeDefined();
    expect(screen.getByText('A mote of fire streaks toward a creature.')).toBeDefined();
  });

  it('casts, taking the cost off the pool', () => {
    drawSpellbook(createConfig(), createCharacter({ learnedSpellIds: ['bolt'] }));

    fireEvent.click(screen.getByRole('button', { name: 'Cast' }));

    expect(stored().currentResourceValues.mana).toBe(20);
    expect(screen.getByText('Casting from Mana — 20 left.')).toBeDefined();
  });

  it('refuses a cast the pool cannot pay for, leaving it where it was', () => {
    drawSpellbook(createConfig(), createCharacter({ learnedSpellIds: ['storm'] }));

    fireEvent.click(screen.getByRole('button', { name: 'Cast' }));

    expect(stored().currentResourceValues.mana).toBe(30);
    expect(useCharacterStore.getState().actionError).toContain('370 short');
  });

  it('unlearns, which empties the book', () => {
    drawSpellbook(createConfig(), createCharacter({ learnedSpellIds: ['bolt'] }));

    fireEvent.click(screen.getByRole('button', { name: 'Unlearn' }));

    expect('learnedSpellIds' in stored()).toBe(false);
    expect(screen.getByText('No spells learned yet.')).toBeDefined();
  });

  it('draws a spell the ruleset has lost as a row that can only be unlearned', () => {
    // The validation finding a force-deleted spell leaves behind. Dropping the row would leave the
    // Player holding an id nothing can see and nothing can clear.
    drawSpellbook(createConfig(), createCharacter({ learnedSpellIds: ['deleted-under-them'] }));

    expect(screen.getByText('A spell this ruleset no longer has')).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Cast' })).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Unlearn' }));

    expect('learnedSpellIds' in stored()).toBe(false);
  });

  describe('the effect, resolved for this caster (TICKET-SPL-03)', () => {
    it('fills a placeholder in from the character rather than showing the template', () => {
      // Mana derives to 100, so `{stats.mana}` reads 100 *for them* — that is the whole of v4 D4
      const templated = createConfig({
        spells: [
          {
            id: 'bolt',
            name: 'Firebolt',
            manaCost: 10,
            rangeTime: '120 Feet',
            effectTemplate: 'a {stats.mana}-foot line takes damage',
          },
        ],
      });

      drawSpellbook(templated, createCharacter({ learnedSpellIds: ['bolt'] }));

      expect(screen.getByText('100')).toBeDefined();
      expect(screen.queryByText(/\{stats\.mana\}/)).toBeNull();
    });

    it('reads a stat by its bare abbreviation, as the sheet writes a cell', () => {
      const templated = createConfig({
        spells: [
          {
            id: 'bolt',
            name: 'Firebolt',
            manaCost: 10,
            rangeTime: '120 Feet',
            effectTemplate: 'takes {MAN} damage',
          },
        ],
      });

      drawSpellbook(templated, createCharacter({ learnedSpellIds: ['bolt'] }));

      expect(screen.getByText('100')).toBeDefined();
    });

    it('chips one number and keeps the rest of the sentence', () => {
      // Errors are values (Concept 00 §7): a stat the ruleset lost costs the reader that number
      // and not the sentence around it
      const templated = createConfig({
        spells: [
          {
            id: 'bolt',
            name: 'Firebolt',
            manaCost: 10,
            rangeTime: '120 Feet',
            effectTemplate: 'deals {stats.gone} damage in a fiery burst',
          },
        ],
      });

      const { container } = drawSpellbook(
        templated,
        createCharacter({ learnedSpellIds: ['bolt'] })
      );

      // Read off the container rather than by text node: the sentence is deliberately split into
      // spans so a chip can sit inside it, which is the whole point of the rendering
      expect(container.textContent).toContain('deals ');
      expect(container.textContent).toContain(' damage in a fiery burst');
      expect(screen.getByRole('img', { name: /stats\.gone/ })).toBeDefined();
    });
  });

  it('says a spell is unpriced rather than showing it as free', () => {
    // `mighty fortress`'s swapped columns (v4 D1) — the compendium records no cost, and neither the
    // row nor the cast invents one
    const unpriced = createConfig({
      spells: [{ id: 'fortress', name: 'mighty fortress', rangeTime: '270', effectTemplate: '' }],
    });

    drawSpellbook(unpriced, createCharacter({ learnedSpellIds: ['fortress'] }));

    expect(screen.getByText('unpriced · 270')).toBeDefined();

    fireEvent.click(screen.getByRole('button', { name: 'Cast' }));

    expect(useCharacterStore.getState().actionError).toContain('does not price mighty fortress');
  });

  it('asks nothing when the ruleset has exactly one pool', () => {
    drawSpellbook(createConfig(), createCharacter());

    expect(screen.queryByLabelText('Cast from')).toBeNull();
    expect(screen.getByText('Casting from Mana — 30 left.')).toBeDefined();
  });

  it('offers the choice when the ruleset has more than one pool, and spends from the one picked', () => {
    // The User's ruling: nothing in a ruleset says which resource casting draws on, so the Player
    // picks at cast time — and a second pool is what makes that a real question
    const twoPools = createConfig();
    const stamina = { ...twoPools.stats[0], id: 'stamina', name: 'Stamina', abbreviation: 'STA' };
    const config = createConfig({ stats: [...twoPools.stats, stamina] });

    drawSpellbook(
      config,
      createCharacter({
        currentResourceValues: { mana: 30, stamina: 80 },
        learnedSpellIds: ['ward'],
      })
    );

    fireEvent.change(screen.getByLabelText('Cast from'), { target: { value: 'stamina' } });
    fireEvent.click(screen.getByRole('button', { name: 'Cast' }));

    expect(stored().currentResourceValues).toEqual({ mana: 30, stamina: 20 });
  });

  it('disables casting on a ruleset with no pools to spend from', () => {
    const poolless = createConfig({ stats: [] });

    drawSpellbook(poolless, createCharacter({ learnedSpellIds: ['bolt'] }));

    expect(screen.getByRole('button', { name: 'Cast' })).toHaveProperty('disabled', true);
    expect(
      screen.getByText(
        'This ruleset defines no resource pools, so there is nothing to spend on a cast.'
      )
    ).toBeDefined();
  });

  it('names what a capped search is not showing', () => {
    // No silent truncation: a short list that looks complete is worse than one that says it is not
    const many = Array.from({ length: 25 }, (_, index) => ({
      id: `spell-${index}`,
      name: `Ward ${index}`,
      manaCost: 10,
      rangeTime: 'touch',
      effectTemplate: '',
    }));

    drawSpellbook(createConfig({ spells: many }), createCharacter());

    fireEvent.change(screen.getByLabelText('Learn a spell'), { target: { value: 'ward' } });

    const cap = screen.getByText('Showing 20 of 25 matches — narrow the search to see the rest.');

    expect(cap).toBeDefined();
  });

  it('says when a search matches nothing left to learn', () => {
    drawSpellbook(createConfig(), createCharacter());

    fireEvent.change(screen.getByLabelText('Learn a spell'), { target: { value: 'zzz' } });

    expect(screen.getByText('Nothing left to learn by that name.')).toBeDefined();
  });
});
