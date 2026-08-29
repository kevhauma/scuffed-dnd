/**
 * Character Creation Wizard Tests
 *
 * **Validates: Requirements 11.1-11.6, 21.1-21.5**
 */

import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Configuration } from '#shared/types/config';

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

import { calculateCharacter } from '#shared/engine/calculator';
import { useCharacterStore } from '../../../stores/characterStore';
import { useConfigStore } from '../../../stores/configStore';
import { CharacterCreationWizard } from './CharacterCreationWizard';

function createConfig(overrides: Partial<Configuration> = {}): Configuration {
  return {
    id: 'config1',
    name: 'Test Config',
    version: '1.0',
    schemaVersion: 9,
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
    diceLadders: [
      {
        id: 'ladder',
        name: 'Standard',
        description: '',
        dieSizes: [20, 12, 6],
        showZeroTerms: true,
        remainder: 'flat',
      },
    ],
    // A combat skill's bonus formula is a roll's input since TICKET-ROLL-06 — the number goes
    // *into* the ladder rather than being added after the dice
    rollDefinitions: [
      {
        id: 'MEL',
        name: 'Melee',
        description: '',
        input: 'STR + skills.stealth',
        ladderId: 'ladder',
        category: 'offence',
        order: 0,
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

/** The step's race pickers, one per slot the ruleset asks for (TICKET-RACE-04) */
const raceSlots = () => screen.queryAllByLabelText(/^Race \d+$/) as HTMLSelectElement[];

/**
 * Put one race in each slot, in the order given
 *
 * A picker per slot rather than a checkbox list since TICKET-RACE-04, which is what makes
 * `pickRaces('elf', 'elf')` — a pure-blood — expressible at all.
 */
function pickRaces(...raceIds: string[]) {
  const slots = raceSlots();

  raceIds.forEach((raceId, index) => {
    const slot = slots[index];
    if (!slot) throw new Error(`the step renders no slot ${index + 1}`);
    fireEvent.change(slot, { target: { value: raceId } });
  });
}

/**
 * Fill the identity step: a name, and Human in every slot the ruleset asks for
 *
 * **Human on purpose** — its stat block is empty in this fixture, so filling the slots satisfies
 * the count rule without moving a single number the tests below assert. A ruleset with no races
 * renders no slots and needs no picks, which is the `races: undefined` case further down.
 */
function fillIdentity(name = 'Aria') {
  const field = nameField();
  fireEvent.change(field, { target: { value: name } });

  for (const slot of raceSlots()) {
    fireEvent.change(slot, { target: { value: 'human' } });
  }
}

/**
 * Fill the identity step and advance to the allocation step
 *
 * Two `next()`s since TICKET-ARC-03 put the archetype step between them. This fixture defines no
 * archetypes, so that step is always passable — which is itself the RACE-02-shaped rule that a
 * ruleset may define none.
 */
function toStatsStep(name = 'Aria') {
  fillIdentity(name);
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
    // …and the empty race slots take over as the reason, until each is filled (TICKET-RACE-04)
    expect(screen.getByText(/2 races — 0 chosen/)).toBeDefined();
    expect(screen.getByRole('button', { name: 'Next' })).toHaveProperty('disabled', true);

    pickRaces('elf', 'human');

    expect(screen.getByRole('button', { name: 'Next' })).toHaveProperty('disabled', false);
  });

  it('should preserve entered values when moving back and forward', () => {
    render(<CharacterCreationWizard />);

    toStatsStep('Aria');
    fireEvent.change(screen.getByLabelText(/Strength \(STR\)/), { target: { value: '4' } });

    back(); // Archetype
    back(); // Identity
    expect((nameField() as HTMLInputElement).value).toBe('Aria');
    expect(raceSlots().map((slot) => slot.value)).toEqual(['human', 'human']);

    next();
    next();
    expect((screen.getByLabelText(/Strength \(STR\)/) as HTMLInputElement).value).toBe('4');
  });

  it('should render one picker per slot and block until each is filled (TICKET-RACE-04)', () => {
    render(<CharacterCreationWizard />);

    fireEvent.change(nameField(), { target: { value: 'Aria' } });

    // Two slots, because the fixture states no `race_count` and the reader's default is the
    // sheet's two — and every one of them has to hold a race
    expect(raceSlots()).toHaveLength(2);
    expect(screen.getByRole('button', { name: 'Next' })).toHaveProperty('disabled', true);

    pickRaces('elf');
    expect(screen.getByText(/2 races — 1 chosen/)).toBeDefined();
    expect(screen.getByRole('button', { name: 'Next' })).toHaveProperty('disabled', true);

    pickRaces('elf', 'human');
    expect(screen.getByRole('button', { name: 'Next' })).toHaveProperty('disabled', false);
  });

  it.each([1, 3, 4])(
    'should render %i pickers when the ruleset asks for that many (TICKET-RACE-04)',
    (count) => {
      const base = createConfig();
      const config = createConfig({
        constants: [
          ...(base.constants ?? []),
          {
            id: 'const-race-count',
            name: 'race_count',
            displayName: 'Races per character',
            description: '',
            value: count,
          },
        ],
      });
      useConfigStore.setState({ config, isLoaded: true });

      render(<CharacterCreationWizard />);

      fireEvent.change(nameField(), { target: { value: 'Aria' } });
      expect(raceSlots()).toHaveLength(count);
      expect(screen.getByRole('button', { name: 'Next' })).toHaveProperty('disabled', true);

      // The copy counts in words at one rather than reading "has 1 races"
      const caption = count === 1 ? /has one race\./ : new RegExp(`has ${count} races,`);
      expect(screen.getByText(caption)).toBeDefined();

      // The same race in all of them — legal at any count, and the whole point of a slot picker
      const picks = Array.from({ length: count }, () => 'elf');
      pickRaces(...picks);

      expect(screen.getByRole('button', { name: 'Next' })).toHaveProperty('disabled', false);
    }
  );

  it('should say only that a ruleset defines no races, with no count beside it', () => {
    // Decision 3's flagship case — a fresh ruleset starts with `races: []` and must stay playable.
    // The count sentence is inside the same branch as the pickers, so it does not appear here
    // claiming a character "has 0 races" directly above "This ruleset defines no races."
    useConfigStore.setState({ config: createConfig({ races: [] }), isLoaded: true });

    render(<CharacterCreationWizard />);

    fireEvent.change(nameField(), { target: { value: 'Aria' } });

    expect(screen.getByText('This ruleset defines no races.')).toBeDefined();
    expect(screen.queryByText(/A character in this ruleset has/)).toBeNull();
    expect(raceSlots()).toHaveLength(0);
    // …and nothing blocks the step, which is the point of the exception
    expect(screen.getByRole('button', { name: 'Next' })).toHaveProperty('disabled', false);
  });

  it('should show the blended base of two races on the allocation step (TICKET-RACE-02)', () => {
    render(<CharacterCreationWizard />);

    fireEvent.change(nameField(), { target: { value: 'Aria' } });
    pickRaces('elf', 'human'); // DEX 2, and a block that says nothing about DEX
    next();
    next();

    // roundup((2 + 0) / 2) = 1, not the 2 the old additive stacking gave
    expect(screen.getByText(/\+1 racial/)).toBeDefined();
  });

  it('should preview the intact block when the same race fills every slot (TICKET-RACE-04)', () => {
    render(<CharacterCreationWizard />);

    fireEvent.change(nameField(), { target: { value: 'Aria' } });
    // A pure-blood: roundup((2 + 2) / 2) = 2, the elf's own block rather than half of it. This is
    // what replaced `Empty`, and it is the whole reason a slot takes a duplicate.
    pickRaces('elf', 'elf');
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

  it('should name the skill on a negative skill allocation (TICKET-RES-05)', () => {
    // The same verdict the server reads: `characterCreation.ts`'s `allocationRefusal` says
    // "Stealth cannot take those points", and the wizard used to fall through to a generic
    // "Adjust the allocation before continuing" for the identical character
    render(<CharacterCreationWizard />);

    toStatsStep();
    fireEvent.change(screen.getByLabelText('Stealth'), { target: { value: '-3' } });

    expect(screen.getByText(/Stealth cannot go below 0/)).toBeDefined();
    expect(screen.getByRole('button', { name: 'Next' })).toHaveProperty('disabled', true);
    // …and the box the Player is being stopped for is the box that looks wrong. `min="0"` is
    // advisory in a number field, so `Input`'s own `error` flag is what marks it — the stat input
    // beside it has carried one all along and this one did not.
    const box = screen.getByLabelText('Stealth');
    expect(box.className).toContain('border-crimson');
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

    expect(screen.getByText('4/12')).toBeDefined();
    expect(screen.getByText('Points spent')).toBeDefined();
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
      // allocate against it. A ruleset with no `skills` array at all makes the engine throw.
      //
      // **It used to be `races: undefined` here, and TICKET-RACE-04 took that away deliberately.**
      // `engine/races.ts` reads a missing race list as *no races*, because `racesRequired` is now
      // asked during **render** — the step draws one picker per slot — and a hook that threw would
      // cost the Player the whole wizard rather than the preview. `skills` is the same class of
      // malformation with the calculation still the only thing that fails.
      useConfigStore.setState({
        config: createConfig({ skills: undefined as unknown as Configuration['skills'] }),
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
      // The fixture defines none, which is legal — the same rule a ruleset with no races gets
      render(<CharacterCreationWizard />);

      fillIdentity();
      next();

      expect(screen.getByText(/defines no archetypes/)).toBeDefined();
      expect(screen.getByRole('button', { name: 'Next' })).toHaveProperty('disabled', false);
    });

    it('should require a pick when the ruleset offers a choice', () => {
      useConfigStore.setState({ config: withArchetypes(), isLoaded: true });
      render(<CharacterCreationWizard />);

      fillIdentity();
      next();

      expect(screen.getByText('Pick an archetype before continuing.')).toBeDefined();
      expect(screen.getByRole('button', { name: 'Next' })).toHaveProperty('disabled', true);
    });

    it('should unblock once one is picked, and show which stats it favours', () => {
      useConfigStore.setState({ config: withArchetypes(), isLoaded: true });
      render(<CharacterCreationWizard />);

      fillIdentity();
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

      fillIdentity();
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
    pickRaces('elf', 'human');
    next();
    next();
    fireEvent.change(screen.getByLabelText(/Strength \(STR\)/), { target: { value: '5' } });
    // Labelled by name alone — a `Skill` has no code to bracket (TICKET-SKL-02)
    fireEvent.change(screen.getByLabelText('Stealth'), { target: { value: '1' } });
    next();
    // Focus — this fixture states neither focus dial, so the step asks for nothing (TICKET-SKL-05)
    next();

    const expected = calculateCharacter(
      {
        id: 'x',
        name: 'Aria',
        configurationId: 'config1',
        raceIds: ['elf', 'human'],
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
    // A roll shows its **input** — the number fed to the ladder (TICKET-ROLL-06)
    expect(rowValue('Melee')).toBe(`Melee${expected.rollInputs.MEL}`);
    expect(rowValue('Dexterity (DEX)')).toBe(`Dexterity (DEX)${expected.statValues.DEX}`);
  });

  it('should preview numbers on review before anything is allocated (TICKET-CALC-02)', () => {
    // The wizard starts with an empty allocation map, so every configured main skill is
    // unallocated here — the reported repro at its purest. It must summarise as zeroes rather
    // than withhold the preview over `Undefined variable`.
    render(<CharacterCreationWizard />);

    // Human in both slots: the count rule is satisfied and no race supplies a stat, so every
    // number below is still the unallocated zero this test is about
    fillIdentity();
    next(); // Archetype — the fixture defines none, so nothing to pick
    next(); // Stats — nothing entered
    next(); // Focus — the fixture states no focus dials, so nothing to pick (TICKET-SKL-05)
    next(); // Review

    expect(screen.queryByText(/formula that does not evaluate/)).toBeNull();

    const rowValue = (label: string) => screen.getByText(label).parentElement?.textContent ?? '';

    expect(rowValue('Strength (STR)')).toBe('Strength (STR)0');
    expect(rowValue('Health (HEA)')).toBe('Health (HEA)0'); // STR 0 * 10
    expect(rowValue('Melee')).toBe('Melee0'); // STR 0 + STL 0
  });

  it('should create the character once and navigate to its sheet', async () => {
    render(<CharacterCreationWizard />);

    fireEvent.change(nameField(), { target: { value: 'Aria' } });
    // A pure-blood elf — both of the ruleset's slots, the same race in each (TICKET-RACE-04)
    pickRaces('elf', 'elf');
    next(); // Archetype — none defined in this fixture
    next();
    fireEvent.change(screen.getByLabelText(/Strength \(STR\)/), { target: { value: '5' } });
    next();
    next(); // Focus — nothing to pick on a ruleset that states no dials (TICKET-SKL-05)

    fireEvent.click(screen.getByRole('button', { name: 'Create Character' }));

    const characters = useCharacterStore.getState().characters;
    expect(characters).toHaveLength(1);
    expect(characters[0]).toMatchObject({
      name: 'Aria',
      raceIds: ['elf', 'elf'],
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

    // **Awaited since TICKET-CHAR-04.** The write is still synchronous — the assertions above run
    // straight after the click and pass — but the *navigation* is now a microtask later, because
    // one submit serves two destinations and the other one is a request. That is the whole of what
    // changed for local mode.
    await waitFor(() =>
      expect(navigate).toHaveBeenCalledWith({
        to: '/play/character/$id',
        params: { id: characters[0].id },
      })
    );
  });

  /**
   * The focus step (TICKET-SKL-05)
   *
   * The source workbook's Setup form names three focus skills, so the wizard asks for three — but
   * only where the ruleset states a dial for them to be worth anything, which is the archetype
   * step's rule and its reasoning.
   */
  describe('the focus step', () => {
    /** The fixture's ruleset with the sheet's own dials set — the values are the data pass's */
    function withFocusDials(): Configuration {
      const config = createConfig();

      return {
        ...config,
        skills: [
          ...config.skills,
          { id: 'ALC', name: 'Alchemy', description: '', statWeights: [] },
        ],
        constants: [
          ...(config.constants ?? []),
          {
            id: 'fc',
            name: 'focus_chosen',
            displayName: 'Focus chosen',
            description: '',
            value: 1.5,
          },
          {
            id: 'fo',
            name: 'focus_other',
            displayName: 'Focus other',
            description: '',
            value: 0.3,
          },
        ],
      };
    }

    /** The step's pickers, one per focus slot */
    const focusSlots = () => screen.queryAllByLabelText(/^Focus \d+$/) as HTMLSelectElement[];

    function toFocusStep() {
      fillIdentity();
      next();
      next();
      next();
    }

    it('should draw three pickers and refuse to leave until all three are filled', () => {
      useConfigStore.setState({ config: withFocusDials(), isLoaded: true });
      render(<CharacterCreationWizard />);
      toFocusStep();

      expect(focusSlots()).toHaveLength(3);
      expect(screen.getByText(/3 focus skills — 0 chosen/)).toBeDefined();
      expect(screen.getByRole('button', { name: 'Next' })).toHaveProperty('disabled', true);

      // The same skill in two slots is legal and is how a character specialises twice over
      const [one, two, three] = focusSlots();
      fireEvent.change(one as HTMLSelectElement, { target: { value: 'STL' } });
      fireEvent.change(two as HTMLSelectElement, { target: { value: 'ALC' } });
      expect(screen.getByRole('button', { name: 'Next' })).toHaveProperty('disabled', true);

      fireEvent.change(three as HTMLSelectElement, { target: { value: 'STL' } });
      expect(screen.getByRole('button', { name: 'Next' })).toHaveProperty('disabled', false);
    });

    it('should carry the picks, duplicates kept, onto the created character', async () => {
      useConfigStore.setState({ config: withFocusDials(), isLoaded: true });
      render(<CharacterCreationWizard />);
      toFocusStep();

      const [one, two, three] = focusSlots();
      fireEvent.change(one as HTMLSelectElement, { target: { value: 'STL' } });
      fireEvent.change(two as HTMLSelectElement, { target: { value: 'ALC' } });
      fireEvent.change(three as HTMLSelectElement, { target: { value: 'STL' } });
      next();

      fireEvent.click(screen.getByRole('button', { name: 'Create Character' }));

      await waitFor(() => expect(useCharacterStore.getState().characters).toHaveLength(1));
      expect(useCharacterStore.getState().characters[0].focusSkillIds).toEqual([
        'STL',
        'ALC',
        'STL',
      ]);
    });

    it('should ask for nothing on a ruleset that states neither dial', () => {
      // Every multiplier is exactly 1 there, so three picks would change no number — and a step
      // that stopped a Player over a choice they cannot feel is a rule they cannot act on
      render(<CharacterCreationWizard />);
      toFocusStep();

      expect(screen.getByRole('button', { name: 'Next' })).toHaveProperty('disabled', false);
      expect(screen.getByText(/change no number yet/)).toBeDefined();
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
