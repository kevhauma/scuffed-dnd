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
    schemaVersion: 10,
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
    inlays: [
      {
        id: 'diamond',
        name: 'Diamond',
        description: '',
        tiers: [{ tier: 1, bonuses: [{ statId: 'id-str', modifier: 4 }] }],
      },
    ],
    items: [
      {
        id: 'axe',
        name: 'Axe',
        description: '',
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

/** One compendium entry, shared by the spell cases so they cannot drift apart */
const SPELL = {
  id: 'acid-splash',
  name: 'Acid Splash',
  manaCost: 90,
  rangeTime: '60f',
  effectTemplate: '',
};

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
    // One build — an Iron 1 Axe with a Diamond 1 inlay — worn in the one slot. All three guarded
    // deletes this file exercises reach the character through it (TICKET-INV-05).
    inventory: {
      equippedItems: { main_hand: 'build-axe' },
      composedItems: [
        {
          id: 'build-axe',
          templateId: 'axe',
          materialId: 'iron',
          materialLevel: 1,
          inlayId: 'diamond',
          inlayLevel: 1,
        },
      ],
    },
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
        'Inlay: Diamond',
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

    it('finds a character who made the skill a focus pick (TICKET-SKL-05)', () => {
      // A stale focus id is worse than a dangling race id: `focusPickRefusal` refuses the whole
      // list, so the sheet's picker — which resends every stored pick — fails on a slot the Player
      // did not touch. The delete has to be guarded, not merely survivable.
      const focused = createCharacter({ investedSkillPoints: {}, focusSkillIds: ['id-stl'] });

      const found = findReferences({ kind: 'skill', id: 'id-stl' }, createConfig(), [focused]);

      expect(holders(found)).toContain('Character: Aria');
      expect(found.some((reference) => reference.field === 'focus skills')).toBe(true);
    });

    it('finds an item template whose vector grants the skill (TICKET-ITEM-01)', () => {
      // config→config, and the one arm the walker gained with the item matrix: without it a User
      // deletes Athletics and every Battleaxe in the catalog silently grants nothing
      const config = createConfig({
        items: [
          {
            id: 'battleaxe',
            name: 'Battleaxe',
            description: '',
            skillBonuses: [{ skillId: 'id-stl', modifier: -1 }],
          },
        ],
      });

      const found = findReferences({ kind: 'skill', id: 'id-stl' }, config, []);

      expect(holders(found)).toContain('Item: Battleaxe');
      expect(found.some((reference) => reference.field === 'skillBonuses')).toBe(true);
    });

    it('reports a template once however many of its rows name the skill', () => {
      const config = createConfig({
        items: [
          {
            id: 'battleaxe',
            name: 'Battleaxe',
            description: '',
            skillBonuses: [
              { skillId: 'id-stl', modifier: 2 },
              { skillId: 'id-stl', modifier: -1 },
            ],
          },
        ],
      });

      const found = findReferences({ kind: 'skill', id: 'id-stl' }, config, []);
      const templates = found.filter((reference) => reference.holderKind === 'Item');

      expect(templates).toHaveLength(1);
    });

    it('does not count a template whose vector names some other skill', () => {
      const config = createConfig({
        items: [
          {
            id: 'battleaxe',
            name: 'Battleaxe',
            description: '',
            skillBonuses: [{ skillId: 'id-other', modifier: 2 }],
          },
        ],
      });

      const found = findReferences({ kind: 'skill', id: 'id-stl' }, config, []);

      expect(holders(found)).not.toContain('Item: Battleaxe');
    });

    it('does not count a template with no vector at all', () => {
      // Every template in the corpus, which this ticket leaves untouched (v4 D7)
      const found = findReferences({ kind: 'skill', id: 'id-stl' }, createConfig(), []);

      expect(holders(found)).not.toContain('Item: Axe');
    });

    it('does not count a character who focuses some other skill', () => {
      const elsewhere = createCharacter({ investedSkillPoints: {}, focusSkillIds: ['id-other'] });

      const found = findReferences({ kind: 'skill', id: 'id-stl' }, createConfig(), [elsewhere]);

      expect(holders(found)).not.toContain('Character: Aria');
    });

    it('reports a character who both invested in a skill and focused it once per field', () => {
      // Two different reasons the delete is unsafe, and a User deciding whether to force it wants
      // both — the same list would be wrong to de-duplicate by holder
      const both = createCharacter({
        investedSkillPoints: { 'id-stl': 2 },
        focusSkillIds: ['id-stl', 'id-stl'],
      });

      const found = findReferences({ kind: 'skill', id: 'id-stl' }, createConfig(), [both]);
      const fields = found.map((reference) => reference.field);

      expect(fields).toContain('invested skill points');
      expect(fields).toContain('focus skills');
      // Once per field, not once per slot: two slots naming one skill are one reason
      expect(fields.filter((field) => field === 'focus skills')).toHaveLength(1);
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
        inlays: [],
      });

      // The base fixture has five other referrers to Strength, so the claim is about the *spell*
      expect(holders(findReferences({ kind: 'stat', id: 'id-str' }, config, []))).not.toContain(
        'Spell: Acid Splash'
      );
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

    it('finds an inlay family whose tier grants the stat (TICKET-INL-01)', () => {
      const config = createConfig({
        inlays: [
          {
            id: 'zircon',
            name: 'Zircon',
            description: '',
            tiers: [
              { tier: 1, bonuses: [{ statId: 'id-dex', modifier: 1 }] },
              { tier: 9, bonuses: [{ statId: 'id-dex', modifier: 9 }] },
            ],
          },
        ],
      });

      const found = findReferences({ kind: 'stat', id: 'id-dex' }, config, []);
      const inlay = found.find((reference) => reference.holderKind === 'Inlay');

      // One reference for the family however many of its tiers name the stat — the dialog says
      // *which gem*, and nine rows of Zircon would say it nine times
      expect(inlay?.holderName).toBe('Zircon');
      expect(inlay?.field).toBe('tiers[].bonuses');
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

  it('finds nothing pointing at an inlay yet, which is the kind existing early (TICKET-INL-01)', () => {
    // The `dice-ladder` situation before TICKET-ROLL-05: the socket that names a family is
    // TICKET-INV-05's, so the guard has no possible referrer and always lets the delete through.
    // The kind is here so the panel wires the same guarded surface as every other one.
    const config = createConfig({
      inlays: [{ id: 'zircon', name: 'Zircon', description: '', tiers: [] }],
    });

    expect(findReferences({ kind: 'inlay', id: 'zircon' }, config, [createCharacter()])).toEqual(
      []
    );
  });

  it('finds a spell whose effect reads a stat (TICKET-SPL-03)', () => {
    // A placeholder is user-authored formula text, so a stat read only by Fireball still blocks
    // that stat's delete — the effect would otherwise chip mid-sentence in every Spellbook
    const config = createConfig({
      spells: [{ ...SPELL, effectTemplate: 'takes {stats.strength} fire damage' }],
    });

    const found = findReferences({ kind: 'stat', id: 'id-str' }, config, []);

    expect(holders(found)).toContain('Spell: Acid Splash');
  });

  it('lists a spell once however many of its placeholders name the target', () => {
    // One row per holder: *"Spell Acid Splash (effectTemplate)"* twice tells a reader nothing the
    // first row did not. A spell is the first holder that can carry more than one formula.
    const config = createConfig({
      spells: [{ ...SPELL, effectTemplate: '{stats.strength} and {stats.strength} and {STR}' }],
    });

    const found = findReferences({ kind: 'stat', id: 'id-str' }, config, []);

    expect(found.filter((reference) => reference.holderKind === 'Spell')).toHaveLength(1);
  });

  it('finds a spell whose effect reads a skill', () => {
    const config = createConfig({
      spells: [{ ...SPELL, effectTemplate: 'for {skills.stealth.level} rounds' }],
    });

    const found = findReferences({ kind: 'skill', id: 'id-stl' }, config, []);

    expect(holders(found)).toContain('Spell: Acid Splash');
  });

  it('does not block a delete on prose that merely contains a stat code', () => {
    // The other half of *the splitter never sees the sentence*: `STR` in "gains STR" is a word
    const config = createConfig({
      spells: [{ ...SPELL, effectTemplate: 'the target gains STR for an hour' }],
    });

    // The base fixture has five other referrers to Strength, so the claim is about the *spell*
    expect(holders(findReferences({ kind: 'stat', id: 'id-str' }, config, []))).not.toContain(
      'Spell: Acid Splash'
    );
  });

  it('finds a character who has learned a spell (TICKET-SPL-02)', () => {
    // The referrer SPL-01 predicted, arrived. Deleting a spell three Players have learned would
    // leave three ids naming nothing, which `spellbookOf` draws as three rows they did not ask for
    // — so the delete is refused naming the character, and forcing it is the User's own decision.
    const config = createConfig({ spells: [SPELL] });
    const caster = createCharacter({ learnedSpellIds: ['acid-splash'] });

    const found = findReferences({ kind: 'spell', id: 'acid-splash' }, config, [caster]);

    expect(holders(found)).toEqual(['Character: Aria']);
    expect(found[0]?.field).toBe('learnedSpellIds');
  });

  it('finds nothing pointing at a spell nobody has learned', () => {
    // Nothing in a *ruleset* names a spell — effect text is prose until TICKET-SPL-03 and no formula
    // can reach one — so a compendium entry no Player has switched on deletes freely
    const config = createConfig({ spells: [SPELL] });

    const found = findReferences({ kind: 'spell', id: 'acid-splash' }, config, [createCharacter()]);

    expect(found).toEqual([]);
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

  it('finds an item template through the builds made from it, equipped or loose', () => {
    // `equippedItems` holds `ComposedItem.id`s since TICKET-INV-05, so the walk is over
    // `composedItems[].templateId` and a build in the Backpack counts exactly as a worn one does
    const loose = createCharacter({
      inventory: {
        equippedItems: {},
        composedItems: [{ id: 'build-axe', templateId: 'axe' }],
      },
    });

    const equipped = findReferences({ kind: 'item', id: 'axe' }, createConfig(), [
      createCharacter(),
    ]);
    const carried = findReferences({ kind: 'item', id: 'axe' }, createConfig(), [loose]);

    expect(holders(equipped)).toEqual(['Character: Aria']);
    expect(holders(carried)).toEqual(['Character: Aria']);
    expect(equipped[0].field).toBe('inventory.composedItems[].templateId');
  });

  it('finds nothing for a template nobody has built', () => {
    const unbuilt = createConfig({
      items: [{ id: 'spare', name: 'Spare', description: '' }],
    });

    const builder = createCharacter();
    const found = findReferences({ kind: 'item', id: 'spare' }, unbuilt, [builder]);

    expect(found).toEqual([]);
  });

  it('finds a material through the character who built something out of it (TICKET-INV-05)', () => {
    // Was a walk over `config.items` until the fused pair retired: a template names no material, so
    // the holder is the Player whose axe is made of it
    const found = findReferences({ kind: 'material', id: 'iron' }, createConfig(), [
      createCharacter(),
    ]);

    expect(holders(found)).toEqual(['Character: Aria']);
    expect(found[0].field).toBe('inventory.composedItems[].materialId');
  });

  it('finds nothing for a material nobody has built with', () => {
    const found = findReferences({ kind: 'material', id: 'iron' }, createConfig(), []);

    expect(found).toEqual([]);
  });

  it('finds an inlay through the character who socketed it (TICKET-INV-05)', () => {
    // The arm TICKET-INL-01 shipped empty, filled the moment something could point at a gem.
    // `referenceArms.test.ts` is what makes leaving it empty a failure rather than a silence.
    const found = findReferences({ kind: 'inlay', id: 'diamond' }, createConfig(), [
      createCharacter(),
    ]);

    expect(holders(found)).toEqual(['Character: Aria']);
    expect(found[0].field).toBe('inventory.composedItems[].inlayId');
  });

  it('finds nothing for an inlay nobody has socketed', () => {
    const emptySocket = createCharacter({
      inventory: {
        equippedItems: { main_hand: 'build-axe' },
        composedItems: [
          { id: 'build-axe', templateId: 'axe', materialId: 'iron', materialLevel: 1 },
        ],
      },
    });

    const found = findReferences({ kind: 'inlay', id: 'diamond' }, createConfig(), [emptySocket]);

    expect(found).toEqual([]);
  });

  it('names a Player once however many builds of theirs point at the same part', () => {
    const hoarder = createCharacter({
      inventory: {
        equippedItems: { main_hand: 'build-1' },
        composedItems: [1, 2, 3].map((n) => ({
          id: `build-${n}`,
          templateId: 'axe',
          materialId: 'iron',
          materialLevel: 1,
        })),
      },
    });

    const found = findReferences({ kind: 'material', id: 'iron' }, createConfig(), [hoarder]);

    expect(found).toHaveLength(1);
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
      inlays: [],
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
