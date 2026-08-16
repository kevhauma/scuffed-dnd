/**
 * Character Sheet Tests
 *
 * Navigation is mocked at the router boundary; the stores are real, with storage mocked, so an
 * edit really goes through the store action and back out as rendered state.
 *
 * **Validates: Requirements 8.5, 9.3, 13.4, 14.1, 14.2, 14.3, 14.4, 14.5, 21.1-21.5**
 */

import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Character } from '../../../types/character';
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
import { CharacterSheet } from './CharacterSheet';

function createConfig(overrides: Partial<Configuration> = {}): Configuration {
  return {
    id: 'config1',
    name: 'Test Config',
    version: '1.0',
    schemaVersion: 7,
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
    combatSkills: [
      {
        id: 'MEL',
        code: 'MEL',
        name: 'Melee',
        description: '',
        dice: { d4: 0, d6: 2, d8: 0, d10: 0, d12: 0, d20: 1 },
        bonusFormula: 'STR + skills.stealth',
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
    focusStatBonusLevel: 3,
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
    // Names a skill, which is to say nothing: the focus is matched against a stat abbreviation
    // and a `Skill` has no code since TICKET-SKL-02, so no stat receives the bonus
    focusStatCode: 'STL',
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
    expect(screen.getByText(/900 XP · Elf · focus: STL/)).toBeDefined();

    for (const section of ['Race Stat Block', 'Stats', 'Skills', 'Combat Skills']) {
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
    // its level as +2 and its bonus rounds up a step: level 3 + 5 = 8, bonus round(8 / 5) = 2.
    expect(within(rowFor(/Stealth/)).getByText('2')).toBeDefined();
  });

  it("should show a stat's contributions separately from its total", () => {
    render(<CharacterSheet characterId="char1" />);

    const dexterity = rowFor(/Dexterity \(DEX\)/);
    // Allocated and race are shown apart (Requirement 13.4), not folded into the total
    expect(within(dexterity).getByText('invested +4')).toBeDefined();
    expect(within(dexterity).getByText('race +2')).toBeDefined();
    expect(within(dexterity).getByText('6')).toBeDefined();
  });

  it('should show the focus bonus as its own term on the stat that receives it', () => {
    // The focus lands on a **stat** — it is matched against an abbreviation, and a `Skill` has no
    // code to be named by since TICKET-SKL-02
    useCharacterStore.setState({ characters: [createCharacter({ focusStatCode: 'STR' })] });

    render(<CharacterSheet characterId="char1" />);

    expect(within(rowFor(/Strength \(STR\)/)).getByText('focus +3')).toBeDefined();
  });

  it('should give the focus nothing to land on when it names a skill (TICKET-SKL-02)', () => {
    // The base fixture's `focusStatCode: 'STL'` is a skill id, which matches no abbreviation, so
    // no stat gains the bonus and the header is the only place the code appears at all
    render(<CharacterSheet characterId="char1" />);

    expect(within(rowFor(/Strength \(STR\)/)).queryByText(/focus/)).toBeNull();
    expect(within(rowFor(/Stealth/)).queryByText(/focus/)).toBeNull();
  });

  /**
   * The `focus stat` badge has no caller (TICKET-SKL-02)
   *
   * `SkillBreakdownRow` still accepts `isFocusStat`, but the only section that ever passed it was
   * the speciality-skills one this ticket deleted — a skill cannot be a focus now, and the stats
   * grid never marked one. So the badge is unreachable rather than merely unused here.
   *
   * Left in place rather than removed: TICKET-ARC-03 retires the focus stat outright, prop and
   * badge included, and deleting half of it now would only make that ticket's diff harder to read.
   */
  it('marks no row as the focus stat, because nothing passes the flag any more', () => {
    useCharacterStore.setState({ characters: [createCharacter({ focusStatCode: 'STR' })] });

    render(<CharacterSheet characterId="char1" />);

    expect(screen.queryByText('focus stat')).toBeNull();
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
      expect(within(row).getByText(`level ${expected.skillLevels.STL}`)).toBeDefined();
      // The bonus is the row's lead number — `variant="highlight"` — rather than any text node
      // that happens to read "1"
      expect(within(row).getByText(String(expected.skillBonuses.STL)).className).toContain(
        'font-mono'
      );
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
      expect(within(row).getByText('level 1.4')).toBeDefined();
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
      within(rowFor(/Strength \(STR\)/)).getByText(String(expected.statValues.STR))
    ).toBeDefined();
    expect(
      within(rowFor(/Dexterity \(DEX\)/)).getByText(String(expected.statValues['dex-id']))
    ).toBeDefined();
    // The skill row carries the **bonus** — the number a Player adds to a roll (Concept 02) — with
    // the level beside it since TICKET-SKL-03
    expect(within(rowFor(/Stealth/)).getByText(String(expected.skillBonuses.STL))).toBeDefined();
    expect(
      within(rowFor(/Stealth/)).getByText(`level ${String(expected.skillLevels.STL)}`)
    ).toBeDefined();
    expect(
      within(rowFor(/Melee \(MEL\)/)).getByText(`+${expected.combatSkillBonuses.MEL}`)
    ).toBeDefined();
    expect(
      within(rowFor('Health')).getByText(`of ${expected.statValues.health} max`)
    ).toBeDefined();
  });

  it('should list each combat skill with its dice notation and bonus', () => {
    render(<CharacterSheet characterId="char1" />);

    expect(within(rowFor(/Melee \(MEL\)/)).getByText('2d6 + 1d20')).toBeDefined();
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
        expect(screen.getByText('10 of 15 points spent · 5 remaining')).toBeDefined();
      });

      it('should move the pool when experience moves the level', () => {
        useCharacterStore.setState({ characters: [createCharacter({ experience: 300 })] });

        render(<CharacterSheet characterId="char1" />);

        // Level 2 now, so 10 points — and the same 10 spent leaves nothing
        expect(screen.getByText('10 of 10 points spent · 0 remaining')).toBeDefined();
      });

      it('should give every invested stat a control to spend the pool on', () => {
        render(<CharacterSheet characterId="char1" />);

        expect(screen.getByLabelText('Points in Strength')).toBeDefined();
        expect(screen.getByLabelText('Spend a point on Strength')).toBeDefined();
        // A derived stat computes its own value, so there is nothing to invest in it
        expect(screen.queryByLabelText('Points in Health')).toBeNull();
      });

      it('should spend a point through the store and show the pool shrink', () => {
        render(<CharacterSheet characterId="char1" />);

        fireEvent.click(screen.getByLabelText('Spend a point on Strength'));

        expect(useCharacterStore.getState().characters[0].investedStatPoints.STR).toBe(7);
        expect(screen.getByText('11 of 15 points spent · 4 remaining')).toBeDefined();
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
        expect(screen.queryByText(/points spent/)).toBeNull();
      });

      it('should close every spend control when the pool cannot be priced', () => {
        // The store refuses *every* write in this state, so a live control would be a click that
        // silently did nothing — found by the conventions-reviewer on TICKET-RES-02
        useConfigStore.setState({ config: createConfig({ curves: [] }), isLoaded: true });

        render(<CharacterSheet characterId="char1" />);

        expect(
          (screen.getByLabelText('Spend a point on Strength') as HTMLButtonElement).disabled
        ).toBe(true);
        expect(
          (screen.getByLabelText('Remove a point from Strength') as HTMLButtonElement).disabled
        ).toBe(true);
        expect((screen.getByLabelText('Points in Strength') as HTMLInputElement).disabled).toBe(
          true
        );
      });

      it('should not persist the digits typed on the way to an unaffordable number', () => {
        render(<CharacterSheet characterId="char1" />);

        const box = screen.getByLabelText('Points in Strength');
        // 15-point pool, 10 already spent. Typing 20 used to persist the `2` on the way past and
        // then refuse the `20`, quietly unspending four points (TICKET-RES-02 review finding).
        fireEvent.change(box, { target: { value: '2' } });
        fireEvent.change(box, { target: { value: '20' } });
        fireEvent.blur(box);

        expect(useCharacterStore.getState().characters[0].investedStatPoints.STR).toBe(6);
      });
    });
  });

  it('should navigate back to the character list', () => {
    render(<CharacterSheet characterId="char1" />);

    fireEvent.click(screen.getByRole('button', { name: 'Back to Characters' }));

    expect(navigate).toHaveBeenCalledWith({ to: '/play' });
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

    it('should chip a broken skill level and the combat skill that reads it', () => {
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
      const meleeChip = within(rowFor(/Melee \(MEL\)/)).getByRole('img', { name: /Stealth/ });
      const chain = meleeChip.getAttribute('aria-label') ?? '';
      expect(chain).toContain('Combat Skill "Melee"');
      expect(chain).toContain('Skill "Stealth"');
      expect(chain).toContain('Undefined variable: MAG');
    });

    it('should refuse to roll a combat skill whose bonus could not be calculated', () => {
      useConfigStore.setState({
        config: createConfig({
          combatSkills: [
            {
              id: 'MEL',
              code: 'MEL',
              name: 'Melee',
              description: '',
              dice: { d4: 0, d6: 2, d8: 0, d10: 0, d12: 0, d20: 1 },
              bonusFormula: 'MAG',
            },
          ],
        }),
        isLoaded: true,
      });

      render(<CharacterSheet characterId="char1" />);

      const rollButton = within(rowFor(/Melee \(MEL\)/)).getByRole('button', { name: 'Roll MEL' });
      expect((rollButton as HTMLButtonElement).disabled).toBe(true);
    });

    it('should still render every other section its numbers', () => {
      renderWithBrokenStat();

      // Evasion's own formula is fine, so its maximum is still shown: DEX 4 + elf racial 2 = 6,
      // and the formula doubles it
      expect(within(rowFor('Evasion')).getByText('of 12 max')).toBeDefined();

      // …as are the stat and skill totals, which never depended on the broken formula.
      // Stealth is 3 invested + DEX 6 × 0.5 = 6, so its bonus is round(6 / 5) = 1.
      expect(within(rowFor(/Strength \(STR\)/)).getByText('6')).toBeDefined();
      expect(within(rowFor(/Stealth/)).getByText('1')).toBeDefined();
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
      expect(within(rowFor(/Wisdom \(WIS\)/)).getByText('0')).toBeDefined();

      // …so the new stat is a number, and nothing on the sheet is chipped
      expect(within(rowFor('Insight')).getByText('of 0 max')).toBeDefined();
      expect(screen.queryAllByRole('img', { name: /Undefined variable/ })).toHaveLength(0);
    });
  });
});
