/**
 * Reference Walker Tests
 *
 * One case per guarded-delete target kind: what points at it, and what does not.
 *
 * **Validates: Concept 00 §6; Requirements 2.5, 2.6, 18.1, 18.3**
 */

import { describe, expect, it } from 'vitest';
import type { Character } from '../types/character';
import type { Configuration } from '../types/config';
import { findReferences } from './dependencies';

function createConfig(overrides: Partial<Configuration> = {}): Configuration {
  return {
    id: 'config1',
    name: 'Test Config',
    version: '1.0',
    schemaVersion: 9,
    stats: [
      {
        id: 'id-str',
        name: 'Strength',
        abbreviation: 'STR',
        description: '',
        order: 0,
        countsTowardTotal: true,
        isResource: false,
        rounding: 'none',
      },
      {
        id: 'id-dex',
        name: 'Dexterity',
        abbreviation: 'DEX',
        description: '',
        order: 1,
        countsTowardTotal: true,
        isResource: false,
        rounding: 'none',
      },
      {
        id: 'id-hp',
        name: 'Health',
        abbreviation: 'HEA',
        description: '',
        order: 0,
        countsTowardTotal: true,
        isResource: false,
        rounding: 'none',
        formula: 'STR * 10',
      },
    ],
    skills: [
      {
        id: 'id-stl',
        name: 'Stealth',
        description: '',
        statWeights: [{ statId: 'id-dex', weight: 0.3 }],
      },
    ],
    // A roll's input is the formula-carrying field that replaced the combat skill's `bonusFormula`
    // (TICKET-ROLL-06), so it is what the formula-reference cases below are written over
    diceLadders: [
      {
        id: 'id-ladder',
        name: 'Standard',
        description: '',
        dieSizes: [20, 12, 6],
        showZeroTerms: true,
        remainder: 'flat',
      },
    ],
    rollDefinitions: [
      {
        id: 'id-mel',
        name: 'Melee',
        description: '',
        input: 'STR + skills.stealth',
        ladderId: 'id-ladder',
        order: 0,
      },
    ],
    materials: [
      {
        id: 'iron',
        name: 'Iron',
        description: '',
        categoryId: 'metal',
        levels: [
          {
            level: 1,
            name: 'Iron',
            bonuses: [{ statId: 'id-str', modifier: 1 }],
            value: { tierId: 'gold', amount: 5 },
          },
        ],
      },
    ],
    materialCategories: [{ id: 'metal', name: 'Metal', description: '' }],
    items: [
      {
        id: 'axe',
        name: 'Axe',
        description: '',
        materialId: 'iron',
        equipmentSlotType: 'main_hand',
      },
    ],
    equipmentSlots: [{ type: 'main_hand', name: 'Main Hand', description: '' }],
    races: [
      {
        id: 'dwarf',
        name: 'Dwarf',
        description: '',
        statValues: { 'id-str': 2 },
      },
    ],
    currencyTiers: [{ id: 'gold', name: 'Gold', order: 0, conversionToNext: 10 }],
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
    raceIds: ['dwarf'],
    investedStatPoints: { 'id-str': 5, 'id-dex': 4 },
    investedSkillPoints: { STL: 2 },
    currentResourceValues: { 'id-hp': 30 },
    experience: 0,
    inventory: { equippedItems: { main_hand: 'axe' }, miscItems: [] },
    createdAt: '2024-01-01',
    updatedAt: '2024-01-01',
    ...overrides,
  };
}

/** The holder labels of a reference list, for terse assertions */
function holders(references: ReturnType<typeof findReferences>): string[] {
  return references.map((reference) => `${reference.holderKind}: ${reference.holderName}`);
}

describe('findReferences', () => {
  describe('skills', () => {
    it('finds a stat in formulas, modifiers and characters', () => {
      const found = findReferences({ kind: 'stat', id: 'id-str' }, createConfig(), [
        createCharacter(),
      ]);

      expect(holders(found)).toEqual([
        'Stat: Health',
        'Roll Definition: Melee',
        'Race: Dwarf',
        'Material: Iron',
        'Character: Aria',
      ]);
    });

    it('finds a material tier modifier by stat id, so a rename cannot defeat the guard', () => {
      // TICKET-MAT-01: the modifier holds the stat's identity, not its spelling, so renaming the
      // abbreviation leaves the reference — and the delete guard — exactly where it was
      const renamed = createConfig({
        stats: createConfig().stats.map((stat) =>
          stat.id === 'id-str' ? { ...stat, abbreviation: 'STG' } : stat
        ),
      });

      const found = findReferences({ kind: 'stat', id: 'id-str' }, renamed, []);

      expect(holders(found)).toContain('Material: Iron');
    });

    it('no longer finds a material bonus when a skill is deleted (TICKET-MAT-01)', () => {
      // A tier modifier can only target a stat now, so a material is never a reason a skill
      // cannot be deleted
      const found = findReferences({ kind: 'skill', id: 'id-stl' }, createConfig(), []);

      expect(holders(found)).not.toContain('Material: Iron');
    });

    it('does not count a zero in a race stat block as a reference (TICKET-RACE-01)', () => {
      // A block may cover every configured stat — absent and 0 mean the same thing — so keying
      // the guard off the presence of the key would make every race point at every stat and
      // refuse every stat delete. A guard that always fires tells the User nothing.
      const config = createConfig({
        races: [
          { id: 'dwarf', name: 'Dwarf', description: '', statValues: { 'id-str': 0, 'id-dex': 2 } },
        ],
      });

      expect(holders(findReferences({ kind: 'stat', id: 'id-str' }, config, []))).not.toContain(
        'Race: Dwarf'
      );
      expect(holders(findReferences({ kind: 'stat', id: 'id-dex' }, config, []))).toContain(
        'Race: Dwarf'
      );
    });

    it('finds a skill named by a roll input, by id (TICKET-SKL-02)', () => {
      // Targeted by id rather than by a code, and matched through `skills.<name>` — the only way
      // a formula can name a skill now
      const found = findReferences({ kind: 'skill', id: 'id-stl' }, createConfig(), []);

      expect(holders(found)).toEqual(['Roll Definition: Melee']);
    });

    it('does not count a code that merely appears inside a longer identifier', () => {
      const config = createConfig({
        stats: [
          {
            id: 'id-hp',
            name: 'Health',
            abbreviation: 'HEA',
            description: '',
            order: 0,
            countsTowardTotal: true,
            isResource: false,
            rounding: 'none',
            formula: 'STRENGTH * 10',
          },
        ],
        races: [],
        materials: [],
      });

      expect(findReferences({ kind: 'stat', id: 'id-str' }, config, [])).toEqual([]);
    });

    it('reports nothing for a roll, which nothing can name (TICKET-ROLL-06)', () => {
      // No `rolls` namespace and no persisted holder — a roll is a leaf by construction
      expect(findReferences({ kind: 'roll-definition', id: 'id-mel' }, createConfig(), [])).toEqual(
        []
      );
    });
  });

  describe('stats', () => {
    it('finds a stat named by another formula through its display slug', () => {
      const config = createConfig({
        rollDefinitions: [
          {
            id: 'id-mel',
            name: 'Melee',
            description: '',
            input: 'stats.health / 2',
            ladderId: 'id-ladder',
            order: 0,
          },
        ],
      });

      expect(holders(findReferences({ kind: 'stat', id: 'id-hp' }, config, []))).toEqual([
        'Roll Definition: Melee',
      ]);
    });

    it('finds a stat a character has a current value for', () => {
      const found = findReferences({ kind: 'stat', id: 'id-hp' }, createConfig(), [
        createCharacter(),
      ]);

      expect(holders(found)).toEqual(['Character: Aria']);
    });

    it('does not count the stat’s own formula against it', () => {
      const config = createConfig({
        stats: [
          {
            id: 'id-hp',
            name: 'Health',
            abbreviation: 'HEA',
            description: '',
            order: 0,
            countsTowardTotal: true,
            isResource: false,
            rounding: 'none',
            formula: 'stats.health',
          },
        ],
      });

      expect(findReferences({ kind: 'stat', id: 'id-hp' }, config, [])).toEqual([]);
    });
  });

  it('finds a race on a character', () => {
    const found = findReferences({ kind: 'race', id: 'dwarf' }, createConfig(), [
      createCharacter(),
    ]);

    expect(holders(found)).toEqual(['Character: Aria']);
    expect(found[0].field).toBe('raceIds');
  });

  it('finds an archetype that tags a stat (TICKET-ARC-01)', () => {
    // A tagging is stored sparsely, so presence of the key *is* the opinion — unlike a race's
    // dense stat block, where a zero is not a reference
    const config = createConfig({
      archetypes: [
        { id: 'strong', name: 'Strong', description: '', statAffinity: { 'id-str': 'main' } },
      ],
    });

    const found = findReferences({ kind: 'stat', id: 'id-str' }, config, []);

    expect(found.some((reference) => reference.holderName === 'Strong')).toBe(true);
    expect(found.find((reference) => reference.holderName === 'Strong')?.holderKind).toBe(
      'Archetype'
    );
  });

  it('does not count a stat an archetype says nothing about as a reference', () => {
    const config = createConfig({
      archetypes: [
        { id: 'strong', name: 'Strong', description: '', statAffinity: { 'id-str': 'main' } },
      ],
    });

    expect(
      findReferences({ kind: 'stat', id: 'id-hp' }, config, []).some(
        (reference) => reference.holderKind === 'Archetype'
      )
    ).toBe(false);
  });

  it('finds an archetype on a character (TICKET-ARC-01)', () => {
    const found = findReferences({ kind: 'archetype', id: 'strong' }, createConfig(), [
      createCharacter({ archetypeId: 'strong' }),
    ]);

    expect(holders(found)).toEqual(['Character: Aria']);
    expect(found[0].field).toBe('archetypeId');
  });

  it('finds nothing for an archetype no character is built on', () => {
    expect(
      findReferences({ kind: 'archetype', id: 'strong' }, createConfig(), [createCharacter()])
    ).toEqual([]);
  });

  it('finds an item in an inventory, equipped or loose', () => {
    const equipped = findReferences({ kind: 'item', id: 'axe' }, createConfig(), [
      createCharacter(),
    ]);
    const loose = findReferences({ kind: 'item', id: 'axe' }, createConfig(), [
      createCharacter({ inventory: { equippedItems: {}, miscItems: ['axe'] } }),
    ]);

    expect(holders(equipped)).toEqual(['Character: Aria']);
    expect(holders(loose)).toEqual(['Character: Aria']);
  });

  it('finds a material on an item', () => {
    expect(holders(findReferences({ kind: 'material', id: 'iron' }, createConfig(), []))).toEqual([
      'Item: Axe',
    ]);
  });

  it('finds a material category on a material', () => {
    expect(
      holders(findReferences({ kind: 'material-category', id: 'metal' }, createConfig(), []))
    ).toEqual(['Material: Iron']);
  });

  it('finds an equipment slot on an item and in an inventory', () => {
    const found = findReferences({ kind: 'equipment-slot', id: 'main_hand' }, createConfig(), [
      createCharacter(),
    ]);

    expect(holders(found)).toEqual(['Item: Axe', 'Character: Aria']);
  });

  it('finds a currency tier on a material level value, keyed by the material that holds it', () => {
    const found = findReferences({ kind: 'currency-tier', id: 'gold' }, createConfig(), []);

    expect(holders(found)).toEqual(['Material: Iron — Iron']);
    expect(found[0].field).toBe('levels[1].value.tierId');
    expect(found[0].holderId).toBe('iron');
  });

  it('reports a formula holder by its stable id, not its spelling', () => {
    const found = findReferences({ kind: 'stat', id: 'id-str' }, createConfig(), []);
    const roll = found.find((reference) => reference.holderKind === 'Roll Definition');

    expect(roll?.holderId).toBe('id-mel');
  });

  it('reports nothing for an entity nothing points at', () => {
    const bare = createConfig({
      stats: [],
      races: [],
      materials: [],
      items: [],
    });

    expect(findReferences({ kind: 'stat', id: 'id-str' }, bare, [])).toEqual([]);
    expect(findReferences({ kind: 'currency-tier', id: 'gold' }, bare, [])).toEqual([]);
  });

  it('treats an absent character list as no characters', () => {
    expect(findReferences({ kind: 'race', id: 'dwarf' }, createConfig())).toEqual([]);
  });
  describe('constants (TICKET-CST-01)', () => {
    const withConstant = () =>
      createConfig({
        constants: [
          {
            id: 'id-div',
            name: 'bonus_divider',
            displayName: 'Bonus divider',
            description: 'Levels per point of bonus',
            value: 5,
          },
        ],
        stats: [
          {
            id: 'id-hp',
            name: 'Health',
            abbreviation: 'HEA',
            description: '',
            order: 0,
            countsTowardTotal: true,
            isResource: false,
            rounding: 'none',
            formula: '10 / const.bonus_divider',
          },
        ],
      });

    it('finds the formula naming a constant', () => {
      expect(
        holders(findReferences({ kind: 'constant', id: 'id-div' }, withConstant(), []))
      ).toEqual(['Stat: Health']);
    });

    it('does not confuse a stat slug with a constant of the same name', () => {
      // A stat named "Bonus divider" slugs to the same identifier the constant uses
      const config = createConfig({
        constants: [
          {
            id: 'id-div',
            name: 'bonus_divider',
            displayName: 'Bonus divider',
            description: 'Levels per point of bonus',
            value: 5,
          },
        ],
        stats: [
          {
            id: 'id-slug',
            name: 'Bonus divider',
            abbreviation: 'BON',
            description: '',
            order: 0,
            countsTowardTotal: true,
            isResource: false,
            rounding: 'none',
            formula: '1',
          },
          {
            id: 'id-hp',
            name: 'Health',
            abbreviation: 'HEA',
            description: '',
            order: 0,
            countsTowardTotal: true,
            isResource: false,
            rounding: 'none',
            formula: 'stats.bonus_divider * 2',
          },
        ],
      });

      // The stat reference belongs to the stat, not the constant
      expect(findReferences({ kind: 'constant', id: 'id-div' }, config, [])).toEqual([]);
      expect(holders(findReferences({ kind: 'stat', id: 'id-slug' }, config, []))).toEqual([
        'Stat: Health',
      ]);
    });

    it('reports nothing for a constant nothing names', () => {
      const config = withConstant();
      config.stats = [];

      expect(findReferences({ kind: 'constant', id: 'id-div' }, config, [])).toEqual([]);
    });

    it('finds a constant named only from a curve generator (TICKET-CRV-02)', () => {
      // A generator is user-authored formula text, so it guards a delete like any other formula
      const config = withConstant();
      config.stats = [];
      config.curves = [
        {
          id: 'id-xp',
          name: 'xp_thresholds',
          displayName: 'XP thresholds',
          description: '',
          keyName: 'level',
          columns: [{ id: 'col-xp', name: 'xp_required', generator: 'key * const.bonus_divider' }],
          rows: [{ key: 1, values: [0] }],
          interpolation: 'step',
          outOfRange: 'clamp',
          lookupDirection: 'forward',
        },
      ];

      const references = findReferences({ kind: 'constant', id: 'id-div' }, config, []);

      expect(holders(references)).toEqual(['Curve Column: XP thresholds · xp_required']);
      expect(references[0].field).toBe('generator');
    });
  });

  describe('curve columns (TICKET-CRV-03)', () => {
    /** A two-column curve, one column read by a stat formula */
    const withColumns = () =>
      createConfig({
        curves: [
          {
            id: 'id-pb',
            name: 'point_buy',
            displayName: 'Point buy',
            description: '',
            keyName: 'points',
            columns: [
              { id: 'col-non', name: 'non' },
              { id: 'col-main', name: 'main' },
            ],
            rows: [{ key: 0, values: [0, 0.75] }],
            interpolation: 'step',
            outOfRange: 'error',
            lookupDirection: 'forward',
          },
        ],
        stats: [
          {
            id: 'id-gain',
            name: 'Gain',
            abbreviation: 'GAI',
            description: '',
            order: 0,
            countsTowardTotal: true,
            isResource: false,
            rounding: 'none',
            formula: 'curve.point_buy.main(1)',
          },
        ],
      });

    it('finds the formula reading a column, and only that column', () => {
      const config = withColumns();

      expect(holders(findReferences({ kind: 'curve-column', id: 'col-main' }, config, []))).toEqual(
        ['Stat: Gain']
      );
      expect(findReferences({ kind: 'curve-column', id: 'col-non' }, config, [])).toEqual([]);
    });

    it('counts an unqualified call against a single-column curve’s only column', () => {
      // `curve.xp(x)` reads that column — removing it would break the call just the same
      const config = createConfig({
        curves: [
          {
            id: 'id-xp',
            name: 'xp',
            displayName: 'XP',
            description: '',
            keyName: 'level',
            columns: [{ id: 'col-only', name: 'xp_required' }],
            rows: [{ key: 1, values: [0] }],
            interpolation: 'step',
            outOfRange: 'clamp',
            lookupDirection: 'forward',
          },
        ],
        stats: [
          {
            id: 'id-lvl',
            name: 'Level',
            abbreviation: 'LEV',
            description: '',
            order: 0,
            countsTowardTotal: true,
            isResource: false,
            rounding: 'none',
            formula: 'curve.xp(1)',
          },
        ],
      });

      expect(holders(findReferences({ kind: 'curve-column', id: 'col-only' }, config, []))).toEqual(
        ['Stat: Level']
      );
    });

    it('reports nothing for a column id no curve has', () => {
      expect(findReferences({ kind: 'curve-column', id: 'gone' }, withColumns(), [])).toEqual([]);
    });
  });
});
