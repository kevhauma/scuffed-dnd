/**
 * The Kernel's player-action rules (TICKET-PLY-01)
 *
 * The route suite proves these hold *through a request*; this proves the two things a route cannot
 * see. **The before/after pair**, which every accepted action carries and which nothing downstream
 * of the Event log could reconstruct if it were wrong — an equip that reported `null` where a slot
 * already had something in it would make DM-01's audit read as "put a helmet on an empty head" and
 * LIVE-02's reconciliation undo the wrong thing. And **the refusals as sentences**, which are what a
 * Player actually reads.
 *
 * The fixture is deliberately small here rather than the corpus: every rule under test is about one
 * stat, one slot or one number, and a 306 KB ruleset would only make the failure messages longer.
 * The *server* suite is the one that runs against the real thing.
 *
 * **Validates: v3 Req 41.1-41.5; Requirements 12.3, 14.3, 14.4**
 */

import { describe, expect, it } from 'vitest';
import { backpackOf } from '../engine/composedItems';
import { focusPicksOf } from '../engine/focusSkills';
import type { Character, ComposedItem } from '../types/character';
import type { Configuration } from '../types/config';
import {
  adjustPurseBy,
  adjustResourceValue,
  chooseFocusSkills,
  composeBuild,
  discardBuild,
  equipToSlot,
  investInSkill,
  investInStat,
  isRefusal,
  type PlayerActionChange,
  type PlayerActionResult,
  resetResourceToMax,
  setPurseAmount,
  setResourceValue,
  unequipSlot,
} from './playerActions';

/** A ruleset with one pool, one invested stat, two skills, two slots and three items */
const RULES = {
  id: 'config-1',
  name: 'Test',
  version: '1.0',
  schemaVersion: 10,
  stats: [
    {
      id: 'stat-str',
      name: 'Strength',
      abbreviation: 'STR',
      description: '',
      order: 0,
      countsTowardTotal: true,
      isResource: false,
      rounding: 'none',
    },
    {
      id: 'stat-health',
      name: 'Health',
      abbreviation: 'HP',
      description: '',
      order: 1,
      countsTowardTotal: false,
      isResource: true,
      rounding: 'none',
      formula: 'STR * 10',
    },
  ],
  // Two of them since TICKET-RES-05: a skill spend is priced against the same pool a stat spend is,
  // so the fixture needs skills the ruleset actually defines for the sum to be a sum
  skills: [
    { id: 'skill-stealth', name: 'Stealth', description: '', statWeights: [] },
    { id: 'skill-alchemy', name: 'Alchemy', description: '', statWeights: [] },
  ],
  // One family with a **gap in its ladder** — tiers 1 and 10, nothing between — because the build
  // rule's whole job is to answer for a rung the family does not have (TICKET-INV-06)
  materials: [
    {
      id: 'mat-iron',
      name: 'Iron Ore',
      description: '',
      categoryId: 'metal',
      levels: [
        { level: 1, name: 'Pig iron', bonuses: [], value: { tierId: 'gold', amount: 1 } },
        { level: 10, name: 'Wrought', bonuses: [], value: { tierId: 'gold', amount: 10 } },
      ],
    },
  ],
  materialCategories: [{ id: 'metal', name: 'Metal', description: '' }],
  // The sheet's Zircon, whose tenth row is blank — and stored **out of rung order** on purpose, so a
  // reader that indexed the array by rung would read the wrong row (TICKET-INL-01)
  inlays: [
    {
      id: 'inlay-zircon',
      name: 'Zircon',
      description: '',
      tiers: [
        { tier: 9, bonuses: [] },
        { tier: 1, bonuses: [] },
      ],
    },
  ],
  items: [
    { id: 'item-helm', name: 'Helm', description: '', equipmentSlotType: 'head' },
    { id: 'item-circlet', name: 'Circlet', description: '', equipmentSlotType: 'head' },
    { id: 'item-rope', name: 'Rope', description: '' },
  ],
  equipmentSlots: [
    { type: 'head', name: 'Head', description: '' },
    { type: 'feet', name: 'Feet', description: '' },
  ],
  races: [],
  currencyTiers: [],
  // A budget of five, so a spend can be both affordable and unaffordable here. `points_per_level`
  // and the `xp_thresholds` curve are both required for a level to be *priceable* at all — without
  // them `validateStatAllocation` refuses every spend, which is right and is not what is under test.
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
} as unknown as Configuration;

/** A character with three points in Strength, so Health's maximum is 30 */
function aCharacter(overrides: Partial<Character> = {}): Character {
  return {
    id: 'character-1',
    name: 'Quackers',
    configurationId: 'config-1',
    raceIds: [],
    investedStatPoints: { 'stat-str': 3 },
    investedSkillPoints: {},
    currentResourceValues: { 'stat-health': 30 },
    experience: 0,
    inventory: { equippedItems: {}, composedItems: [] },
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
    ...overrides,
  };
}

/**
 * A character holding one build per template named, worn or in the bag (TICKET-INV-05/06)
 *
 * The equipment cases are about *where a thing is*, and the build layer is not what they are
 * testing — so the ids are derived (`build-item-helm`) rather than spelled out, and a case still
 * reads as *wearing the helm on the head*.
 *
 * **Carried is not a field any more**: a build that is not worn is in the Backpack by definition, so
 * the second argument only decides which builds exist without being in a slot.
 *
 * @param equippedItems - Slot type to **template** id
 * @param carried - Template ids to have built and not be wearing; a repeat is a second build
 * @returns The character, holding one build per entry
 */
function holding(equippedItems: Record<string, string>, carried: string[] = []): Character {
  const worn = Object.entries(equippedItems);
  const slots = Object.fromEntries(worn.map(([slot, id]) => [slot, `build-${id}`]));

  // A repeated template is a repeated *build*, so the bagged ids are made unique by position — which
  // is the whole difference from the id-list pack this replaced
  const builds = [
    ...worn.map(([, id]) => ({ id: `build-${id}`, templateId: id })),
    ...carried.map((id, index) => ({ id: `build-${id}-${index}`, templateId: id })),
  ];

  return aCharacter({ inventory: { equippedItems: slots, composedItems: builds } });
}

/** Everything built and not worn, as the Backpack derives it */
function bagged(character: Character): string[] {
  return backpackOf(character, RULES).map((build) => build.id);
}

/** The accepted half of a result, failing the case if it was refused */
function accepted(result: PlayerActionResult): PlayerActionChange {
  expect(isRefusal(result) ? result.refusal : null).toBeNull();

  return result as PlayerActionChange;
}

/** The sentence a refusal carried, failing the case if it was accepted */
function refusal(result: PlayerActionResult): string {
  expect(isRefusal(result)).toBe(true);

  return (result as { refusal: string }).refusal;
}

describe('investing points', () => {
  it('reports what the stat held before and what it holds now', () => {
    const change = accepted(investInStat(aCharacter(), RULES, 'stat-str', 2));

    expect(change.before).toBe(3);
    expect(change.after).toBe(2);
    expect(change.character.investedStatPoints['stat-str']).toBe(2);
  });

  it('treats a skill with nothing in it as having held zero', () => {
    const result = investInSkill(aCharacter(), RULES, 'skill-stealth', 2);
    const change = accepted(result);

    expect(change.before).toBe(0);
    expect(change.after).toBe(2);
  });

  it('refuses a fraction and a negative, in words rather than by returning nothing', () => {
    const fraction = investInStat(aCharacter(), RULES, 'stat-str', 1.5);
    const negative = investInSkill(aCharacter(), RULES, 'skill-stealth', -2);

    expect(refusal(fraction)).toContain('whole');
    expect(refusal(negative)).toContain('below 0');
  });

  it('refuses a spend the derived budget cannot pay for, naming the overspend', () => {
    // Level 1 at 0 XP, five points per level — six is one too many, and the sentence says so
    const result = investInStat(aCharacter(), RULES, 'stat-str', 6);

    expect(refusal(result)).toContain('1 point over the budget');
  });

  /**
   * One pool for both spends (TICKET-RES-05)
   *
   * The pool is 5 and Strength already holds 3 of it, so two points are left whichever box they go
   * into. These are the two orderings the acceptance criteria name.
   */
  describe('the shared pool', () => {
    it('refuses a skill spend the stat boxes have already eaten', () => {
      // stat-then-skill: 3 in Strength, then 3 into Stealth is 6 against a pool of 5
      const result = investInSkill(aCharacter(), RULES, 'skill-stealth', 3);

      expect(refusal(result)).toContain('1 point over the budget');
    });

    it('refuses a stat spend the skill boxes have already eaten', () => {
      // skill-then-stat: the same overspend reached from the other side
      const invested = aCharacter({ investedSkillPoints: { 'skill-stealth': 3 } });
      const result = investInStat(invested, RULES, 'stat-str', 3);

      expect(refusal(result)).toContain('1 point over the budget');
    });

    it('lets a spend that exactly fills the pool through, from either side', () => {
      const skillSide = investInSkill(aCharacter(), RULES, 'skill-stealth', 2);

      expect(accepted(skillSide).after).toBe(2);

      const invested = aCharacter({ investedSkillPoints: { 'skill-stealth': 2 } });
      const statSide = investInStat(invested, RULES, 'stat-str', 3);

      expect(accepted(statSide).after).toBe(3);
    });

    it('sums every skill box rather than only the one being changed', () => {
      const invested = aCharacter({ investedSkillPoints: { 'skill-alchemy': 2 } });
      const result = investInSkill(invested, RULES, 'skill-stealth', 1);

      expect(refusal(result)).toContain('1 point over the budget');
    });

    it('charges nothing for points against a skill the ruleset does not define', () => {
      // They raise the level of nothing, so charging the pool for them would take a Player's
      // budget for something no surface can show them
      const stale = aCharacter({ investedSkillPoints: { 'skill-gone': 40 } });
      const result = investInSkill(stale, RULES, 'skill-stealth', 2);

      expect(accepted(result).after).toBe(2);
    });

    it('never refuses a refund, even from a character the widened pool cannot afford', () => {
      // Every character built while skill investment was free is one of these, and a refusal that
      // also blocked the way back would leave the Player nothing to act on
      const overspent = aCharacter({ investedSkillPoints: { 'skill-stealth': 30 } });
      const skillRefund = investInSkill(overspent, RULES, 'skill-stealth', 1);
      const statRefund = investInStat(overspent, RULES, 'stat-str', 1);

      expect(accepted(skillRefund).after).toBe(1);
      expect(accepted(statRefund).after).toBe(1);
    });

    it('still refuses a raise on an already-overspent character', () => {
      const overspent = aCharacter({ investedSkillPoints: { 'skill-stealth': 30 } });
      const result = investInSkill(overspent, RULES, 'skill-stealth', 31);

      expect(refusal(result)).toContain('over the budget');
    });
  });

  it('leaves the character it was given untouched', () => {
    // The rules are pure, and a caller that persisted the *input* by mistake would still see the
    // right answer in every other case here
    const character = aCharacter();
    investInStat(character, RULES, 'stat-str', 1);

    expect(character.investedStatPoints['stat-str']).toBe(3);
  });
});

describe('choosing focus skills (TICKET-SKL-05)', () => {
  it('reports the picks before and after, joined', () => {
    const already = aCharacter({ focusSkillIds: ['skill-stealth'] });
    const picks = ['skill-stealth', 'skill-alchemy', 'skill-stealth'];

    const change = accepted(chooseFocusSkills(already, RULES, picks));

    expect(change.before).toBe('skill-stealth');
    expect(change.after).toBe('skill-stealth, skill-alchemy, skill-stealth');
    expect(change.character.focusSkillIds).toEqual(picks);
  });

  it('takes fewer than three, which is how a slot gets filled one at a time', () => {
    // The rule the sheet's picker needs: a character created before focus skills existed has none,
    // and demanding all three here would leave them no way in
    const change = accepted(chooseFocusSkills(aCharacter(), RULES, ['skill-stealth']));

    expect(change.character.focusSkillIds).toEqual(['skill-stealth']);
  });

  it('takes an empty list, and clearing removes the field rather than storing []', () => {
    // *None* has one spelling on the document — the field is not there — so a Player who gave up
    // their last focus and one who never picked any are the same character (`focusPicksField`)
    const already = aCharacter({ focusSkillIds: ['skill-stealth'] });

    const cleared = accepted(chooseFocusSkills(already, RULES, [])).character;

    expect(cleared).not.toHaveProperty('focusSkillIds');
    expect(focusPicksOf(cleared)).toEqual([]);
  });

  it('refuses a fourth pick rather than trimming it, and says so', () => {
    const four = ['skill-stealth', 'skill-stealth', 'skill-stealth', 'skill-alchemy'];

    expect(refusal(chooseFocusSkills(aCharacter(), RULES, four))).toMatch(/4 were named/);
  });

  it('refuses a skill this ruleset does not have, leaving the character untouched', () => {
    const already = aCharacter({ focusSkillIds: ['skill-stealth'] });
    const result = chooseFocusSkills(already, RULES, ['skill-stealth', 'nonesuch']);

    expect(refusal(result)).toMatch(/not a skill/i);
    expect(already.focusSkillIds).toEqual(['skill-stealth']);
  });
});

describe('the purse (TICKET-CUR-02)', () => {
  it('reports what was carried before and what is carried now', () => {
    const change = accepted(setPurseAmount(aCharacter({ purse: 40 }), 55));

    expect(change.before).toBe(40);
    expect(change.after).toBe(55);
    expect(change.character.purse).toBe(55);
  });

  it('treats a character who never had one as carrying nothing', () => {
    const change = accepted(setPurseAmount(aCharacter(), 12));

    expect(change.before).toBe(0);
  });

  it('spends by a delta, which is what buying something looks like', () => {
    expect(accepted(adjustPurseBy(aCharacter({ purse: 50 }), -12)).after).toBe(38);
    expect(accepted(adjustPurseBy(aCharacter({ purse: 50 }), 340)).after).toBe(390);
  });

  it('refuses to go below zero and names the shortfall', () => {
    // `deductExperience`'s precedent: a purchase that quietly emptied a purse instead of refusing
    // would leave a table believing it had been paid for
    expect(refusal(adjustPurseBy(aCharacter({ purse: 5 }), -12))).toContain('7 short');
    expect(refusal(setPurseAmount(aCharacter({ purse: 5 }), -1))).toContain('1 short');
  });

  it('leaves the purse alone when it refuses', () => {
    const character = aCharacter({ purse: 5 });
    adjustPurseBy(character, -12);

    expect(character.purse).toBe(5);
  });

  it('allows a fraction, because a tier rate may be one', () => {
    expect(accepted(setPurseAmount(aCharacter(), 0.5)).after).toBe(0.5);
  });

  it('refuses something that is not a number at all', () => {
    expect(refusal(setPurseAmount(aCharacter(), Number.NaN))).toContain('not an amount');
    expect(refusal(adjustPurseBy(aCharacter(), Number.POSITIVE_INFINITY))).toContain(
      'not an amount'
    );
  });
});

describe('moving a pool', () => {
  it('clamps upward and lets a value go below zero', () => {
    expect(accepted(setResourceValue(aCharacter(), RULES, 'stat-health', 900)).after).toBe(30);
    expect(accepted(setResourceValue(aCharacter(), RULES, 'stat-health', -4)).after).toBe(-4);
  });

  it('applies a delta to the stored value, not to a clamped reading of it', () => {
    const overMax = aCharacter({ currentResourceValues: { 'stat-health': 400 } });

    // 400 − 50 = 350, then clamped to 30 — never 30 − 50
    expect(accepted(adjustResourceValue(overMax, RULES, 'stat-health', -50)).after).toBe(30);
  });

  it('fills a spent pool to its maximum', () => {
    const spent = aCharacter({ currentResourceValues: { 'stat-health': 4 } });
    const change = accepted(resetResourceToMax(spent, RULES, 'stat-health'));

    expect(change.before).toBe(4);
    expect(change.after).toBe(30);
  });

  it('refuses to fill a pool whose maximum cannot be worked out', () => {
    const broken = {
      ...RULES,
      stats: RULES.stats.map((stat) =>
        stat.id === 'stat-health' ? { ...stat, formula: 'NOPE * 2' } : stat
      ),
    } as Configuration;

    // Writing 0 would be the one "reset" that empties a pool instead of filling it
    expect(refusal(resetResourceToMax(aCharacter(), broken, 'stat-health'))).toContain(
      'nothing to fill to'
    );
  });

  it('refuses a stat that is not a pool and one the ruleset does not have', () => {
    expect(refusal(setResourceValue(aCharacter(), RULES, 'stat-str', 1))).toContain('not a pool');
    expect(refusal(setResourceValue(aCharacter(), RULES, 'stat-ghost', 1))).toContain(
      'no such stat'
    );
  });
});

describe('equipment', () => {
  it('reports the slot it emptied as well as the build it filled it with', () => {
    const worn = holding({ head: 'item-helm' }, ['item-circlet']);

    const change = accepted(equipToSlot(worn, RULES, 'head', 'build-item-circlet-0'));

    expect(change.before).toBe('build-item-helm');
    expect(change.after).toBe('build-item-circlet-0');
  });

  it('reports an empty slot as null rather than as absent', () => {
    const carrying = holding({}, ['item-helm']);
    const change = accepted(equipToSlot(carrying, RULES, 'head', 'build-item-helm-0'));

    expect(change.before).toBeNull();
  });

  it('refuses a build whose template declares another slot, one that declares none, and a slot the ruleset does not define', () => {
    const packed = holding({}, ['item-helm', 'item-rope']);

    expect(refusal(equipToSlot(packed, RULES, 'feet', 'build-item-helm-0'))).toContain(
      'does not go in that slot'
    );
    expect(refusal(equipToSlot(packed, RULES, 'head', 'build-item-rope-1'))).toContain(
      'does not go in that slot'
    );
    expect(refusal(equipToSlot(packed, RULES, 'tail', 'build-item-helm-0'))).toContain(
      'no such equipment slot'
    );
  });

  it('takes the build out of the Backpack when it is put on', () => {
    // A build is one thing, so it cannot be worn and bagged at once — which an id naming a catalog
    // template legitimately could be, two of a thing being the same id twice. Nothing removes it
    // from a list: the Backpack is the complement of what is worn (TICKET-INV-06)
    const carrying = holding({}, ['item-helm']);

    const change = accepted(equipToSlot(carrying, RULES, 'head', 'build-item-helm-0'));

    expect(change.character.inventory.equippedItems.head).toBe('build-item-helm-0');
    expect(bagged(change.character)).toEqual([]);
  });

  it('wears a build in one slot at a time', () => {
    const worn = holding({ head: 'item-helm' });

    // The same build, asked for in a second slot: it moves rather than appearing in both
    const change = accepted(equipToSlot(worn, RULES, 'head', 'build-item-helm'));

    expect(Object.values(change.character.inventory.equippedItems)).toEqual(['build-item-helm']);
  });

  it('puts the build it displaces back in the Backpack rather than orphaning it', () => {
    // **The blocker this case exists for** (the INV-05 review). Equipping into an occupied slot
    // dropped the previous occupant from `equippedItems` and did nothing else — so the displaced
    // build survived in `composedItems` worn by nothing and carried by nothing: invisible to every
    // surface, and still counted by `composedItemReferences`, which made its material permanently
    // undeletable. With the bag derived there is no *nothing* for it to be in.
    const worn = holding({ head: 'item-helm' }, ['item-circlet']);

    const after = accepted(equipToSlot(worn, RULES, 'head', 'build-item-circlet-0')).character;

    expect(after.inventory.equippedItems.head).toBe('build-item-circlet-0');
    expect(bagged(after)).toEqual(['build-item-helm']);
    // Nothing was destroyed either — putting something on is not a decision to throw away what you
    // were wearing, which is the difference from `discardBuild`
    expect(after.inventory.composedItems.map((build) => build.id).sort()).toEqual([
      'build-item-circlet-0',
      'build-item-helm',
    ]);
  });

  it('leaves every build either worn or in the Backpack, and never both', () => {
    // The invariant `Inventory`'s own doc states. It is now structural rather than maintained — the
    // two sets are one partition of `composedItems` — and this is what would fail if a future action
    // reintroduced a second list to keep in step
    const worn = holding({ head: 'item-helm' }, ['item-circlet']);

    const after = accepted(equipToSlot(worn, RULES, 'head', 'build-item-circlet-0')).character;
    const placed = [...Object.values(after.inventory.equippedItems), ...bagged(after)].sort();

    expect(placed).toEqual(after.inventory.composedItems.map((build) => build.id).sort());
    expect(new Set(placed).size).toBe(placed.length);
  });

  it('refuses a build the character does not have (TICKET-INV-05)', () => {
    // New with the composed record: an id here named a catalog template, which every character could
    // equip by definition, and now it names one Player's build
    expect(refusal(equipToSlot(aCharacter(), RULES, 'head', 'build-somebody-elses'))).toContain(
      'no such item'
    );
  });

  it('refuses to empty a slot that is already empty', () => {
    expect(refusal(unequipSlot(aCharacter(), 'head'))).toContain('nothing in that slot');
  });

  it('keeps the build it takes off, where unequipping used to destroy it (TICKET-INV-06)', () => {
    // `emptySlot` destroyed and `moveItemToMisc` kept, and the two were told apart only by which
    // stored list the build landed in. Taking a helmet off is now one act with one answer, and
    // throwing it away is `discardBuild`.
    const worn = holding({ head: 'item-helm' });

    const after = accepted(unequipSlot(worn, 'head')).character;

    expect(after.inventory.equippedItems.head).toBeUndefined();
    expect(bagged(after)).toEqual(['build-item-helm']);
    expect(after.inventory.composedItems.map((build) => build.id)).toEqual(['build-item-helm']);
  });

  it('rounds a build out of the bag and back again', () => {
    // The round trip TICKET-INV-06's criteria pin, in the Kernel: equip takes the row out of the
    // Backpack, unequip puts it back, and neither touches a list to do it
    const carrying = holding({}, ['item-helm']);

    const worn = accepted(equipToSlot(carrying, RULES, 'head', 'build-item-helm-0')).character;
    const off = accepted(unequipSlot(worn, 'head')).character;

    expect(bagged(worn)).toEqual([]);
    expect(bagged(off)).toEqual(['build-item-helm-0']);
    expect(off.inventory.composedItems).toEqual(carrying.inventory.composedItems);
  });
});

describe('building a thing', () => {
  /** The picks a case is not testing, so it can name only the one it is */
  function picks(overrides: Partial<ComposedItem> = {}): ComposedItem {
    return {
      id: 'build-1',
      templateId: 'item-rope',
      materialId: 'mat-iron',
      materialLevel: 10,
      ...overrides,
    };
  }

  it('refuses a template the ruleset does not define', () => {
    expect(
      refusal(composeBuild(aCharacter(), RULES, picks({ templateId: 'item-ghost' })))
    ).toContain('no such item');
  });

  it('mints the build and leaves it in the Backpack', () => {
    const change = accepted(composeBuild(aCharacter(), RULES, picks()));

    expect(change.character.inventory.composedItems).toEqual([picks()]);
    expect(bagged(change.character)).toEqual(['build-1']);
    expect(change.after).toBe('build-1');
  });

  it('refuses a build with no material and one with no tier, rather than choosing either', () => {
    // The action insists where the field tolerates: `ComposedItem` leaves both links optional so an
    // older record can be read, and the *builder* is the surface that requires them
    const noMetal = picks({ materialId: undefined, materialLevel: undefined });
    const noTier = picks({ materialLevel: undefined });

    expect(refusal(composeBuild(aCharacter(), RULES, noMetal))).toContain('what this is made of');
    expect(refusal(composeBuild(aCharacter(), RULES, noTier))).toContain('which tier of Iron Ore');
  });

  it('refuses a material rung the family does not have, naming the gap', () => {
    // Iron Ore has tiers 1 and 10 and nothing between — a clamp to 1 would hand the Player an
    // object they did not ask for and cannot tell from one they did
    expect(refusal(composeBuild(aCharacter(), RULES, picks({ materialLevel: 5 })))).toBe(
      'Iron Ore has no tier 5.'
    );
    expect(
      refusal(composeBuild(aCharacter(), RULES, picks({ materialId: 'mat-ghost' })))
    ).toContain('no such material');
  });

  it('builds with an empty socket, which is the sheet’s own row', () => {
    const change = accepted(composeBuild(aCharacter(), RULES, picks()));
    const [only] = change.character.inventory.composedItems;

    expect(only.inlayId).toBeUndefined();
    expect(only.inlayLevel).toBeUndefined();
  });

  it('sockets a gem at a rung its family has', () => {
    const socketed = picks({ inlayId: 'inlay-zircon', inlayLevel: 9 });

    expect(
      accepted(composeBuild(aCharacter(), RULES, socketed)).character.inventory.composedItems
    ).toEqual([socketed]);
  });

  it('refuses the rung a family skips — the sheet’s Zircon 10', () => {
    // TICKET-INL-01's absent-tier rule surfacing where a Player can act on it. At calculation time
    // an absent rung is worth nothing, silently and deliberately; at build time it is a refusal.
    const zircon10 = picks({ inlayId: 'inlay-zircon', inlayLevel: 10 });

    expect(refusal(composeBuild(aCharacter(), RULES, zircon10))).toBe('Zircon has no tier 10.');
  });

  it('refuses half a socket in either direction', () => {
    const noRung = picks({ inlayId: 'inlay-zircon' });
    const noGem = picks({ inlayLevel: 9 });

    expect(refusal(composeBuild(aCharacter(), RULES, noRung))).toContain('which tier of Zircon');
    expect(refusal(composeBuild(aCharacter(), RULES, noGem))).toContain('leave the socket empty');
    expect(refusal(composeBuild(aCharacter(), RULES, picks({ inlayId: 'inlay-ghost' })))).toContain(
      'no such inlay'
    );
  });

  it('refuses to put down something the character does not have', () => {
    expect(refusal(discardBuild(aCharacter(), RULES, 'build-nothing'))).toContain('no such item');
  });

  it('refuses to destroy what is being worn, and says to take it off', () => {
    // The one state `discardBuild` refuses, and the reason *unequipped* and *discarded* are
    // different acts again now that the bag is derived
    const worn = holding({ head: 'item-helm' });

    expect(refusal(discardBuild(worn, RULES, 'build-item-helm'))).toContain('Take it off');
  });

  it('takes exactly the build named, where v1.0 took every copy', () => {
    // Two ropes are two *builds* now, so they are distinguishable and only the one asked for goes
    const hoarder = holding({}, ['item-rope', 'item-helm', 'item-rope']);

    const put = accepted(discardBuild(hoarder, RULES, 'build-item-rope-0')).character;

    expect(bagged(put)).toEqual(['build-item-helm-1', 'build-item-rope-2']);
    expect(put.inventory.composedItems.map((build) => build.id)).toEqual([
      'build-item-helm-1',
      'build-item-rope-2',
    ]);
  });

  it('clears a discarded build out of a slot the ruleset no longer defines', () => {
    // A force-deleted slot leaves its occupant worn nowhere real, so the bag offers it — and the id
    // has to go from `equippedItems` too, or it is a dangling reference nothing can ever clear
    const stranded = aCharacter({
      inventory: {
        equippedItems: { retired: 'build-1' },
        composedItems: [{ id: 'build-1', templateId: 'item-helm' }],
      },
    });

    const after = accepted(discardBuild(stranded, RULES, 'build-1')).character;

    expect(after.inventory.equippedItems).toEqual({});
    expect(after.inventory.composedItems).toEqual([]);
  });
});
