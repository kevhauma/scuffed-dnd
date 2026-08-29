/**
 * Equipment Bonus Calculator Tests
 *
 * Two terms over one walk. The **stat** term is what an equipped thing is *made of* — a material
 * tier's rows plus an inlay tier's, keyed by stat id since TICKET-MAT-02 — and the **skill** term is
 * what it *is*, the template's own vector (v4 systems/11, TICKET-ITEM-01). Since TICKET-INV-05 both
 * read the character's **composed items**: a slot holds a `ComposedItem.id`, and that record links
 * the template, the material tier and the optional inlay tier the numbers come from.
 *
 * The fixtures were rewritten flat when the composition landed. Each stat-side case used to declare
 * a whole `Character` and a whole `Configuration` inline — seventy lines of boilerplate around two
 * lines of arithmetic, ten times over — which made the reshape's diff unreadable and hid what each
 * case was actually about. The builders below say the same thing in one line each.
 */

import { describe, expect, it } from 'vitest';
import type { Character, ComposedItem } from '../../types/character';
import type {
  Configuration,
  EquipmentSlot,
  Inlay,
  Item,
  Material,
  Skill,
  SkillModifier,
  Stat,
  StatModifier,
} from '../../types/config';
import {
  calculateEquipmentBonuses,
  calculateEquipmentSkillBonuses,
  indexStatModifiers,
} from './equipmentBonusCalculator';

/**
 * The stats a material or inlay tier can target here
 *
 * The aggregate is keyed by stat **id** end to end since TICKET-MAT-02; ids and abbreviations agree
 * in this fixture only so the numbers stay readable. `MANA` is here for the sheet's own asymmetry:
 * the workbook's material table has no Mana column and its inlay table does, so it is the stat that
 * proves a gem is the only thing granting it.
 */
const STATS: Stat[] = ['STR', 'DEF', 'DEX', 'MANA'].map((abbreviation, order) => ({
  id: abbreviation,
  name: abbreviation,
  abbreviation,
  description: '',
  order,
  countsTowardTotal: true,
  isResource: false,
  rounding: 'none',
}));

/**
 * The slots these fixtures wear things in
 *
 * **Every fixture declares them, and before TICKET-ITEM-01 none did.** They said
 * `equipmentSlots: []` while handing the character `equippedItems: { helmet: 'item1' }` — a ruleset
 * with no slots and a character wearing something in one, which the app cannot produce and which
 * only passed because the calculator walked the record's own values. Both equipment terms read the
 * ruleset's slot list now, so the fixtures describe a ruleset that could exist.
 */
const SLOTS: EquipmentSlot[] = ['helmet', 'chest', 'gloves', 'boots'].map((type) => ({
  type,
  name: type,
  description: '',
}));

/** A ruleset, with only the collections a case actually cares about spelled out */
function createConfig(overrides: Partial<Configuration> = {}): Configuration {
  return {
    id: 'config1',
    name: 'Test Config',
    version: '1.0',
    schemaVersion: 10,
    stats: STATS,
    skills: [],
    materials: [],
    materialCategories: [],
    items: [],
    equipmentSlots: SLOTS,
    races: [],
    currencyTiers: [],
    createdAt: '2024-01-01',
    updatedAt: '2024-01-01',
    ...overrides,
  };
}

/** A character wearing the given builds, carrying nothing */
function createCharacter(
  equippedItems: Record<string, string>,
  composedItems: ComposedItem[]
): Character {
  return {
    id: '1',
    name: 'Test Character',
    configurationId: 'config1',
    raceIds: [],
    investedStatPoints: {},
    investedSkillPoints: {},
    currentResourceValues: {},
    experience: 0,
    inventory: { equippedItems, composedItems },
    createdAt: '2024-01-01',
    updatedAt: '2024-01-01',
  };
}

/** A one-tier material family */
function material(id: string, bonuses: StatModifier[], level = 1): Material {
  return {
    id,
    name: id,
    description: '',
    categoryId: 'metals',
    levels: [{ level, name: `${id} ${level}`, bonuses, value: { tierId: 'gold', amount: 10 } }],
  };
}

/** A one-tier gem family */
function inlay(id: string, bonuses: StatModifier[], tier = 1): Inlay {
  return { id, name: id, description: '', tiers: [{ tier, bonuses }] };
}

/** A template, worn in `slot` when it declares one */
function template(id: string, slot?: string, skillBonuses?: SkillModifier[]): Item {
  return {
    id,
    name: id,
    description: '',
    ...(slot === undefined ? {} : { equipmentSlotType: slot }),
    ...(skillBonuses === undefined ? {} : { skillBonuses }),
  };
}

describe('calculateEquipmentBonuses', () => {
  it('should return empty array when no items equipped', () => {
    const character = createCharacter({}, []);
    const config = createConfig();

    const result = calculateEquipmentBonuses(character, config);

    expect(result).toEqual([]);
  });

  it('should return empty array when the equipped build names no material and no inlay', () => {
    const character = createCharacter({ helmet: 'build1' }, [
      { id: 'build1', templateId: 'item1' },
    ]);
    const config = createConfig({ items: [template('item1', 'helmet')] });

    const result = calculateEquipmentBonuses(character, config);

    expect(result).toEqual([]);
  });

  it('should collect bonuses from a single equipped build', () => {
    const character = createCharacter({ helmet: 'build1' }, [
      { id: 'build1', templateId: 'item1', materialId: 'mat1', materialLevel: 1 },
    ]);
    const config = createConfig({
      items: [template('item1', 'helmet')],
      materials: [
        material('mat1', [
          { statId: 'STR', modifier: 2 },
          { statId: 'DEF', modifier: 3 },
        ]),
      ],
    });

    const result = calculateEquipmentBonuses(character, config);

    expect(result).toHaveLength(2);
    expect(result).toContainEqual({ statId: 'STR', modifier: 2 });
    expect(result).toContainEqual({ statId: 'DEF', modifier: 3 });
  });

  it('should combine bonuses from multiple equipped builds additively', () => {
    const character = createCharacter({ helmet: 'build1', chest: 'build2' }, [
      { id: 'build1', templateId: 'item1', materialId: 'mat1', materialLevel: 1 },
      { id: 'build2', templateId: 'item2', materialId: 'mat2', materialLevel: 1 },
    ]);
    const config = createConfig({
      items: [template('item1', 'helmet'), template('item2', 'chest')],
      materials: [
        material('mat1', [
          { statId: 'STR', modifier: 2 },
          { statId: 'DEF', modifier: 3 },
        ]),
        material('mat2', [
          { statId: 'STR', modifier: 1 },
          { statId: 'DEF', modifier: 5 },
        ]),
      ],
    });

    const result = calculateEquipmentBonuses(character, config);

    expect(result).toHaveLength(2);
    expect(result).toContainEqual({ statId: 'STR', modifier: 3 }); // 2 + 1
    expect(result).toContainEqual({ statId: 'DEF', modifier: 8 }); // 3 + 5
  });

  it('should read each build at the tier it names, from one family', () => {
    const character = createCharacter({ helmet: 'build1', chest: 'build2' }, [
      { id: 'build1', templateId: 'item1', materialId: 'mat1', materialLevel: 1 },
      { id: 'build2', templateId: 'item2', materialId: 'mat1', materialLevel: 2 },
    ]);
    const iron = material('mat1', [{ statId: 'STR', modifier: 2 }]);
    iron.levels.push({
      level: 2,
      name: 'Refined Iron',
      bonuses: [{ statId: 'STR', modifier: 4 }],
      value: { tierId: 'gold', amount: 20 },
    });

    const config = createConfig({
      items: [template('item1', 'helmet'), template('item2', 'chest')],
      materials: [iron],
    });

    const result = calculateEquipmentBonuses(character, config);

    expect(result).toEqual([{ statId: 'STR', modifier: 6 }]);
  });

  it('should handle negative modifiers (penalties)', () => {
    const character = createCharacter({ helmet: 'build1' }, [
      { id: 'build1', templateId: 'item1', materialId: 'mat1', materialLevel: 1 },
    ]);
    const config = createConfig({
      items: [template('item1', 'helmet')],
      materials: [
        material('mat1', [
          { statId: 'DEF', modifier: 5 },
          { statId: 'DEX', modifier: -2 },
        ]),
      ],
    });

    const result = calculateEquipmentBonuses(character, config);

    expect(result).toHaveLength(2);
    expect(result).toContainEqual({ statId: 'DEF', modifier: 5 });
    expect(result).toContainEqual({ statId: 'DEX', modifier: -2 });
  });

  it('should ignore a slot naming a build the character does not have', () => {
    const character = createCharacter({ helmet: 'nonexistent-build' }, []);
    const config = createConfig();

    const result = calculateEquipmentBonuses(character, config);

    expect(result).toEqual([]);
  });

  it('should ignore a build whose template the ruleset has not got', () => {
    const character = createCharacter({ helmet: 'build1' }, [
      { id: 'build1', templateId: 'ghost', materialId: 'mat1', materialLevel: 1 },
    ]);
    const iron = material('mat1', [{ statId: 'STR', modifier: 2 }]);
    const config = createConfig({ materials: [iron] });

    const result = calculateEquipmentBonuses(character, config);

    expect(result).toEqual([]);
  });

  it('should ignore a build whose material the ruleset has not got', () => {
    const character = createCharacter({ helmet: 'build1' }, [
      { id: 'build1', templateId: 'item1', materialId: 'nonexistent-material', materialLevel: 1 },
    ]);
    const config = createConfig({ items: [template('item1', 'helmet')] });

    const result = calculateEquipmentBonuses(character, config);

    expect(result).toEqual([]);
  });

  it('should ignore a build naming a material tier that does not exist', () => {
    const character = createCharacter({ helmet: 'build1' }, [
      { id: 'build1', templateId: 'item1', materialId: 'mat1', materialLevel: 99 },
    ]);
    const iron = material('mat1', [{ statId: 'STR', modifier: 2 }]);
    const config = createConfig({ items: [template('item1', 'helmet')], materials: [iron] });

    const result = calculateEquipmentBonuses(character, config);

    expect(result).toEqual([]);
  });

  it('should handle a full kit with overlapping bonuses', () => {
    const character = createCharacter({ helmet: 'b1', chest: 'b2', gloves: 'b3', boots: 'b4' }, [
      { id: 'b1', templateId: 'item1', materialId: 'mat1', materialLevel: 1 },
      { id: 'b2', templateId: 'item2', materialId: 'mat1', materialLevel: 1 },
      { id: 'b3', templateId: 'item3', materialId: 'mat2', materialLevel: 1 },
      { id: 'b4', templateId: 'item4', materialId: 'mat2', materialLevel: 1 },
    ]);
    const config = createConfig({
      items: [
        template('item1', 'helmet'),
        template('item2', 'chest'),
        template('item3', 'gloves'),
        template('item4', 'boots'),
      ],
      materials: [
        material('mat1', [
          { statId: 'STR', modifier: 2 },
          { statId: 'DEF', modifier: 3 },
        ]),
        material('mat2', [
          { statId: 'DEX', modifier: 3 },
          { statId: 'DEF', modifier: 1 },
        ]),
      ],
    });

    const result = calculateEquipmentBonuses(character, config);

    expect(result).toHaveLength(3);
    expect(result).toContainEqual({ statId: 'STR', modifier: 4 }); // 2 + 2
    expect(result).toContainEqual({ statId: 'DEF', modifier: 8 }); // 3 + 3 + 1 + 1
    expect(result).toContainEqual({ statId: 'DEX', modifier: 6 }); // 3 + 3
  });
});

/**
 * The inlay half of the stat term (v4 systems/12, TICKET-INV-05)
 *
 * A build is a triple, and the third column is the one v1.0 had nowhere to put. These cases pin what
 * a gem adds, what an empty socket does not, and — the sheet's own asymmetry — that Mana reaches a
 * character through a gem and through nothing else the workbook ships.
 */
describe('the inlay term', () => {
  /** Iron 1 helmet, socketed with whatever the case names */
  function wearing(build: Partial<ComposedItem>) {
    const character = createCharacter({ helmet: 'build1' }, [
      { id: 'build1', templateId: 'item1', materialId: 'mat1', materialLevel: 1, ...build },
    ]);
    const iron = material('mat1', [{ statId: 'STR', modifier: 2 }]);
    const diamond = inlay('diamond', [
      { statId: 'STR', modifier: 4 },
      { statId: 'MANA', modifier: 50 },
    ]);
    const config = createConfig({
      items: [template('item1', 'helmet')],
      materials: [iron],
      inlays: [diamond],
    });

    return calculateEquipmentBonuses(character, config);
  }

  it('should add the material row and the inlay row together', () => {
    const result = wearing({ inlayId: 'diamond', inlayLevel: 1 });

    expect(result).toHaveLength(2);
    expect(result).toContainEqual({ statId: 'STR', modifier: 6 }); // material 2 + gem 4
    expect(result).toContainEqual({ statId: 'MANA', modifier: 50 });
  });

  it('should contribute the material row alone for the sheet’s "with empty inlay"', () => {
    // `inlayId` absent is legal and is what most of the sheet's own gear rows say
    const emptySocket = wearing({});

    expect(emptySocket).toEqual([{ statId: 'STR', modifier: 2 }]);
  });

  it('should grant Mana only through the gem — the material table has no such column', () => {
    const withGem = wearing({ inlayId: 'diamond', inlayLevel: 1 });
    const withoutGem = wearing({});

    expect(withGem.some((bonus) => bonus.statId === 'MANA')).toBe(true);
    expect(withoutGem.some((bonus) => bonus.statId === 'MANA')).toBe(false);
  });

  it('should grant nothing for a gem family the ruleset has not got', () => {
    const danglingFamily = wearing({ inlayId: 'ghost', inlayLevel: 1 });

    expect(danglingFamily).toEqual([{ statId: 'STR', modifier: 2 }]);
  });

  it('should grant nothing for a rung the family skips — the sheet’s Zircon 10 (TICKET-INL-01)', () => {
    // A gap in the ladder is the sheet's own data rather than a defect, so an `inlayLevel` naming
    // one resolves to nothing and the build keeps its material row. Telling the Player their gem has
    // no such tier is TICKET-INV-06's picker refusal.
    const absentRung = wearing({ inlayId: 'diamond', inlayLevel: 10 });

    expect(absentRung).toEqual([{ statId: 'STR', modifier: 2 }]);
  });

  it('should find a rung by its number rather than by its position in the array', () => {
    // `Inlay.tiers` is stored in **insertion order** (TICKET-INL-01), so a family holding 9 then 1
    // would hand an index-based lookup the wrong row
    const outOfOrder: Inlay = {
      id: 'zircon',
      name: 'zircon',
      description: '',
      tiers: [
        { tier: 9, bonuses: [{ statId: 'DEF', modifier: 90 }] },
        { tier: 1, bonuses: [{ statId: 'DEF', modifier: 10 }] },
      ],
    };

    const character = createCharacter({ helmet: 'build1' }, [
      { id: 'build1', templateId: 'item1', inlayId: 'zircon', inlayLevel: 1 },
    ]);
    const config = createConfig({ items: [template('item1', 'helmet')], inlays: [outOfOrder] });

    const result = calculateEquipmentBonuses(character, config);

    expect(result).toEqual([{ statId: 'DEF', modifier: 10 }]);
  });
});

/**
 * Nothing is stored, so retuning a part moves every build made of it (TICKET-INV-05)
 *
 * The whole argument for the record holding references rather than numbers, asserted rather than
 * asserted-in-a-comment: the same character, read against two rulesets that differ only in a tier
 * row, comes out at two different numbers.
 */
describe('retuning a part', () => {
  const character = createCharacter({ helmet: 'b1', chest: 'b2' }, [
    { id: 'b1', templateId: 'item1', materialId: 'mat1', materialLevel: 1 },
    { id: 'b2', templateId: 'item2', materialId: 'mat1', materialLevel: 1 },
  ]);

  function ruleset(ironStrength: number): Configuration {
    const iron = material('mat1', [{ statId: 'STR', modifier: ironStrength }]);

    return createConfig({
      items: [template('item1', 'helmet'), template('item2', 'chest')],
      materials: [iron],
    });
  }

  it('should move every build made of it, on the next read', () => {
    const weakIron = ruleset(2);
    const retuned = ruleset(5);

    const before = calculateEquipmentBonuses(character, weakIron);
    const after = calculateEquipmentBonuses(character, retuned);

    expect(before).toEqual([{ statId: 'STR', modifier: 4 }]);
    expect(after).toEqual([{ statId: 'STR', modifier: 10 }]);
  });
});

describe('a tier modifier naming a stat the ruleset no longer defines (TICKET-MAT-01)', () => {
  it('should contribute nothing rather than inventing a target', () => {
    // The converse of the seeding invariant: the ruleset alone decides what exists, so a dangling
    // `statId` drops out of the aggregate instead of arriving as an `undefined` key
    const character = createCharacter({ helmet: 'build1' }, [
      { id: 'build1', templateId: 'item1', materialId: 'mat1', materialLevel: 1 },
    ]);
    const iron = material('mat1', [
      { statId: 'STR', modifier: 2 },
      { statId: 'deleted-stat', modifier: 99 },
    ]);
    const config = createConfig({ items: [template('item1', 'helmet')], materials: [iron] });

    const result = calculateEquipmentBonuses(character, config);

    expect(result).toEqual([{ statId: 'STR', modifier: 2 }]);
  });
});

describe('an item worn in a slot the ruleset no longer has (TICKET-ITEM-01)', () => {
  it('should grant nothing on the stat axis either, so no item is ever half-counted', () => {
    // **This state is reachable today.** `deleteEquipmentSlot` is a guarded delete, and
    // `useGuardedDelete` offers a "Delete anyway" button that re-runs it with `force: true` — so a
    // character can be left wearing something in a slot the ruleset has dropped. While the stat term
    // walked `Object.values(equippedItems)` and the skill term walked `config.equipmentSlots`, that
    // one sword granted its material's `STR +2` and none of its skill vector, on one sheet.
    const character = createCharacter({ retired: 'build1' }, [
      { id: 'build1', templateId: 'item1', materialId: 'mat1', materialLevel: 1 },
    ]);
    const iron = material('mat1', [{ statId: 'STR', modifier: 2 }]);
    const config = createConfig({ items: [template('item1', 'retired')], materials: [iron] });

    const result = calculateEquipmentBonuses(character, config);

    expect(result).toEqual([]);
  });
});

describe('indexStatModifiers', () => {
  it('should index a modifier by its stat id', () => {
    const indexed = indexStatModifiers([{ statId: 'STR', modifier: 2 }]);

    expect(indexed).toEqual({ STR: 2 });
  });

  it('should combine repeated stats additively', () => {
    const indexed = indexStatModifiers([
      { statId: 'STR', modifier: 2 },
      { statId: 'DEX', modifier: -1 },
      { statId: 'STR', modifier: 3 },
    ]);

    expect(indexed).toEqual({ STR: 5, DEX: -1 });
  });

  it('should return an empty record for no modifiers', () => {
    const indexed = indexStatModifiers([]);

    expect(indexed).toEqual({});
  });
});

/**
 * The item matrix's half: what an equipped **template** does to the character's skills
 *
 * The stat side above comes from what a build is *made of*; this comes from what it *is* (v4
 * systems/11, TICKET-ITEM-01). The fixtures are deliberately compact and slot-driven, because the
 * one property under test besides the arithmetic is that **nothing here knows how many slots a
 * ruleset has** (TICKET-INV-04).
 */
describe('calculateEquipmentSkillBonuses', () => {
  const SKILLS: Skill[] = ['athletics', 'sneaking', 'intimidation'].map((id) => ({
    id,
    name: id,
    description: '',
    statWeights: [],
  }));

  /**
   * A ruleset with `slotCount` slots named `slot_0`, `slot_1`, … and the given templates
   *
   * @param items - The templates the ruleset defines
   * @param slotCount - How many equipment slots it has — one, six and twelve are all ordinary
   * @returns The configuration
   */
  function skillConfig(items: Item[], slotCount: number): Configuration {
    const equipmentSlots: EquipmentSlot[] = Array.from({ length: slotCount }, (_, index) => ({
      type: `slot_${index}`,
      name: `Slot ${index}`,
      description: '',
    }));

    return createConfig({ skills: SKILLS, items, equipmentSlots });
  }

  /**
   * A character wearing one build per named slot, each built from the template of the same name
   *
   * The ids are derived rather than passed so a case reads as *wearing the axe in slot 0* — which is
   * what it is about — with the build layer the reshape introduced kept out of the way.
   *
   * @param equippedItems - Slot type to **template** id
   * @returns The character, holding one build per entry
   */
  function wielder(equippedItems: Record<string, string>): Character {
    const entries = Object.entries(equippedItems);
    const slots = Object.fromEntries(entries.map(([slot, id]) => [slot, `build-${id}`]));
    const builds = entries.map(([, id]) => ({ id: `build-${id}`, templateId: id }));

    return createCharacter(slots, builds);
  }

  it('should read an equipped templates vector, positives and negatives alike', () => {
    const battleaxe = template('battleaxe', undefined, [
      { skillId: 'athletics', modifier: 2 },
      { skillId: 'intimidation', modifier: 3 },
      { skillId: 'sneaking', modifier: -1 },
    ]);
    const config = skillConfig([battleaxe], 1);
    const armed = wielder({ slot_0: 'battleaxe' });

    const bonuses = calculateEquipmentSkillBonuses(armed, config);

    expect(bonuses).toEqual({ athletics: 2, intimidation: 3, sneaking: -1 });
  });

  it('should read nothing off a template the character is not wearing', () => {
    const battleaxe = template('battleaxe', undefined, [{ skillId: 'athletics', modifier: 2 }]);
    const config = skillConfig([battleaxe], 1);
    const emptyHanded = wielder({});

    const bonuses = calculateEquipmentSkillBonuses(emptyHanded, config);

    expect(bonuses).toEqual({});
  });

  it('should sum across a one-slot ruleset and a twelve-slot one alike (TICKET-INV-04)', () => {
    const axe = template('axe', undefined, [{ skillId: 'athletics', modifier: 2 }]);
    const boots = template('boots', undefined, [
      { skillId: 'athletics', modifier: 1 },
      { skillId: 'sneaking', modifier: -3 },
    ]);

    const narrowRuleset = skillConfig([axe, boots], 1);
    const wideRuleset = skillConfig([axe, boots], 12);
    const armed = wielder({ slot_0: 'axe' });
    const kitted = wielder({ slot_0: 'axe', slot_11: 'boots' });

    const oneSlot = calculateEquipmentSkillBonuses(armed, narrowRuleset);
    const twelveSlots = calculateEquipmentSkillBonuses(kitted, wideRuleset);

    // The count is the ruleset's; the arithmetic is the same either way
    expect(oneSlot).toEqual({ athletics: 2 });
    expect(twelveSlots).toEqual({ athletics: 3, sneaking: -3 });
  });

  it('should let a negative row cancel a positive one to nothing', () => {
    const blessed = template('blessed', undefined, [{ skillId: 'sneaking', modifier: 2 }]);
    const cursed = template('cursed', undefined, [{ skillId: 'sneaking', modifier: -2 }]);
    const config = skillConfig([blessed, cursed], 2);
    const wearingBoth = wielder({ slot_0: 'blessed', slot_1: 'cursed' });

    const bonuses = calculateEquipmentSkillBonuses(wearingBoth, config);

    // Present at zero rather than absent: two templates really did name it, and the sum is 0
    expect(bonuses).toEqual({ sneaking: 0 });
  });

  it('should read nothing off a template with no vector at all', () => {
    const plain = template('plain');
    const config = skillConfig([plain], 1);
    const armed = wielder({ slot_0: 'plain' });

    const bonuses = calculateEquipmentSkillBonuses(armed, config);

    expect(bonuses).toEqual({});
  });

  it('should drop a bonus naming a skill the ruleset no longer defines', () => {
    const relic = template('relic', undefined, [
      { skillId: 'athletics', modifier: 2 },
      { skillId: 'gone', modifier: 99 },
    ]);
    const config = skillConfig([relic], 1);
    const armed = wielder({ slot_0: 'relic' });

    const bonuses = calculateEquipmentSkillBonuses(armed, config);

    expect(bonuses).toEqual({ athletics: 2 });
  });

  it('should read nothing off a slot holding a build the ruleset has no template for', () => {
    const config = skillConfig([], 1);
    const wearingAGhost = wielder({ slot_0: 'ghost' });

    const bonuses = calculateEquipmentSkillBonuses(wearingAGhost, config);

    expect(bonuses).toEqual({});
  });

  it('should ignore an entry keyed to a slot the ruleset has since deleted', () => {
    const axe = template('axe', undefined, [{ skillId: 'athletics', modifier: 2 }]);
    // One slot, and the character is wearing the axe in a second one that no longer exists
    const config = skillConfig([axe], 1);
    const wearingARetiredSlot = wielder({ retired: 'axe' });

    const bonuses = calculateEquipmentSkillBonuses(wearingARetiredSlot, config);

    expect(bonuses).toEqual({});
  });

  it('should read the template’s vector whatever the build is made of', () => {
    // Every Battleaxe helps with Athletics, iron or mithril: the vector belongs to the shape rather
    // than to the tier, which is the split TICKET-INV-05 made explicit
    const axe = template('axe', 'helmet', [{ skillId: 'athletics', modifier: 2 }]);
    const mithril = material('mat1', [{ statId: 'STR', modifier: 2 }]);
    const config = createConfig({ skills: SKILLS, items: [axe], materials: [mithril] });

    const forged = createCharacter({ helmet: 'b1' }, [
      { id: 'b1', templateId: 'axe', materialId: 'mat1', materialLevel: 1 },
    ]);
    const bare = createCharacter({ helmet: 'b1' }, [{ id: 'b1', templateId: 'axe' }]);

    const withMetal = calculateEquipmentSkillBonuses(forged, config);
    const withNone = calculateEquipmentSkillBonuses(bare, config);

    expect(withMetal).toEqual({ athletics: 2 });
    expect(withNone).toEqual({ athletics: 2 });
  });
});
