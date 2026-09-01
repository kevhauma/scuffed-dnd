/**
 * The DM's view of a player's sheet is read-only (TICKET-DM-05)
 *
 * **A second file rather than more cases in `CharacterSheet.test.tsx`**, for `useRoller.table`'s
 * reason: that file mocks `useAuth` as signed out for every case in it, deliberately, because local
 * mode is what it is about. A DM only exists signed in and at a table, so the identity has to be the
 * file's rather than one case's.
 *
 * The claim is one sentence: **a DM opening somebody else's sheet sees no control whose write the
 * server would refuse, and every number those controls used to sit beside.** `requireCharacterPlayer`
 * is `requireCharacterWriter` minus the DM, and until this ticket the sheet drew the Player's own
 * controls to a reader whose every press met a 404.
 *
 * The six surfaces are **enumerated** rather than spot-checked, which is criterion 1's own wording: a
 * seventh Player-only control added to the sheet without a row here is the way this regresses.
 *
 * **Validates: v3 Req 41.1, 42.7, 49.10; Requirements 21.1-21.5**
 */

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Character } from '#shared/types/character';
import type { Configuration } from '#shared/types/config';

const navigate = vi.fn();
vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => navigate,
}));

// Signed in as somebody, and *who* is the whole subject — each case sets the table's owner to say
// whether this reader is the character's Player or their DM
const account = { current: 'account-dm' };
vi.mock('../../auth/useAuth', () => ({
  useAuth: () => ({
    accountId: account.current,
    email: 'pat@example.test',
    isPending: false,
    isSignedIn: true,
  }),
}));

vi.mock('../../../services/storage', () => ({
  loadConfiguration: vi.fn(() => null),
  saveConfiguration: vi.fn(),
  loadCharacters: vi.fn(() => []),
  saveCharacters: vi.fn(),
  isStorageAvailable: vi.fn(() => true),
}));

import { useCharacterStore } from '../../../stores/characterStore';
import { useConfigStore } from '../../../stores/configStore';
import { CharacterSheet } from './CharacterSheet';

/**
 * A ruleset with one of everything the six surfaces need
 *
 * A spendable stat, a resource pool, a skill to focus and spend on, a roll to throw and a spell to
 * cast — so every surface has something to draw and the absence of a control is a decision rather
 * than an empty list.
 */
function createConfig(): Configuration {
  return {
    id: 'config1',
    name: 'Test Config',
    version: '1.0',
    schemaVersion: 10,
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
        id: 'health',
        name: 'Health',
        abbreviation: 'HEA',
        description: '',
        order: 1,
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
        statWeights: [{ statId: 'STR', weight: 0.5 }],
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
    rollDefinitions: [
      {
        id: 'mel-id',
        name: 'Melee',
        description: '',
        input: 'STR',
        ladderId: 'ladder',
        category: 'offence',
        order: 0,
      },
    ],
    spells: [
      {
        id: 'spell-1',
        name: 'Firebolt',
        description: '',
        manaCost: 3,
        rangeTime: '60ft',
        effectTemplate: '',
      },
    ],
    materials: [],
    materialCategories: [],
    items: [],
    equipmentSlots: [],
    races: [],
    currencyTiers: [],
    constants: [
      {
        id: 'const-ppl',
        name: 'points_per_level',
        displayName: 'Points per level',
        description: '',
        value: 5,
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
  };
}

/** A character with points spent, a focus picked and a spell learned, so every reading has a number */
function createCharacter(): Character {
  return {
    id: 'char1',
    name: 'Aria',
    configurationId: 'config1',
    raceIds: [],
    // 39 rather than a small number so the roll's pool decomposes across all three rungs of the
    // ladder — `1D20 + 1D12 + 1D6 + 1` is the reading the DM keeps once the button goes
    investedStatPoints: { STR: 39 },
    investedSkillPoints: { STL: 3 },
    currentResourceValues: { health: 42 },
    experience: 300,
    focusSkillIds: ['STL'],
    learnedSpellIds: ['spell-1'],
    inventory: { equippedItems: {}, composedItems: [] },
    createdAt: '2024-01-01',
    updatedAt: '2024-01-01',
  };
}

/**
 * Open the character at a table owned by `ownerAccountId`
 *
 * The store holds a table's character apart from `characters`, which is LocalStorage's list — so
 * this is what a sheet at a table is, and the owner is what decides which reader is looking at it.
 */
function openAtTable(ownerAccountId: string) {
  useCharacterStore.setState({
    characters: [],
    tableCharacter: createCharacter(),
    tableCharacterOwnerId: ownerAccountId,
    tableSessionId: 'session-1',
    isLoaded: true,
  });
}

/** Open the same character as the browser's own, where there is no table and no DM (D6) */
function openLocally() {
  useCharacterStore.setState({
    characters: [createCharacter()],
    tableCharacter: null,
    tableCharacterOwnerId: null,
    tableSessionId: null,
    isLoaded: true,
  });
}

/**
 * One Player-only control, and how to find it
 *
 * The **six surfaces of criterion 1**, each named by the control that goes and the reading that
 * stays. `control` is queried by role so an assertion cannot pass on a label that merely mentions the
 * word; `reading` is the number or phrase the surface must still show, which is criterion 4.
 */
const SURFACES = [
  {
    surface: 'a stat spend',
    control: () => screen.queryByRole('button', { name: 'Spend a point on Strength' }),
    reading: () => screen.queryByText('39 points spent'),
  },
  {
    surface: 'a skill spend',
    control: () => screen.queryByRole('button', { name: 'Spend a point on Stealth' }),
    reading: () => screen.queryByText('3 points spent'),
  },
  {
    surface: 'a pool editor',
    control: () => screen.queryByRole('button', { name: 'Restore Health to full' }),
    reading: () => screen.queryByText('of 390 max'),
  },
  {
    surface: 'the focus picker',
    control: () => screen.queryByLabelText('Focus 1'),
    // The **slot heading**, not the skill it names: `Stealth` also appears in the skills grid, so a
    // case asserting that would pass with `FocusSkillsSection` rendering nothing at all. `Focus 1` is
    // the picker's `Label` for a Player and plain text for a DM, and it is unique to this section.
    reading: () => screen.queryByText('Focus 1'),
  },
  {
    surface: 'a Spellbook control',
    control: () => screen.queryByRole('button', { name: 'Cast' }),
    reading: () => screen.queryByText('Firebolt'),
  },
  {
    surface: 'a roll button',
    control: () => screen.queryByRole('button', { name: /^Roll/ }),
    reading: () => screen.queryByText('1D20 + 1D12 + 1D6 + 1'),
  },
] as const;

describe('the DM’s view of a player’s sheet', () => {
  const realFetch = globalThis.fetch;

  beforeEach(() => {
    vi.clearAllMocks();
    account.current = 'account-dm';

    const rules = createConfig();
    useConfigStore.setState({ config: rules, isLoaded: true });

    // The adjustment log and the roll log both read the server as soon as a sheet is at a table;
    // stubbed rather than left to reach `localhost` from a unit test
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      const body = url.includes('/rolls') ? { rolls: [] } : { adjustments: [] };
      const payload = JSON.stringify(body);
      const headers = { 'Content-Type': 'application/json' };

      return new Response(payload, { status: 200, headers });
    }) as unknown as typeof fetch;
  });

  afterEach(() => {
    globalThis.fetch = realFetch;
    cleanup();
  });

  describe('the table’s DM, whose every write the server refuses', () => {
    beforeEach(() => {
      openAtTable('account-player');
    });

    it.each(SURFACES)('should draw no $surface', ({ control }) => {
      render(<CharacterSheet characterId="char1" />);

      const found = control();
      expect(found).toBeNull();
    });

    it.each(SURFACES)('should still show what $surface sat beside', ({ reading }) => {
      // Criterion 4: a number that was editable and is now read is still **shown**. Removing the
      // affordance must not remove the information — a DM opened this sheet to read exactly these.
      render(<CharacterSheet characterId="char1" />);

      const found = reading();
      expect(found).not.toBeNull();
    });

    it('should draw no spend control on a stat, present-and-disabled being the thing rejected', () => {
      // Named on its own as well as enumerated above, because *absent, not disabled* is the whole
      // discipline and a `disabled` attribute would satisfy a mere "cannot press it" assertion
      render(<CharacterSheet characterId="char1" />);

      const spend = screen.queryByRole('button', { name: 'Spend a point on Strength' });
      const refund = screen.queryByRole('button', { name: 'Remove a point from Strength' });

      expect(spend).toBeNull();
      expect(refund).toBeNull();
    });

    it('should draw no roll button, because the server refuses a DM’s roll', () => {
      // `rollDice.ts` is `requireCharacterPlayer` too, so a live-looking roll button is the most
      // misleading control on the page — it would produce a number somebody acts on
      render(<CharacterSheet characterId="char1" />);

      const button = screen.queryByRole('button', { name: /^Roll/ });
      const notice = screen.getByText(/Only the Player rolls their own dice/);

      expect(button).toBeNull();
      expect(notice).toBeDefined();
    });

    it('should keep the controls that are genuinely the DM’s', () => {
      // The point of the ticket is *which* controls go: the DM's own panel and the purse they hand
      // out stay, or this would be read-only in the unhelpful sense
      render(<CharacterSheet characterId="char1" />);

      const panel = screen.getByRole('heading', { name: 'Dungeon Master controls' });
      const sidebar = screen.getByRole('heading', { name: 'Quick actions' });

      expect(panel).toBeDefined();
      expect(sidebar).toBeDefined();
    });
  });

  describe('a Player on their own sheet at a table', () => {
    beforeEach(() => {
      account.current = 'account-player';
      openAtTable('account-player');
    });

    it.each(SURFACES)('should draw $surface', ({ control }) => {
      // `requireCharacterPlayer` is the writer rule minus the **DM**, not minus the table: every one
      // of these six writes is the Player's own, wherever their character lives
      render(<CharacterSheet characterId="char1" />);

      const found = control();
      expect(found).not.toBeNull();
    });
  });

  describe('a character in this browser, where there is no DM at all', () => {
    beforeEach(() => {
      openLocally();
    });

    it.each(SURFACES)('should draw $surface', ({ control }) => {
      // Signed in but not at a table: `useIsDungeonMaster` says no, so nothing about local mode
      // changes — D6's promise that the browser-only path does not degrade
      render(<CharacterSheet characterId="char1" />);

      const found = control();
      expect(found).not.toBeNull();
    });
  });
});
