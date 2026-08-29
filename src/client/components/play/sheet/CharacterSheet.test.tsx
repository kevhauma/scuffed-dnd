/**
 * Character Sheet Tests
 *
 * Navigation is mocked at the router boundary; the stores are real, with storage mocked, so an
 * edit really goes through the store action and back out as rendered state.
 *
 * **Validates: Requirements 8.5, 13.4, 14.1, 14.2, 14.3, 14.4, 14.5, 21.1-21.5**
 */

import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Character } from '#shared/types/character';
import type { Configuration } from '#shared/types/config';
import { STAT_AFFINITY } from '#shared/types/config';

const navigate = vi.fn();
vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => navigate,
}));

// Signed out throughout, which is the point rather than convenience: every case here is local mode,
// and `useOpenTableCharacter` must make no request in it (TICKET-PLY-01, D6). Unmocked, Better
// Auth's `useSession` would also fire a real request at localhost from a unit test.
vi.mock('../../auth/useAuth', () => ({
  useAuth: () => ({ accountId: null, email: null, isPending: false, isSignedIn: false }),
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
import { CharacterSheet } from './CharacterSheet';

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
        id: 'dex-id',
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
      {
        id: 'mana',
        name: 'Mana',
        abbreviation: 'MAN',
        description: '',
        order: 0,
        countsTowardTotal: true,
        isResource: true,
        rounding: 'none',
        formula: 'DEX * 5',
      },
    ],
    skills: [
      {
        id: 'STL',
        name: 'Stealth',
        description: '',
        // Half of DEX, which keeps the bonus distinct from the 3 invested points below so a row
        // assertion cannot match the wrong number (TICKET-SKL-02)
        statWeights: [{ statId: 'dex-id', weight: 0.5 }],
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
        id: 'mel-id',
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
    equipmentSlots: [],
    races: [
      {
        id: 'elf',
        name: 'Elf',
        description: '',
        statValues: { 'dex-id': 2 },
      },
      {
        id: 'human',
        name: 'Human',
        description: '',
        statValues: { 'dex-id': 1 },
      },
    ],
    currencyTiers: [],
    // The point budget is `level × points_per_level` since TICKET-RES-02, so at level 3 this
    // character has 15 points and has spent 10 of them
    constants: [
      {
        id: 'const-ppl',
        name: 'points_per_level',
        displayName: 'Points per level',
        description: '',
        value: 5,
      },
    ],
    // Level is read backwards out of this since TICKET-RES-01
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
          { key: 3, values: [900] },
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

function createCharacter(overrides: Partial<Character> = {}): Character {
  return {
    id: 'char1',
    name: 'Aria',
    configurationId: 'config1',
    raceIds: ['elf'],
    investedStatPoints: { STR: 6, 'dex-id': 4 },
    investedSkillPoints: { STL: 3 },
    currentResourceValues: { health: 60, mana: 30 },
    experience: 900,
    inventory: { equippedItems: {}, miscItems: [] },
    createdAt: '2024-01-01',
    updatedAt: '2024-01-01',
    ...overrides,
  };
}

/**
 * The row a skill or stat is rendered in, found by its visible label
 *
 * Every row type — skill breakdown, stat editor, combat skill — is the one element carrying the
 * separator border, so that is what identifies the row rather than a test-only attribute.
 */
function rowFor(label: string | RegExp): HTMLElement {
  const cell = screen.getByText(label);
  const row = cell.closest('div.border-b');
  if (!row) throw new Error(`No row found for ${label}`);
  return row as HTMLElement;
}

/**
 * For a text query that must find a row's **value**, not any number in it
 *
 * Every stat, resource and skill row now carries a badge in front of its name — invested points,
 * or a skill's level — whose digits are drawn in an `aria-hidden` span, the meaning being carried
 * by an `sr-only` phrase beside it. A bare `getByText('6')` inside a row therefore matches the
 * badge as well as the value. Ignoring hidden nodes picks the one the Player reads as the row's
 * answer, without loosening the assertion to "some element says 6".
 */
const VISIBLE_ONLY = { ignore: 'script, style, [aria-hidden="true"]' } as const;

describe('CharacterSheet', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useConfigStore.setState({ config: createConfig(), isLoaded: true });
    useCharacterStore.setState({ characters: [createCharacter()], isLoaded: true });
  });

  it('should render the header, every section, and the character identity', () => {
    render(<CharacterSheet characterId="char1" />);

    expect(screen.getByRole('heading', { level: 1, name: 'Aria' })).toBeDefined();
    // 900 XP is the third threshold; the level no longer follows the points spent (TICKET-RES-01)
    expect(screen.getByText(/Level 3/)).toBeDefined();
    expect(screen.getByText(/900 XP · Elf/)).toBeDefined();

    for (const section of ['Race Stat Block', 'Stats', 'Skills', 'Rolls']) {
      expect(screen.getByRole('heading', { name: section })).toBeDefined();
    }
  });

  it('should blend race stat blocks across two races (TICKET-RACE-02)', () => {
    // Elf's block gives DEX 2, Human's gives DEX 1 — the base is roundup(3 / 2) = 2, and the
    // section says which lineages it came from (Requirement 8.5, 8.3, 8.4)
    useCharacterStore.setState({
      characters: [createCharacter({ raceIds: ['elf', 'human'] })],
    });

    render(<CharacterSheet characterId="char1" />);

    expect(screen.getByText('DEX 2')).toBeDefined();
    expect(screen.getByText(/Elf × Human — blended/)).toBeDefined();
    expect(within(rowFor(/Dexterity \(DEX\)/)).getByText('race +2')).toBeDefined();
  });

  it("should label a stat's equipment contribution from the engine (TICKET-MAT-02)", () => {
    // The cloak's tier grants DEX +4, and the sheet shows it as its own term rather than folded
    // into the total — the engine's breakdown, not something the component re-derived
    useConfigStore.setState({
      config: createConfig({
        materialCategories: [{ id: 'cloth', name: 'Cloth', description: '' }],
        currencyTiers: [{ id: 'gold', name: 'Gold', order: 0, conversionToNext: 10 }],
        materials: [
          {
            id: 'fur',
            name: 'Fur',
            description: '',
            categoryId: 'cloth',
            levels: [
              {
                level: 1,
                name: 'Fur 1',
                bonuses: [{ statId: 'dex-id', modifier: 4 }],
                value: { tierId: 'gold', amount: 1 },
              },
            ],
          },
        ],
        items: [
          {
            id: 'cloak',
            name: 'Fur Cloak',
            description: '',
            materialId: 'fur',
            materialLevel: 1,
            equipmentSlotType: 'cloak',
          },
        ],
        equipmentSlots: [{ type: 'cloak', name: 'Cloak', description: '' }],
      }),
      isLoaded: true,
    });
    useCharacterStore.setState({
      characters: [
        createCharacter({ inventory: { equippedItems: { cloak: 'cloak' }, miscItems: [] } }),
      ],
      isLoaded: true,
    });

    render(<CharacterSheet characterId="char1" />);

    const dexterity = rowFor(/Dexterity \(DEX\)/);
    expect(within(dexterity).getByText('equipment +4')).toBeDefined();
    expect(within(dexterity).getByText('10')).toBeDefined(); // 4 invested + 2 race + 4 equipment

    // And the skill follows through the stat it is weighted on, which is the only route a tier
    // modifier has to a skill since TICKET-MAT-02. Stealth is DEX × 0.5, so the +4 carries into
    // its level as +2: level 3 + 5 = 8, which the row now leads with.
    expect(within(rowFor(/Stealth/)).getByText('8', VISIBLE_ONLY)).toBeDefined();
    // …and the bonus it rounds to is in the breakdown behind it
    expect(within(rowFor(/Stealth/)).getByText('bonus 2')).toBeDefined();
  });

  it("should show a stat's contributions separately from its total", () => {
    render(<CharacterSheet characterId="char1" />);

    const dexterity = rowFor(/Dexterity \(DEX\)/);
    // Allocated and race are shown apart (Requirement 13.4), not folded into the total. The
    // invested term carries its price since TICKET-ARC-02 — `invested 4 → +4` here, because this
    // fixture has no point_buy curve and takes the 1:1 fallback.
    expect(within(dexterity).getByText('invested 4 → +4')).toBeDefined();
    expect(within(dexterity).getByText('race +2')).toBeDefined();
    expect(within(dexterity).getByText('6')).toBeDefined();
  });

  /**
   * Requirement 13.4's contract is that the labelled terms are terms of the *total*. Since
   * TICKET-ARC-02 the term is the **gain**, not the points — found by the `conventions-reviewer`,
   * which noticed the suite could not see it because no fixture carried a `point_buy` curve.
   */
  describe('the invested term against a point-buy curve (TICKET-ARC-02)', () => {
    /** 10 points buy 8.25 main / 5 sub / 4 non — three keys of the seeded shape */
    const withPointBuy = () =>
      createConfig({
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
              { key: 4, values: [2, 2, 3.75] },
              { key: 6, values: [2, 3, 5.25] },
            ],
            interpolation: 'step',
            outOfRange: 'error',
            lookupDirection: 'forward',
          },
        ],
        archetypes: [
          { id: 'strong', name: 'Strong', description: '', statAffinity: { STR: 'main' } },
        ],
      });

    it('should show the gain as the contribution, with the points as its price', () => {
      useConfigStore.setState({ config: withPointBuy(), isLoaded: true });
      useCharacterStore.setState({ characters: [createCharacter({ archetypeId: 'strong' })] });

      render(<CharacterSheet characterId="char1" />);

      // STR is main-type with 6 points invested, which buys 5.25 — not 6
      expect(within(rowFor(/Strength \(STR\)/)).getByText('invested 6 → +5.25')).toBeDefined();
    });

    it('should have the breakdown add up to the total it is a breakdown of', () => {
      useConfigStore.setState({ config: withPointBuy(), isLoaded: true });
      useCharacterStore.setState({ characters: [createCharacter({ archetypeId: 'strong' })] });

      render(<CharacterSheet characterId="char1" />);

      // No race block on STR and nothing equipped, so the gain *is* the total
      expect(within(rowFor(/Strength \(STR\)/)).getByText('5.25')).toBeDefined();
    });

    it('should price a non-type stat through its own column', () => {
      useConfigStore.setState({ config: withPointBuy(), isLoaded: true });
      useCharacterStore.setState({ characters: [createCharacter({ archetypeId: 'strong' })] });

      render(<CharacterSheet characterId="char1" />);

      // DEX is untagged, so `non`: 4 points buy 2, plus the elf's race block of 2
      expect(within(rowFor(/Dexterity \(DEX\)/)).getByText('invested 4 → +2')).toBeDefined();
    });

    /**
     * The label had one branch and now needs two (TICKET-ARC-04)
     *
     * A gain is no longer a function of the spend: a sub-tagged stat gains the character's dream
     * level flat, points or none. The bare `invested` label meant *spent nothing, gained nothing*
     * and would now sit beside a number — telling a Player they invested in a stat they have never
     * touched, which is the same class of mistake ARC-02 fixed here.
     */
    describe('a stat the dream reaches with nothing spent in it (TICKET-ARC-04)', () => {
      /** The same table, with DEX sub-tagged so the flat dream term lands on an untouched stat */
      const withSubTag = () =>
        createConfig({
          curves: withPointBuy().curves,
          archetypes: [
            {
              id: 'strong',
              name: 'Strong',
              description: '',
              statAffinity: { STR: STAT_AFFINITY.MAIN, 'dex-id': STAT_AFFINITY.SUB },
            },
          ],
        });

      /** Nothing in DEX, so its whole gain is the dream level's flat term */
      const untouchedDex = () =>
        createCharacter({ archetypeId: 'strong', investedStatPoints: { STR: 6 } });

      it('should say the spend was zero rather than calling the dream term an investment', () => {
        useConfigStore.setState({ config: withSubTag(), isLoaded: true });
        useCharacterStore.setState({ characters: [untouchedDex()] });

        render(<CharacterSheet characterId="char1" />);

        const dexterity = rowFor(/Dexterity \(DEX\)/);
        // `sub(0) + dreamLevel` is 1 at the neutral level, and the arrow follows the gain
        expect(within(dexterity).getByText('invested 0 → +1')).toBeDefined();
        expect(within(dexterity).queryByText('invested +1')).toBeNull();
      });

      it('should still have the breakdown add up to the total', () => {
        useConfigStore.setState({ config: withSubTag(), isLoaded: true });
        useCharacterStore.setState({ characters: [untouchedDex()] });

        render(<CharacterSheet characterId="char1" />);

        // 1 from the dream, 2 from the elf's block — the row leads with what they make
        const dexterity = rowFor(/Dexterity \(DEX\)/);
        expect(within(dexterity).getByText('race +2')).toBeDefined();
        expect(within(dexterity).getByText('3')).toBeDefined();
      });

      it('should keep the bare label for a stat with nothing spent and nothing gained', () => {
        // The case the zero branch was always about: `non` is untouched by the dream, so "no
        // points here" still has to read apart from "no such contribution"
        useConfigStore.setState({ config: withPointBuy(), isLoaded: true });
        useCharacterStore.setState({ characters: [untouchedDex()] });

        render(<CharacterSheet characterId="char1" />);

        // `signed(0)` is a bare `0`, so this reads *invested 0* — no arrow, because there is no
        // exchange rate to show
        expect(within(rowFor(/Dexterity \(DEX\)/)).getByText('invested 0')).toBeDefined();
      });
    });
  });

  it('should show no focus term on any stat, the mechanic being gone (TICKET-ARC-03)', () => {
    render(<CharacterSheet characterId="char1" />);

    expect(within(rowFor(/Strength \(STR\)/)).queryByText(/focus/)).toBeNull();
    expect(within(rowFor(/Stealth/)).queryByText(/focus/)).toBeNull();
    expect(screen.queryByText('focus stat')).toBeNull();
  });

  it('should name the character’s archetype in the header instead (TICKET-ARC-03)', () => {
    useConfigStore.setState({
      config: createConfig({
        archetypes: [{ id: 'strong', name: 'Strong', description: '', statAffinity: {} }],
      }),
      isLoaded: true,
    });
    useCharacterStore.setState({ characters: [createCharacter({ archetypeId: 'strong' })] });

    render(<CharacterSheet characterId="char1" />);

    expect(screen.getByText(/900 XP · Elf · Strong/)).toBeDefined();
  });

  /**
   * Experience and the level it derives (Concept 20, TICKET-RES-01)
   *
   * Driven through the header's own controls rather than through the store, because the point of
   * the ticket is that awarding XP at the table moves the level on the sheet.
   */
  describe('experience (TICKET-RES-01)', () => {
    const amountBox = () => screen.getByLabelText('Experience') as HTMLInputElement;
    const award = () => screen.getByRole('button', { name: 'Award XP' });
    const deduct = () => screen.getByRole('button', { name: 'Deduct XP' });

    it('should move the level when an award crosses a threshold', () => {
      render(<CharacterSheet characterId="char1" />);
      // 900 XP is level 3; the next row does not exist, so extrapolation carries it to 4
      expect(screen.getByText(/Level 3/)).toBeDefined();

      fireEvent.change(amountBox(), { target: { value: '600' } });
      fireEvent.click(award());

      expect(screen.getByText(/1500 XP/)).toBeDefined();
      expect(screen.queryByText(/Level 3 /)).toBeNull();
    });

    it('should deduct experience through the store', () => {
      render(<CharacterSheet characterId="char1" />);

      fireEvent.change(amountBox(), { target: { value: '600' } });
      fireEvent.click(deduct());

      expect(screen.getByText(/300 XP/)).toBeDefined();
      expect(screen.getByText(/Level 2/)).toBeDefined();
    });

    it('should clear the amount after an action, so one click is one award', () => {
      render(<CharacterSheet characterId="char1" />);

      fireEvent.change(amountBox(), { target: { value: '100' } });
      fireEvent.click(award());

      expect(amountBox().value).toBe('');
      expect(screen.getByText(/1000 XP/)).toBeDefined();
    });

    it('should offer no action until a positive amount is entered', () => {
      render(<CharacterSheet characterId="char1" />);

      expect((award() as HTMLButtonElement).disabled).toBe(true);
      expect((deduct() as HTMLButtonElement).disabled).toBe(true);

      fireEvent.change(amountBox(), { target: { value: '0' } });
      expect((award() as HTMLButtonElement).disabled).toBe(true);

      fireEvent.change(amountBox(), { target: { value: '50' } });
      expect((award() as HTMLButtonElement).disabled).toBe(false);
    });

    it('should chip the level when the ruleset has no xp_thresholds curve', () => {
      useConfigStore.setState({ config: createConfig({ curves: [] }), isLoaded: true });

      render(<CharacterSheet characterId="char1" />);

      // Two chips, not one: the header's level and the stats section's point budget, which is
      // priced off that same level since TICKET-RES-02
      expect(screen.getAllByRole('img', { name: /xp_thresholds/ })).toHaveLength(2);
      // The XP itself is still readable — it is stored, not derived
      expect(screen.getByText(/900 XP/)).toBeDefined();
    });
  });

  /**
   * Concept 02's grid: both numbers on the row, and the terms that produced them. Asserted against
   * `calculateCharacter` rather than against literals wherever the number is the engine's, so a
   * change to the derivation moves the expectation with it instead of pinning a stale figure.
   */
  describe('the skills grid (TICKET-SKL-03)', () => {
    it('should show a weight row as the stat times its weight, already multiplied', () => {
      const expected = calculateCharacter(createCharacter(), createConfig());

      render(<CharacterSheet characterId="char1" />);

      // DEX is 4 invested + 2 from Elf = 6, weighted 0.5, so the term is +3
      const term = expected.skillContributions.STL[0];
      expect(term).toMatchObject({ statId: 'dex-id', weight: 0.5, statValue: 6, contribution: 3 });
      expect(within(rowFor(/Stealth/)).getByText('DEX × 0.5 +3')).toBeDefined();
    });

    it('should show the invested points as their own term, and at zero', () => {
      render(<CharacterSheet characterId="char1" />);
      expect(within(rowFor(/Stealth/)).getByText('invested +3')).toBeDefined();

      cleanup();
      useCharacterStore.setState({
        characters: [createCharacter({ investedSkillPoints: {} })],
      });
      render(<CharacterSheet characterId="char1" />);

      // Always shown: "spent nothing here" is part of the character, unlike an absent contribution
      expect(within(rowFor(/Stealth/)).getByText('invested 0')).toBeDefined();
    });

    it('should show level and bonus as different numbers', () => {
      const expected = calculateCharacter(createCharacter(), createConfig());

      render(<CharacterSheet characterId="char1" />);

      // level 6 = 3 weighted + 3 invested; bonus = round(6 / 5) = 1
      expect(expected.skillLevels.STL).toBe(6);
      expect(expected.skillBonuses.STL).toBe(1);
      const row = rowFor(/Stealth/);
      // The **level** is the row's lead number — `variant="highlight"` — rather than any text node
      // that happens to read "6"
      expect(
        within(row).getByText(String(expected.skillLevels.STL), VISIBLE_ONLY).className
      ).toContain('font-mono');
      // The bonus it rounds to is behind it, in the breakdown
      expect(within(row).getByText(`bonus ${expected.skillBonuses.STL}`)).toBeDefined();
    });

    it('should not show a weighted term as binary floating-point noise', () => {
      // DEX 7 at weight 0.2 is 1.4000000000000001 as a double. The terms must keep summing to the
      // level exactly, so the rounding belongs at the display edge and nowhere earlier.
      useConfigStore.setState({
        config: createConfig({
          skills: [
            {
              id: 'STL',
              name: 'Stealth',
              description: '',
              statWeights: [{ statId: 'dex-id', weight: 0.2 }],
            },
          ],
        }),
      });
      useCharacterStore.setState({
        characters: [
          createCharacter({ investedStatPoints: { STR: 6, 'dex-id': 5 }, investedSkillPoints: {} }),
        ],
      });

      render(<CharacterSheet characterId="char1" />);

      const row = rowFor(/Stealth/);
      expect(within(row).getByText('DEX × 0.2 +1.4')).toBeDefined();
      // The *term* keeps its fraction — it is a weight times a stat, and hiding that is hiding the
      // ruleset. The *level* is rounded up, because a level is a whole number and nobody at a
      // table has two-fifths of one. The rounding is at the display edge only: the engine keeps
      // 1.4, which is what the bonus derives from.
      expect(within(row).getByText('2', VISIBLE_ONLY)).toBeDefined();
      expect(within(row).queryByText(/0000000/)).toBeNull();
    });

    it('should drop the breakdown and chip once when the level cannot be computed', () => {
      useConfigStore.setState({
        config: createConfig({
          skills: [
            {
              id: 'STL',
              name: 'Stealth',
              description: '',
              // Weighted on a resource whose own formula is broken
              statWeights: [{ statId: 'health', weight: 0.5 }],
            },
          ],
          stats: createConfig().stats.map((stat) =>
            stat.id === 'health' ? { ...stat, formula: 'NOPE * 10' } : stat
          ),
        }),
      });

      render(<CharacterSheet characterId="char1" />);

      const row = rowFor(/Stealth/);
      expect(within(row).queryByText(/HEA ×/)).toBeNull();
      expect(within(row).queryByText(/^level/)).toBeNull();
      // One chip for the row, not one for the level and another for the bonus
      expect(within(row).getAllByRole('img', { name: /unavailable/ })).toHaveLength(1);
    });
  });

  it('should render values that match calculateCharacter for the same character', () => {
    const config = createConfig();
    const character = createCharacter();
    const expected = calculateCharacter(character, config);

    render(<CharacterSheet characterId="char1" />);

    // Main skills, speciality totals, combat bonuses and stat maxima all come from the engine
    expect(
      within(rowFor(/Strength \(STR\)/)).getByText(String(expected.statValues.STR), VISIBLE_ONLY)
    ).toBeDefined();
    expect(
      within(rowFor(/Dexterity \(DEX\)/)).getByText(
        String(expected.statValues['dex-id']),
        VISIBLE_ONLY
      )
    ).toBeDefined();
    // The skill row leads with its **level**, with the bonus it rounds to in the breakdown behind
    expect(
      within(rowFor(/Stealth/)).getByText(String(expected.skillLevels.STL), VISIBLE_ONLY)
    ).toBeDefined();
    expect(
      within(rowFor(/Stealth/)).getByText(`bonus ${String(expected.skillBonuses.STL)}`)
    ).toBeDefined();
    expect(
      within(rowFor(/^Melee$/)).getByText(`input ${expected.rollInputs['mel-id']}`)
    ).toBeDefined();
    expect(
      within(rowFor('Health')).getByText(`of ${expected.statValues.health} max`)
    ).toBeDefined();
  });

  it('should label each roll with the pool its input decomposes into (TICKET-ROLL-06)', () => {
    render(<CharacterSheet characterId="char1" />);

    // The button carries the **pool**, not a bonus — that is the whole ticket. STR 6 + Stealth 6
    // is 12, which the [20, 12, 6] ladder walks to 0D20 + 1D12 + 0D6 + 0
    expect(
      within(rowFor(/^Melee$/)).getByRole('button', { name: 'Roll 0D20 + 1D12 + 0D6 + 0' })
    ).toBeDefined();
  });

  it('should show both current and maximum values for every stat', () => {
    render(<CharacterSheet characterId="char1" />);

    // Requirement 14.1 — STR 6 gives Health a max of 60, DEX 6 gives Mana a max of 30
    expect((within(rowFor('Health')).getByLabelText('Health') as HTMLInputElement).value).toBe(
      '60'
    );
    expect(within(rowFor('Health')).getByText('of 60 max')).toBeDefined();
    expect((within(rowFor('Mana')).getByLabelText('Mana') as HTMLInputElement).value).toBe('30');
    expect(within(rowFor('Mana')).getByText('of 30 max')).toBeDefined();
  });

  it('should persist a changed current stat value through the store', () => {
    render(<CharacterSheet characterId="char1" />);

    const mana = within(rowFor('Mana')).getByLabelText('Mana');
    fireEvent.change(mana, { target: { value: '12' } });
    // Committed on blur since TICKET-RES-03, not per keystroke
    fireEvent.blur(mana);

    // Requirement 14.2, 14.5 — the store holds it and the sheet re-reads it
    expect(useCharacterStore.getState().characters[0].currentResourceValues.mana).toBe(12);
    expect((within(rowFor('Mana')).getByLabelText('Mana') as HTMLInputElement).value).toBe('12');
  });

  it('should not persist the digits typed on the way to a value (TICKET-RES-03)', () => {
    render(<CharacterSheet characterId="char1" />);

    const mana = within(rowFor('Mana')).getByLabelText('Mana');
    fireEvent.change(mana, { target: { value: '1' } });
    fireEvent.change(mana, { target: { value: '12' } });

    // `1` was never a write; the pool still reads its stored 30 until the entry is committed
    expect(useCharacterStore.getState().characters[0].currentResourceValues.mana).toBe(30);

    fireEvent.blur(mana);
    expect(useCharacterStore.getState().characters[0].currentResourceValues.mana).toBe(12);
  });

  it('should commit an entry on Enter as well as on blur', () => {
    render(<CharacterSheet characterId="char1" />);

    const mana = within(rowFor('Mana')).getByLabelText('Mana');
    fireEvent.change(mana, { target: { value: '8' } });
    fireEvent.keyDown(mana, { key: 'Enter' });

    expect(useCharacterStore.getState().characters[0].currentResourceValues.mana).toBe(8);
  });

  it('should clamp a current stat value at its maximum', () => {
    render(<CharacterSheet characterId="char1" />);

    const health = within(rowFor('Health')).getByLabelText('Health');
    fireEvent.change(health, { target: { value: '999' } });
    fireEvent.blur(health);

    // Requirement 14.3 — the store refuses to store more than the calculated max of 60
    expect(useCharacterStore.getState().characters[0].currentResourceValues.health).toBe(60);
    expect((within(rowFor('Health')).getByLabelText('Health') as HTMLInputElement).value).toBe(
      '60'
    );
  });

  it('should allow a current stat value to go negative', () => {
    render(<CharacterSheet characterId="char1" />);

    const health = within(rowFor('Health')).getByLabelText('Health');
    // A leading sign is quick entry since TICKET-RES-03, so -70 off a stored 60 is how a pool is
    // taken below zero — the clamp stays one-sided (Requirement 14.4)
    fireEvent.change(health, { target: { value: '-70' } });
    fireEvent.blur(health);

    expect(useCharacterStore.getState().characters[0].currentResourceValues.health).toBe(-10);
  });

  it('should step a stat down with the decrease control', () => {
    render(<CharacterSheet characterId="char1" />);

    fireEvent.click(screen.getByLabelText('Decrease Health'));

    expect(useCharacterStore.getState().characters[0].currentResourceValues.health).toBe(59);
  });

  /**
   * Concept 20's pool behaviours (TICKET-RES-03): quick entry, regain to full, and the rule that a
   * derived maximum never silently overwrites what the Player is tracking.
   */
  describe('resource pool behaviours (TICKET-RES-03)', () => {
    const health = () => within(rowFor('Health')).getByLabelText('Health');
    const storedHealth = () =>
      useCharacterStore.getState().characters[0].currentResourceValues.health;

    it.each([
      ['-7', 53],
      ['+12', 60],
    ])('should apply %s as a delta against the stored value', (entry, expected) => {
      render(<CharacterSheet characterId="char1" />);

      fireEvent.change(health(), { target: { value: entry } });
      fireEvent.blur(health());

      // 60 stored, max 60 — so +12 is applied and then clamped, and -7 lands whole
      expect(storedHealth()).toBe(expected);
    });

    it('should treat an unsigned entry as an absolute value, not a delta', () => {
      render(<CharacterSheet characterId="char1" />);

      fireEvent.change(health(), { target: { value: '20' } });
      fireEvent.blur(health());

      expect(storedHealth()).toBe(20);
    });

    it('should refill a spent pool to its calculated maximum', () => {
      useCharacterStore.setState({
        characters: [createCharacter({ currentResourceValues: { health: 12, mana: 30 } })],
      });

      render(<CharacterSheet characterId="char1" />);
      fireEvent.click(screen.getByLabelText('Restore Health to full'));

      expect(storedHealth()).toBe(60);
    });

    it('should close the refill control when the pool is already full', () => {
      render(<CharacterSheet characterId="char1" />);

      expect((screen.getByLabelText('Restore Health to full') as HTMLButtonElement).disabled).toBe(
        true
      );
    });

    it('should close the refill control when there is no maximum to fill to', () => {
      useConfigStore.setState({
        config: createConfig({
          stats: createConfig().stats.map((stat) =>
            stat.id === 'health' ? { ...stat, formula: 'NOPE * 2' } : stat
          ),
        }),
        isLoaded: true,
      });

      render(<CharacterSheet characterId="char1" />);

      expect((screen.getByLabelText('Restore Health to full') as HTMLButtonElement).disabled).toBe(
        true
      );
    });

    describe('kept-and-flagged when a maximum falls', () => {
      /** STR drops from 6 to 1, so Health's `STR * 10` maximum falls from 60 to 10 */
      const shrink = () =>
        useCharacterStore.setState({
          characters: [
            createCharacter({
              investedStatPoints: { STR: 1, 'dex-id': 4 },
              currentResourceValues: { health: 60, mana: 30 },
            }),
          ],
        });

      it('should keep the tracked value rather than rewriting it', () => {
        shrink();
        render(<CharacterSheet characterId="char1" />);

        // The spec's rule: a derived max must never silently overwrite what the player is tracking
        expect(storedHealth()).toBe(60);
        expect((health() as HTMLInputElement).value).toBe('60');
      });

      it('should flag the mismatch on the sheet', () => {
        shrink();
        render(<CharacterSheet characterId="char1" />);

        expect(within(rowFor('Health')).getByText(/Above the current maximum of 10/)).toBeDefined();
      });

      it('should clamp to the new maximum on the next write', () => {
        shrink();
        render(<CharacterSheet characterId="char1" />);

        fireEvent.click(screen.getByLabelText('Decrease Health'));

        // 60 − 1 = 59, clamped to the maximum of 10 — the state resolves as soon as it is touched
        expect(storedHealth()).toBe(10);
      });

      it('should not flag a pool that is merely below its maximum', () => {
        render(<CharacterSheet characterId="char1" />);

        expect(within(rowFor('Mana')).queryByText(/Above the current maximum/)).toBeNull();
      });
    });
  });

  describe('the unified stats grid (TICKET-STAT-03)', () => {
    it('should list every stat in the order the ruleset arranges them', () => {
      useConfigStore.setState({
        config: createConfig({
          stats: createConfig().stats.map((stat, index) => ({
            ...stat,
            // Reverse the panel ordering: mana, health, DEX, STR
            order: 10 - index,
          })),
        }),
        isLoaded: true,
      });

      render(<CharacterSheet characterId="char1" />);

      const names = screen
        .getAllByText(/^(Strength|Dexterity|Health|Mana) \((STR|DEX|HEA|MAN)\)$/)
        .map((node) => node.textContent);

      expect(names).toEqual(['Mana (MAN)', 'Health (HEA)', 'Dexterity (DEX)', 'Strength (STR)']);
    });

    it('should give a derived stat a breakdown row carrying the calculated value', () => {
      render(<CharacterSheet characterId="char1" />);

      // Health is `STR * 10` over an invested STR of 6 — the row shows the engine's number and
      // does not claim the Player invested anything in it
      const health = rowFor(/Health \(HEA\)/);
      expect(within(health).getByText('60')).toBeDefined();
      expect(within(health).queryByText(/^invested/)).toBeNull();
    });

    describe('resource gating', () => {
      it('should give a resource stat editable current-value controls', () => {
        render(<CharacterSheet characterId="char1" />);

        for (const resource of ['Health', 'Mana']) {
          expect(screen.getByLabelText(resource)).toBeDefined();
          expect(screen.getByLabelText(`Increase ${resource}`)).toBeDefined();
          expect(screen.getByLabelText(`Decrease ${resource}`)).toBeDefined();
        }
      });

      it('should give a non-resource stat no current-value controls at all', () => {
        render(<CharacterSheet characterId="char1" />);

        // Strength and Dexterity are invested stats: they have a value, not a pool to spend
        for (const stat of ['Strength', 'Dexterity']) {
          expect(screen.queryByLabelText(stat)).toBeNull();
          expect(screen.queryByLabelText(`Increase ${stat}`)).toBeNull();
          expect(screen.queryByLabelText(`Decrease ${stat}`)).toBeNull();
        }
      });

      it('should stop offering current-value controls when a stat stops being a resource', () => {
        useConfigStore.setState({
          config: createConfig({
            stats: createConfig().stats.map((stat) =>
              stat.id === 'mana' ? { ...stat, isResource: false } : stat
            ),
          }),
          isLoaded: true,
        });

        render(<CharacterSheet characterId="char1" />);

        // …but the stat itself is still on the sheet, with its calculated value
        expect(screen.queryByLabelText('Mana')).toBeNull();
        expect(within(rowFor(/Mana \(MAN\)/)).getByText('30')).toBeDefined();
      });
    });

    /**
     * The level-up mechanic (TICKET-RES-02): the pool follows the level, and spending it happens
     * here rather than in a second wizard.
     */
    describe('the derived point budget', () => {
      it('should state the pool the character’s level grants and what is left of it', () => {
        render(<CharacterSheet characterId="char1" />);

        // Level 3 × 5 points per level = 15; STR 6 + DEX 4 already spent
        expect(screen.getByText('10/15')).toBeDefined();
        expect(screen.getByText('Points spent')).toBeDefined();
      });

      it('should move the pool when experience moves the level', () => {
        useCharacterStore.setState({ characters: [createCharacter({ experience: 300 })] });

        render(<CharacterSheet characterId="char1" />);

        // Level 2 now, so 10 points — and the same 10 spent leaves nothing
        expect(screen.getByText('10/10')).toBeDefined();
      });

      it('should give every invested stat a control to spend the pool on', () => {
        render(<CharacterSheet characterId="char1" />);

        expect(screen.getByLabelText('Spend a point on Strength')).toBeDefined();
        expect(screen.getByLabelText('Remove a point from Strength')).toBeDefined();

        // A derived stat computes its own value, so there is nothing to invest in it — and it gets
        // no controls at all rather than two permanently disabled ones, because a disabled button
        // says "not now" where the truth is "not ever"
        expect(screen.queryByLabelText('Spend a point on Health')).toBeNull();
        expect(screen.queryByLabelText('Remove a point from Health')).toBeNull();
      });

      it('should spend a point through the store and show the pool shrink', () => {
        render(<CharacterSheet characterId="char1" />);

        fireEvent.click(screen.getByLabelText('Spend a point on Strength'));

        expect(useCharacterStore.getState().characters[0].investedStatPoints.STR).toBe(7);
        expect(screen.getByText('11/15')).toBeDefined();
      });

      it('should refuse a spend the pool cannot pay for, leaving the character untouched', () => {
        useCharacterStore.setState({
          characters: [createCharacter({ investedStatPoints: { STR: 11, 'dex-id': 4 } })],
        });

        render(<CharacterSheet characterId="char1" />);

        // Nothing remains, so the control is closed rather than silently doing nothing
        expect(
          (screen.getByLabelText('Spend a point on Strength') as HTMLButtonElement).disabled
        ).toBe(true);
        expect(useCharacterStore.getState().characters[0].investedStatPoints.STR).toBe(11);
      });

      it('should chip the pool rather than showing zero when the level cannot be read', () => {
        useConfigStore.setState({ config: createConfig({ curves: [] }), isLoaded: true });

        render(<CharacterSheet characterId="char1" />);

        expect(screen.getByText(/Points available:/)).toBeDefined();
        // The tally itself, by its shape: every stat row also carries an `N points spent` phrase
        // for screen readers, so matching the words alone finds ten of them and proves nothing
        expect(screen.queryByText(/^\d+\/\d+$/)).toBeNull();
      });

      it('should close every spend control when the pool cannot be priced', () => {
        // The store refuses *every* write in this state, so a live control would be a click that
        // silently did nothing — found by the conventions-reviewer on TICKET-RES-02
        useConfigStore.setState({ config: createConfig({ curves: [] }), isLoaded: true });

        render(<CharacterSheet characterId="char1" />);

        expect(
          (screen.getByLabelText('Spend a point on Strength') as HTMLButtonElement).disabled
        ).toBe(true);
        // Including the refund: an unpriceable pool refuses a `−` as well, unlike an empty one
        expect(
          (screen.getByLabelText('Remove a point from Strength') as HTMLButtonElement).disabled
        ).toBe(true);
      });

      it('should leave a refund open when the pool is merely empty', () => {
        // The distinction the `canSpend` / `canAdjust` split exists for: nothing left to spend is
        // not the same as no pool to spend from, and a Player who overspent must be able to undo it
        useCharacterStore.setState({
          characters: [createCharacter({ investedStatPoints: { STR: 11, 'dex-id': 4 } })],
        });

        render(<CharacterSheet characterId="char1" />);

        expect(
          (screen.getByLabelText('Spend a point on Strength') as HTMLButtonElement).disabled
        ).toBe(true);
        expect(
          (screen.getByLabelText('Remove a point from Strength') as HTMLButtonElement).disabled
        ).toBe(false);
      });

      it('should have no text field to type a partial number into', () => {
        render(<CharacterSheet characterId="char1" />);

        // 15-point pool, 10 already spent. Typing 20 into the old box persisted the `2` on the way
        // past and then refused the `20`, quietly unspending four points (TICKET-RES-02 review
        // finding), which is why the entry committed on blur rather than per keystroke. Stepping
        // by one removes the hazard structurally: every press is a complete, valid intent, so
        // there is nothing half-typed to hold or refuse.
        expect(screen.queryByLabelText('Points in Strength')).toBeNull();

        fireEvent.click(screen.getByLabelText('Spend a point on Strength'));

        expect(useCharacterStore.getState().characters[0].investedStatPoints.STR).toBe(7);
      });
    });
  });

  it('should navigate back to the character list', () => {
    render(<CharacterSheet characterId="char1" />);

    fireEvent.click(screen.getByRole('button', { name: 'Back to Characters' }));

    expect(navigate).toHaveBeenCalledWith({ to: '/play' });
  });

  it('should draw the purse off a table, with what the character is carrying (TICKET-CUR-02)', () => {
    // The counterpart of the table case below, which was vacuously true before this ticket — the
    // heading used to read *Wallet*, so *no Purse heading* passed for the wrong reason
    useCharacterStore.setState({ characters: [createCharacter({ purse: 340 })] });

    render(<CharacterSheet characterId="char1" />);

    expect(screen.getByRole('heading', { name: 'Purse' })).toBeDefined();
    // No currency tiers in this fixture, so the bare number is the whole reading
    expect(screen.getByText('340')).toBeDefined();
  });

  describe('states without a sheet', () => {
    it('should explain that no ruleset is loaded', () => {
      useConfigStore.setState({ config: null, isLoaded: true });

      render(<CharacterSheet characterId="char1" />);

      expect(screen.getByRole('heading', { name: 'No Ruleset Yet' })).toBeDefined();
      expect(screen.queryByRole('heading', { name: 'Stats' })).toBeNull();
    });

    it('should explain that no character has this id', () => {
      render(<CharacterSheet characterId="missing" />);

      expect(screen.getByRole('heading', { name: 'Character Not Found' })).toBeDefined();
      expect(screen.queryByRole('heading', { name: 'Stats' })).toBeNull();
    });

    it('should explain that the character belongs to another ruleset', () => {
      useCharacterStore.setState({
        characters: [createCharacter({ configurationId: 'another-config' })],
      });

      render(<CharacterSheet characterId="char1" />);

      expect(screen.getByRole('heading', { name: 'Different Ruleset Loaded' })).toBeDefined();
      expect(screen.queryByRole('heading', { name: 'Stats' })).toBeNull();
    });

    it('should say why a character could not be opened rather than blaming the link', () => {
      // The refusal banner below only renders on a drawable sheet, so a failed *open* would set a
      // sentence nothing could show — the review found it unreachable (TICKET-PLY-01)
      useCharacterStore.setState({ actionError: 'That character could not be opened.' });

      render(<CharacterSheet characterId="missing" />);

      expect(screen.getByRole('heading', { name: 'Character Not Found' })).toBeDefined();
      expect(screen.getByText('That character could not be opened.')).toBeDefined();
    });
  });

  /**
   * A character that lives at a table (TICKET-PLY-01)
   *
   * The store holds it apart from `characters` — that list is LocalStorage's — so `tableCharacter`
   * is what these set. Three things the sheet does differently for one, all of them consequences of
   * what the server will and will not accept.
   */
  describe('a character at a table', () => {
    const realFetch = globalThis.fetch;

    beforeEach(() => {
      useCharacterStore.setState({
        characters: [],
        tableCharacter: createCharacter(),
        tableCharacterOwnerId: 'account-1',
        isLoaded: true,
      });

      // The adjustment log reads the server as soon as a sheet is at a table (TICKET-DM-01).
      // Stubbed rather than left to reach `localhost`, which is what these cases were doing to
      // happy-dom's `fetch` the moment the panel landed.
      globalThis.fetch = vi.fn(async () =>
        Promise.resolve(
          new Response(JSON.stringify({ adjustments: [] }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          })
        )
      ) as unknown as typeof fetch;
    });

    afterEach(() => {
      globalThis.fetch = realFetch;
    });

    it('should render the sheet from the character the table holds', () => {
      render(<CharacterSheet characterId="char1" />);

      expect(screen.getByRole('heading', { name: 'Stats' })).toBeDefined();
    });

    it('should draw neither the experience controls nor the purse, because both are the DM’s', () => {
      // D9 and v3 Req 42.5: there is no player route for either, so the control is **absent**
      // rather than disabled — a greyed control says *not now*, and this is *not yours*
      render(<CharacterSheet characterId="char1" />);

      expect(screen.queryByRole('button', { name: 'Award' })).toBeNull();
      expect(screen.queryByRole('heading', { name: 'Purse' })).toBeNull();
    });

    it('should show the server’s refusal, and let it be dismissed', () => {
      useCharacterStore.setState({ actionError: 'That spend is more than the points you have.' });

      render(<CharacterSheet characterId="char1" />);

      const alert = screen.getByRole('alert');
      expect(alert.textContent).toContain('That spend is more than the points you have.');

      fireEvent.click(within(alert).getByRole('button', { name: 'Dismiss' }));

      expect(useCharacterStore.getState().actionError).toBeNull();
    });

    it('should show what the DM has adjusted, which a local sheet has no log for (v3 Req 42.7)', () => {
      render(<CharacterSheet characterId="char1" />);

      expect(screen.getByRole('heading', { name: "Dungeon Master's adjustments" })).toBeDefined();
    });

    it('should not draw the DM controls on the reader’s own sheet', () => {
      // Signed out throughout this file, so `useDmControls` answers *no* — which is also what it
      // answers for a Player at a real table, and the case v3 Req 42.7's first half is about
      render(<CharacterSheet characterId="char1" />);

      expect(screen.queryByRole('heading', { name: 'Dungeon Master controls' })).toBeNull();
    });

    it('should go back to the games list and put the browser’s ruleset back', () => {
      // The Snapshot was opened *for this sheet*; leaving it open would send the Player to /config
      // looking at a game's copy of the rules with nothing saying so (v3 Req 36.8)
      render(<CharacterSheet characterId="char1" />);

      fireEvent.click(screen.getByRole('button', { name: 'Back to Characters' }));

      expect(navigate).toHaveBeenCalledWith({ to: '/sessions' });
      expect(useCharacterStore.getState().tableCharacter).toBeNull();
    });
  });

  describe('a formula that does not evaluate (TICKET-FORM-06)', () => {
    /**
     * The v1.0 known bug's regression: a ruleset gains a reference the characters cannot satisfy.
     * Before FORM-05/06 this blanked the entire sheet; now it costs exactly the broken value.
     */
    function renderWithBrokenStat() {
      useConfigStore.setState({
        config: createConfig({
          stats: [
            ...createConfig().stats.filter((stat) => stat.formula === undefined),
            {
              id: 'health',
              name: 'Health',
              abbreviation: 'HEA',
              description: '',
              order: 0,
              countsTowardTotal: true,
              isResource: true,
              rounding: 'none',
              formula: 'NOPE * 10',
            },
            {
              id: 'evasion',
              name: 'Evasion',
              abbreviation: 'EVA',
              description: '',
              order: 0,
              countsTowardTotal: true,
              isResource: true,
              rounding: 'none',
              formula: 'DEX * 2',
            },
          ],
        }),
        isLoaded: true,
      });

      render(<CharacterSheet characterId="char1" />);
    }

    it('should keep the sheet rendering rather than replacing it with an error page', () => {
      renderWithBrokenStat();

      expect(screen.queryByRole('heading', { name: 'Ruleset Formula Error' })).toBeNull();
      expect(screen.getByRole('heading', { name: 'Stats' })).toBeDefined();
      expect(screen.getByRole('heading', { name: 'Stats' })).toBeDefined();
      expect(screen.getByRole('heading', { name: 'Skills' })).toBeDefined();
    });

    it('should show one chip carrying the provenance text, on the broken value only', () => {
      renderWithBrokenStat();

      const chips = screen.getAllByRole('img', { name: /Undefined variable: NOPE/ });

      expect(chips).toHaveLength(1);
      expect(chips[0].getAttribute('aria-label')).toContain('Stat "Health"');
    });

    it("should state a resource's missing maximum in words rather than chip it twice", () => {
      // The breakdown row above the editor already carries the chip with the full provenance
      // chain, so the editor says it plainly instead (TICKET-STAT-03)
      renderWithBrokenStat();

      expect(within(rowFor('Health')).getByText('maximum unavailable')).toBeDefined();
      expect(
        within(rowFor('Health')).queryByRole('img', { name: /Undefined variable/ })
      ).toBeNull();
    });

    it('should chip a broken skill level and the roll that reads it', () => {
      // Melee is `STR + skills.stealth`, and Stealth is weighted on a derived stat that cannot
      // compute — so breaking that stat breaks Stealth and Melee in turn, and Melee's chip must
      // name Stealth as the cause, which is the whole point of the chain (TICKET-SKL-02).
      useConfigStore.setState({
        config: createConfig({
          stats: [
            ...createConfig().stats,
            {
              id: 'aura',
              name: 'Aura',
              abbreviation: 'AUR',
              description: '',
              order: 9,
              countsTowardTotal: false,
              isResource: false,
              rounding: 'none',
              formula: 'MAG',
            },
          ],
          skills: [
            {
              id: 'STL',
              name: 'Stealth',
              description: '',
              statWeights: [{ statId: 'aura', weight: 1 }],
            },
          ],
        }),
        isLoaded: true,
      });

      render(<CharacterSheet characterId="char1" />);

      // The skill's own level is unavailable, and the chip carries the whole chain
      const stealthChip = within(rowFor(/Stealth/)).getByRole('img', {
        name: /Undefined variable: MAG/,
      });
      expect(stealthChip.getAttribute('aria-label')).toContain('Skill "Stealth"');

      // …and Melee's chip names Stealth as the upstream cause
      const meleeChip = within(rowFor(/^Melee$/)).getByRole('img', { name: /Stealth/ });
      const chain = meleeChip.getAttribute('aria-label') ?? '';
      expect(chain).toContain('Roll "Melee"');
      expect(chain).toContain('Skill "Stealth"');
      expect(chain).toContain('Undefined variable: MAG');
    });

    it('should refuse to roll a roll whose input could not be calculated', () => {
      useConfigStore.setState({
        config: createConfig({
          rollDefinitions: [
            {
              id: 'mel-id',
              name: 'Melee',
              description: '',
              input: 'MAG',
              ladderId: 'ladder',
              order: 0,
            },
          ],
        }),
        isLoaded: true,
      });

      render(<CharacterSheet characterId="char1" />);

      // No pool to put on the label, so the button falls back to the roll's name and is disabled
      const rollButton = within(rowFor(/^Melee$/)).getByRole('button', { name: 'Roll Melee' });
      expect((rollButton as HTMLButtonElement).disabled).toBe(true);
    });

    it('should still render every other section its numbers', () => {
      renderWithBrokenStat();

      // Evasion's own formula is fine, so its maximum is still shown: DEX 4 + elf racial 2 = 6,
      // and the formula doubles it
      expect(within(rowFor('Evasion')).getByText('of 12 max')).toBeDefined();

      // …as are the stat and skill totals, which never depended on the broken formula.
      // Stealth is 3 invested + DEX 6 × 0.5 = 6, which the row leads with; the bonus it rounds to
      // is round(6 / 5) = 1, behind it in the breakdown.
      expect(within(rowFor(/Strength \(STR\)/)).getByText('6', VISIBLE_ONLY)).toBeDefined();
      expect(within(rowFor(/Stealth/)).getByText('6', VISIBLE_ONLY)).toBeDefined();
      expect(within(rowFor(/Stealth/)).getByText('bonus 1')).toBeDefined();
    });
  });

  describe('a main skill no character invested (TICKET-CALC-02)', () => {
    it('should calculate a new stat over it rather than chipping the sheet', () => {
      // The original report: the User adds something to the ruleset, and every existing
      // character's sheet goes blank with `Undefined variable`. FORM-06 reduced that to one chip;
      // CALC-02 removes the chip too — a configured main skill nobody invested is simply 0.
      useConfigStore.setState({
        config: createConfig({
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
              id: 'WIS',
              name: 'Wisdom',
              abbreviation: 'WIS',
              description: '',
              order: 2,
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
            {
              id: 'insight',
              name: 'Insight',
              abbreviation: 'INS',
              description: '',
              order: 0,
              countsTowardTotal: true,
              isResource: true,
              rounding: 'none',
              formula: 'WIS * 3',
            }, // newly added
          ],
        }),
        isLoaded: true,
      });

      render(<CharacterSheet characterId="char1" />);

      // The sheet is still a sheet
      expect(screen.getByRole('heading', { level: 1, name: 'Aria' })).toBeDefined();
      expect(screen.getByRole('heading', { name: 'Stats' })).toBeDefined();

      // Health still calculates from the levels the character does have
      expect(within(rowFor('Health')).getByText('of 60 max')).toBeDefined();

      // …the new main skill reads as 0 rather than as a missing variable…
      expect(within(rowFor(/Wisdom \(WIS\)/)).getByText('0', VISIBLE_ONLY)).toBeDefined();

      // …so the new stat is a number, and nothing on the sheet is chipped
      expect(within(rowFor('Insight')).getByText('of 0 max')).toBeDefined();
      expect(screen.queryAllByRole('img', { name: /Undefined variable/ })).toHaveLength(0);
    });
  });
});
