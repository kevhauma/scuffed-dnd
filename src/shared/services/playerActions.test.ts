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
import type { Character } from '../types/character';
import type { Configuration } from '../types/config';
import {
  addToPack,
  adjustPurseBy,
  adjustResourceValue,
  emptySlot,
  equipToSlot,
  investInSkill,
  investInStat,
  isRefusal,
  moveItemToEquipment,
  moveItemToMisc,
  type PlayerActionChange,
  type PlayerActionResult,
  removeFromPack,
  resetResourceToMax,
  setPurseAmount,
  setResourceValue,
} from './playerActions';

/** A ruleset with one pool, one invested stat, two skills, two slots and three items */
const RULES = {
  id: 'config-1',
  name: 'Test',
  version: '1.0',
  schemaVersion: 9,
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
  materials: [],
  materialCategories: [],
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
    inventory: { equippedItems: {}, miscItems: [] },
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
    ...overrides,
  };
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
  it('reports the slot it emptied as well as the item it filled it with', () => {
    const worn = aCharacter({
      inventory: { equippedItems: { head: 'item-helm' }, miscItems: [] },
    });

    const change = accepted(equipToSlot(worn, RULES, 'head', 'item-circlet'));

    expect(change.before).toBe('item-helm');
    expect(change.after).toBe('item-circlet');
  });

  it('reports an empty slot as null rather than as absent', () => {
    const change = accepted(equipToSlot(aCharacter(), RULES, 'head', 'item-helm'));

    expect(change.before).toBeNull();
  });

  it('refuses an item that declares another slot, one that declares none, and a slot the ruleset does not define', () => {
    expect(refusal(equipToSlot(aCharacter(), RULES, 'feet', 'item-helm'))).toContain(
      'does not go in that slot'
    );
    expect(refusal(equipToSlot(aCharacter(), RULES, 'head', 'item-rope'))).toContain(
      'does not go in that slot'
    );
    expect(refusal(equipToSlot(aCharacter(), RULES, 'tail', 'item-helm'))).toContain(
      'no such equipment slot'
    );
  });

  it('refuses to empty a slot that is already empty', () => {
    expect(refusal(emptySlot(aCharacter(), 'head'))).toContain('nothing in that slot');
    expect(refusal(moveItemToMisc(aCharacter(), 'head'))).toContain('nothing in that slot');
  });

  it('keeps a stowed item and drops an unequipped one', () => {
    const worn = aCharacter({
      inventory: { equippedItems: { head: 'item-helm' }, miscItems: [] },
    });

    expect(accepted(moveItemToMisc(worn, 'head')).character.inventory.miscItems).toEqual([
      'item-helm',
    ]);
    expect(accepted(emptySlot(worn, 'head')).character.inventory.miscItems).toEqual([]);
  });

  it('swaps a slot occupant back into the pack rather than losing it', () => {
    const worn = aCharacter({
      inventory: { equippedItems: { head: 'item-helm' }, miscItems: ['item-circlet'] },
    });

    const change = accepted(moveItemToEquipment(worn, RULES, 'item-circlet', 'head'));

    expect(change.character.inventory.equippedItems.head).toBe('item-circlet');
    expect(change.character.inventory.miscItems).toEqual(['item-helm']);
  });
});

describe('the pack', () => {
  it('refuses an item the ruleset does not define', () => {
    expect(refusal(addToPack(aCharacter(), RULES, 'item-ghost'))).toContain('no such item');
  });

  it('refuses to put down something that is not being carried', () => {
    expect(refusal(removeFromPack(aCharacter(), 'item-rope'))).toContain('not in the pack');
  });

  it('takes every copy of an item, because the pack has no quantities', () => {
    const hoarder = aCharacter({
      inventory: { equippedItems: {}, miscItems: ['item-rope', 'item-helm', 'item-rope'] },
    });

    expect(accepted(removeFromPack(hoarder, 'item-rope')).character.inventory.miscItems).toEqual([
      'item-helm',
    ]);
  });
});
