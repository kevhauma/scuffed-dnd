/**
 * Character Creation Wizard Tests
 *
 * **Validates: Requirements 11.1-11.6, 21.1-21.5**
 */

import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Configuration } from '../../../types/config';

const navigate = vi.fn();
vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => navigate,
}));

vi.mock('../../../services/storage', () => ({
  loadConfiguration: vi.fn(() => null),
  saveConfiguration: vi.fn(),
  loadCharacters: vi.fn(() => []),
  saveCharacters: vi.fn(),
  isStorageAvailable: vi.fn(() => true),
}));

import { calculateCharacter } from '../../../engine/calculator';
import { useCharacterStore } from '../../../stores/characterStore';
import { useConfigStore } from '../../../stores/configStore';
import { CharacterCreationWizard } from './CharacterCreationWizard';

function createConfig(overrides: Partial<Configuration> = {}): Configuration {
  return {
    id: 'config1',
    name: 'Test Config',
    version: '1.0',
    schemaVersion: 8,
    stats: [
      {
        id: 'STR',
        name: 'Strength',
        abbreviation: 'STR',
        description: '',
        order: 0,
        countsTowardTotal: true,
        isResource: false,
        rounding: 'none',
      },
      {
        id: 'DEX',
        name: 'Dexterity',
        abbreviation: 'DEX',
        description: '',
        order: 1,
        countsTowardTotal: true,
        isResource: false,
        rounding: 'none',
      },
      {
        id: 'health',
        name: 'Health',
        abbreviation: 'HEA',
        description: '',
        order: 0,
        countsTowardTotal: true,
        isResource: true,
        rounding: 'none',
        formula: 'STR * 10',
      },
    ],
    skills: [
      {
        id: 'STL',
        name: 'Stealth',
        description: '',
        // The weighted equivalent of v1's `DEX / 2` formula (TICKET-SKL-02)
        statWeights: [{ statId: 'DEX', weight: 0.5 }],
      },
    ],
    combatSkills: [
      {
        id: 'MEL',
        code: 'MEL',
        name: 'Melee',
        description: '',
        dice: { d4: 0, d6: 1, d8: 0, d10: 0, d12: 0, d20: 0 },
        bonusFormula: 'STR + skills.stealth',
      },
    ],
    materials: [],
    materialCategories: [],
    items: [],
    equipmentSlots: [{ type: 'main_hand', name: 'Main Hand', description: '' }],
    races: [
      {
        id: 'elf',
        name: 'Elf',
        description: '',
        statValues: { DEX: 2 },
      },
      { id: 'human', name: 'Human', description: '', statValues: {} },
    ],
    currencyTiers: [],
    // The budget is derived since TICKET-RES-02, so the fixture buys it rather than declaring it:
    // a fresh character is level 1 against the curve, and 12 points per level is the pool the
    // allocation assertions below are written against
    constants: [
      {
        id: 'const-ppl',
        name: 'points_per_level',
        displayName: 'Points per level',
        description: '',
        value: 12,
      },
    ],
    curves: [
      {
        id: 'curve-xp',
        name: 'xp_thresholds',
        displayName: 'XP thresholds',
        description: '',
        keyName: 'level',
        columns: [{ id: 'curve-xp-col', name: 'xp_required' }],
        rows: [
          { key: 1, values: [0] },
          { key: 2, values: [300] },
        ],
        interpolation: 'step',
        outOfRange: 'extrapolate',
        lookupDirection: 'reverse',
      },
    ],
    createdAt: '2024-01-01',
    updatedAt: '2024-01-01',
    ...overrides,
  };
}

/**
 * The row a stat is rendered in, found by its visible label
 *
 * Same idiom as `CharacterSheet.test.tsx` — the separator border identifies the row, since the
 * derived preview now renders the sheet's own `SkillBreakdownRow`.
 */
function rowFor(label: string | RegExp): HTMLElement {
  const cell = screen.getByText(label);
  const row = cell.closest('div.border-b');
  if (!row) throw new Error(`No row found for ${label}`);
  return row as HTMLElement;
}

const next = () => fireEvent.click(screen.getByRole('button', { name: 'Next' }));
const back = () => fireEvent.click(screen.getByRole('button', { name: 'Back' }));
const nameField = () => screen.getByLabelText(/Character Name/i);

/**
 * Fill the identity step and advance to the allocation step
 *
 * Two `next()`s since TICKET-ARC-03 put the archetype step between them. This fixture defines no
 * archetypes, so that step is always passable — which is itself the RACE-02-shaped rule that a
 * ruleset may define none.
 */
function toStatsStep(name = 'Aria') {
  fireEvent.change(nameField(), { target: { value: name } });
  next();
  next();
}

describe('CharacterCreationWizard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useConfigStore.setState({ config: createConfig(), isLoaded: true });
    useCharacterStore.setState({ characters: [], isLoaded: true });
  });

  it('should block step 1 until a name is entered, saying why', () => {
    render(<CharacterCreationWizard />);

    expect(screen.getByText(/Give your character a name/)).toBeDefined();
    expect(screen.getByRole('button', { name: 'Next' })).toHaveProperty('disabled', true);

    fireEvent.change(nameField(), { target: { value: 'Aria' } });

    expect(screen.queryByText(/Give your character a name/)).toBeNull();
    expect(screen.getByRole('button', { name: 'Next' })).toHaveProperty('disabled', false);
  });

  it('should preserve entered values when moving back and forward', () => {
    render(<CharacterCreationWizard />);

    toStatsStep('Aria');
    fireEvent.change(screen.getByLabelText(/Strength \(STR\)/), { target: { value: '4' } });

    back(); // Archetype
    back(); // Identity
    expect((nameField() as HTMLInputElement).value).toBe('Aria');

    next();
    next();
    expect((screen.getByLabelText(/Strength \(STR\)/) as HTMLInputElement).value).toBe('4');
  });

  it('should allow selecting zero, one or two races', () => {
    render(<CharacterCreationWizard />);

    // Zero races is valid — the name alone unblocks step 1
    fireEvent.change(nameField(), { target: { value: 'Aria' } });
    expect(screen.getByRole('button', { name: 'Next' })).toHaveProperty('disabled', false);

    fireEvent.click(screen.getByLabelText('Elf'));
    fireEvent.click(screen.getByLabelText('Human'));

    expect((screen.getByLabelText('Elf') as HTMLInputElement).checked).toBe(true);
    expect((screen.getByLabelText('Human') as HTMLInputElement).checked).toBe(true);
  });

  it('should refuse a third race and say why (TICKET-RACE-02)', () => {
    const config = createConfig({
      races: [
        { id: 'elf', name: 'Elf', description: '', statValues: { DEX: 2 } },
        { id: 'human', name: 'Human', description: '', statValues: {} },
        { id: 'dwarf', name: 'Dwarf', description: '', statValues: { STR: 4 } },
      ],
    });
    useConfigStore.setState({ config, isLoaded: true });

    render(<CharacterCreationWizard />);

    fireEvent.click(screen.getByLabelText('Elf'));
    fireEvent.click(screen.getByLabelText('Human'));

    // The third box is out of reach, and clicking it anyway changes nothing
    const dwarf = () => screen.getByLabelText('Dwarf') as HTMLInputElement;
    expect(dwarf().disabled).toBe(true);
    expect(screen.getByText(/That is 2 races/)).toBeDefined();

    fireEvent.click(dwarf());
    expect(dwarf().checked).toBe(false);

    // Clearing one puts the third back within reach
    fireEvent.click(screen.getByLabelText('Human'));
    expect(dwarf().disabled).toBe(false);
  });

  it('should show the blended base of two races on the allocation step (TICKET-RACE-02)', () => {
    render(<CharacterCreationWizard />);

    fireEvent.change(nameField(), { target: { value: 'Aria' } });
    fireEvent.click(screen.getByLabelText('Elf')); // DEX 2
    fireEvent.click(screen.getByLabelText('Human')); // says nothing about DEX
    next();
    next();

    // roundup((2 + 0) / 2) = 1, not the 2 the old additive stacking gave
    expect(screen.getByText(/\+1 racial/)).toBeDefined();
  });

  it('should show the racial modifier separately from the allocated base level', () => {
    render(<CharacterCreationWizard />);

    fireEvent.change(nameField(), { target: { value: 'Aria' } });
    fireEvent.click(screen.getByLabelText('Elf')); // DEX +2
    next();
    next();

    fireEvent.change(screen.getByLabelText(/Dexterity \(DEX\)/), { target: { value: '3' } });

    // The input still holds the allocated 3; the racial +2 and the total are shown beside it
    expect((screen.getByLabelText(/Dexterity \(DEX\)/) as HTMLInputElement).value).toBe('3');
    expect(screen.getByText(/\+2 racial/)).toBeDefined();
    expect(screen.getByText(/total 5/)).toBeDefined();
  });

  it('should block progress on a negative allocation', () => {
    // Replaces the old per-skill max-level rule, which retired with `MainSkill` — the unified
    // stat clamps its *value*, not what may be invested in it (TICKET-STAT-01)
    render(<CharacterCreationWizard />);

    toStatsStep();
    fireEvent.change(screen.getByLabelText(/Strength \(STR\)/), { target: { value: '-1' } });

    expect(screen.getByText(/Strength cannot go below 0/)).toBeDefined();
    expect(screen.getByRole('button', { name: 'Next' })).toHaveProperty('disabled', true);
  });

  it('should block progress when the allocation exceeds the point budget', () => {
    render(<CharacterCreationWizard />);

    toStatsStep();
    fireEvent.change(screen.getByLabelText(/Strength \(STR\)/), { target: { value: '10' } });
    fireEvent.change(screen.getByLabelText(/Dexterity \(DEX\)/), { target: { value: '5' } });

    // Budget is 12; 15 allocated
    expect(screen.getByText(/3 point\(s\) over the budget of 12/)).toBeDefined();
    expect(screen.getByRole('button', { name: 'Next' })).toHaveProperty('disabled', true);
  });

  it('should report points spent and remaining from the allocation validator', () => {
    render(<CharacterCreationWizard />);

    toStatsStep();
    fireEvent.change(screen.getByLabelText(/Strength \(STR\)/), { target: { value: '4' } });

    expect(screen.getByText(/4 of 12 points spent · 8 remaining/)).toBeDefined();
  });

  describe('the allocation step on unified stats (TICKET-STAT-03)', () => {
    it('should offer an input for an invested stat and none for a derived one', () => {
      render(<CharacterCreationWizard />);
      toStatsStep();

      expect(screen.getByLabelText(/Strength \(STR\)/)).toBeDefined();
      expect(screen.getByLabelText(/Dexterity \(DEX\)/)).toBeDefined();

      // Health is `STR * 10`, so points put into it would be discarded by the calculator
      expect(screen.queryByLabelText(/Health \(HEA\)/)).toBeNull();
      expect(screen.getByRole('heading', { name: 'Derived Stats' })).toBeDefined();
      expect(screen.getByText('Health (HEA)')).toBeDefined();
    });

    it("should move a derived stat's preview as points are allocated", () => {
      render(<CharacterCreationWizard />);
      toStatsStep();

      expect(within(rowFor('Health (HEA)')).getByText('0')).toBeDefined();

      fireEvent.change(screen.getByLabelText(/Strength \(STR\)/), { target: { value: '5' } });

      // Straight off the composed preview — the step evaluates nothing itself
      expect(within(rowFor('Health (HEA)')).getByText('50')).toBeDefined();
    });

    it('should list the invested stats in the order the ruleset arranges them', () => {
      useConfigStore.setState({
        config: createConfig({
          stats: createConfig().stats.map((stat) => ({
            ...stat,
            order: stat.id === 'DEX' ? 0 : 1,
          })),
        }),
        isLoaded: true,
      });

      render(<CharacterCreationWizard />);
      toStatsStep();

      const labels = screen
        .getAllByText(/^(Strength|Dexterity) \((STR|DEX)\)$/)
        .map((node) => node.textContent);

      expect(labels).toEqual(['Dexterity (DEX)', 'Strength (STR)']);
    });

    it('should say so rather than show 0 when the whole calculation fails', () => {
      // `calculateCharacter` throwing is an engine bug or a malformed ruleset, not an ordinary
      // formula mistake — but it must not reach the Player as a confident `Health 0` while they
      // allocate against it. A ruleset with no `races` array at all makes the engine throw.
      useConfigStore.setState({
        config: createConfig({ races: undefined as unknown as Configuration['races'] }),
        isLoaded: true,
      });

      render(<CharacterCreationWizard />);
      toStatsStep();

      const health = rowFor('Health (HEA)');
      expect(within(health).queryByText('0')).toBeNull();
      expect(within(health).getByRole('img', { name: /cannot be calculated/ })).toBeDefined();
    });

    it('should hide the derived card entirely when the ruleset has no derived stat', () => {
      useConfigStore.setState({
        config: createConfig({
          stats: createConfig().stats.filter((stat) => stat.formula === undefined),
        }),
        isLoaded: true,
      });

      render(<CharacterCreationWizard />);
      toStatsStep();

      expect(screen.queryByRole('heading', { name: 'Derived Stats' })).toBeNull();
    });
  });

  /**
   * The archetype step, which replaced the focus-stat step (Concept 03, TICKET-ARC-03)
   */
  describe('the archetype step', () => {
    /** Two archetypes, so a choice is actually offered */
    const withArchetypes = () =>
      createConfig({
        archetypes: [
          { id: 'strong', name: 'Strong', description: 'Raw force', statAffinity: { STR: 'main' } },
          { id: 'sneaky', name: 'Sneaky', description: 'Unseen', statAffinity: { DEX: 'main' } },
        ],
      });

    it('should offer no focus-stat control anywhere in the wizard', () => {
      render(<CharacterCreationWizard />);

      toStatsStep();
      next();

      expect(screen.queryByLabelText(/Focus stat/i)).toBeNull();
    });

    it('should say so rather than block when the ruleset defines no archetypes', () => {
      // The fixture defines none, which is legal — the same rule TICKET-RACE-02 kept for races
      render(<CharacterCreationWizard />);

      fireEvent.change(nameField(), { target: { value: 'Aria' } });
      next();

      expect(screen.getByText(/defines no archetypes/)).toBeDefined();
      expect(screen.getByRole('button', { name: 'Next' })).toHaveProperty('disabled', false);
    });

    it('should require a pick when the ruleset offers a choice', () => {
      useConfigStore.setState({ config: withArchetypes(), isLoaded: true });
      render(<CharacterCreationWizard />);

      fireEvent.change(nameField(), { target: { value: 'Aria' } });
      next();

      expect(screen.getByText('Pick an archetype before continuing.')).toBeDefined();
      expect(screen.getByRole('button', { name: 'Next' })).toHaveProperty('disabled', true);
    });

    it('should unblock once one is picked, and show which stats it favours', () => {
      useConfigStore.setState({ config: withArchetypes(), isLoaded: true });
      render(<CharacterCreationWizard />);

      fireEvent.change(nameField(), { target: { value: 'Aria' } });
      next();
      fireEvent.click(screen.getByRole('button', { name: /Strong/ }));

      expect(screen.getByRole('button', { name: /Strong/ }).getAttribute('aria-pressed')).toBe(
        'true'
      );
      expect(screen.getByRole('button', { name: 'Next' })).toHaveProperty('disabled', false);
    });

    it('should re-price the gains preview when the archetype changes', () => {
      // The whole reason the step comes before allocation: it decides what a point is worth
      useConfigStore.setState({
        config: createConfig({
          archetypes: withArchetypes().archetypes,
          curves: [
            ...(createConfig().curves ?? []),
            {
              id: 'curve-point-buy',
              name: 'point_buy',
              displayName: 'Point buy',
              description: '',
              keyName: 'points',
              columns: [
                { id: 'col-non', name: 'non' },
                { id: 'col-sub', name: 'sub' },
                { id: 'col-main', name: 'main' },
              ],
              rows: [
                { key: 0, values: [0, 0, 0] },
                { key: 5, values: [2, 3, 4.5] },
              ],
              interpolation: 'step',
              outOfRange: 'error',
              lookupDirection: 'forward',
            },
          ],
        }),
        isLoaded: true,
      });
      render(<CharacterCreationWizard />);

      fireEvent.change(nameField(), { target: { value: 'Aria' } });
      next();
      fireEvent.click(screen.getByRole('button', { name: /Strong/ }));
      next();
      fireEvent.change(screen.getByLabelText(/Strength \(STR\)/), { target: { value: '5' } });

      // STR is main for Strong: 5 points buy 4.5
      expect(screen.getByText('→ +4.5')).toBeDefined();

      back();
      fireEvent.click(screen.getByRole('button', { name: /Sneaky/ }));
      next();

      // …and non for Sneaky, so the same 5 points buy 2
      expect(screen.getByText('→ +2')).toBeDefined();
    });
  });

  it('should show review values that match calculateCharacter for the same data', () => {
    render(<CharacterCreationWizard />);

    fireEvent.change(nameField(), { target: { value: 'Aria' } });
    fireEvent.click(screen.getByLabelText('Elf'));
    next();
    next();
    fireEvent.change(screen.getByLabelText(/Strength \(STR\)/), { target: { value: '5' } });
    // Labelled by name alone — a `Skill` has no code to bracket (TICKET-SKL-02)
    fireEvent.change(screen.getByLabelText('Stealth'), { target: { value: '1' } });
    next();

    const expected = calculateCharacter(
      {
        id: 'x',
        name: 'Aria',
        configurationId: 'config1',
        raceIds: ['elf'],
        investedStatPoints: { STR: 5, DEX: 0 },
        investedSkillPoints: { STL: 1 },
        currentResourceValues: {},
        experience: 0,
        inventory: { equippedItems: {}, miscItems: [] },
        createdAt: '',
        updatedAt: '',
      },
      createConfig()
    );

    // Read each summary row by its label, since several derived values share a number
    const rowValue = (label: string) => screen.getByText(label).parentElement?.textContent ?? '';

    expect(screen.getByText('Aria')).toBeDefined();
    expect(rowValue('Health (HEA)')).toBe(`Health (HEA)${expected.statValues.health}`);
    // The review shows the **bonus** a Player rolls with, not the level (Concept 02)
    expect(rowValue('Stealth')).toBe(`Stealth${expected.skillBonuses.STL}`);
    expect(rowValue('Melee (MEL)')).toBe(`Melee (MEL)${expected.combatSkillBonuses.MEL}`);
    expect(rowValue('Dexterity (DEX)')).toBe(`Dexterity (DEX)${expected.statValues.DEX}`);
  });

  it('should preview numbers on review before anything is allocated (TICKET-CALC-02)', () => {
    // The wizard starts with an empty allocation map, so every configured main skill is
    // unallocated here — the reported repro at its purest. It must summarise as zeroes rather
    // than withhold the preview over `Undefined variable`.
    render(<CharacterCreationWizard />);

    fireEvent.change(nameField(), { target: { value: 'Aria' } });
    next(); // Archetype — the fixture defines none, so nothing to pick
    next(); // Stats — nothing entered
    next(); // Review

    expect(screen.queryByText(/formula that does not evaluate/)).toBeNull();

    const rowValue = (label: string) => screen.getByText(label).parentElement?.textContent ?? '';

    expect(rowValue('Strength (STR)')).toBe('Strength (STR)0');
    expect(rowValue('Health (HEA)')).toBe('Health (HEA)0'); // STR 0 * 10
    expect(rowValue('Melee (MEL)')).toBe('Melee (MEL)0'); // STR 0 + STL 0
  });

  it('should create the character once and navigate to its sheet', () => {
    render(<CharacterCreationWizard />);

    fireEvent.change(nameField(), { target: { value: 'Aria' } });
    fireEvent.click(screen.getByLabelText('Elf'));
    next(); // Archetype — none defined in this fixture
    next();
    fireEvent.change(screen.getByLabelText(/Strength \(STR\)/), { target: { value: '5' } });
    next();

    fireEvent.click(screen.getByRole('button', { name: 'Create Character' }));

    const characters = useCharacterStore.getState().characters;
    expect(characters).toHaveLength(1);
    expect(characters[0]).toMatchObject({
      name: 'Aria',
      raceIds: ['elf'],
      investedStatPoints: { STR: 5 },
      configurationId: 'config1',
    });
    // Empty inventory — slots come from the configuration, not from the character (Req 11.6)
    expect(characters[0].inventory).toEqual({ equippedItems: {}, miscItems: [] });

    // …and the result is a v2 character: points keyed by stat *id*, resources seeded to their
    // calculated maximum, and nothing left of the v1 main-skill map (TICKET-STAT-01, STAT-03)
    expect(Object.keys(characters[0].investedStatPoints)).toEqual(['STR']);
    // STR is exactly the 5 points spent since TICKET-ARC-03 deleted the focus bonus, and health
    // is `STR * 10`
    expect(characters[0].currentResourceValues).toEqual({ health: 50 });
    expect(characters[0]).not.toHaveProperty('mainSkillLevels');

    expect(navigate).toHaveBeenCalledWith({
      to: '/play/character/$id',
      params: { id: characters[0].id },
    });
  });

  it('should render an explanatory state and no form without a configuration', () => {
    useConfigStore.setState({ config: null, isLoaded: true });

    render(<CharacterCreationWizard />);

    expect(screen.getByText('No Ruleset Yet')).toBeDefined();
    expect(screen.queryByLabelText(/Character Name/i)).toBeNull();
    expect(screen.queryByRole('button', { name: 'Next' })).toBeNull();
  });
});
