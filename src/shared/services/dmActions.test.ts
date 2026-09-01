/**
 * The Kernel's DM-adjustment rules (TICKET-DM-01)
 *
 * `playerActions.test.ts`'s counterpart, and the same division of labour: `routes/dm/dm.test.ts`
 * proves these hold *through a request* against the real corpus; this proves the two things a route
 * cannot see. **The before/after pair**, which every accepted adjustment carries and which v3 Req
 * 42.6's Event log has no other source for — a *set level* that reported a level rather than the
 * experience it wrote would make the whole log a claim that a level is a stored thing. And **the
 * refusals as sentences**, which are what a DM at a table actually reads.
 *
 * The fixture is small rather than the corpus, for the same reason it is there: every rule under
 * test is about one number or one curve.
 *
 * TICKET-RES-04 added the dream level's rules to the same list, and its cases are about the same two
 * things: the before it reports for a character that has never had one, and the sentence a DM reads
 * when they type a level below the floor.
 *
 * **TICKET-PAS-01 added the passive handout**, whose cases are about a third thing neither of those
 * raises: *none* has one spelling on the document, so revoking the last passive has to leave the
 * field absent rather than an empty array — and the revoke has to work on an id the catalog has lost,
 * which is what makes its signature ruleset-free.
 *
 * **Validates: v3 Req 42.1, 42.2, 42.3, 42.4; v4 systems/02 gap 2; v4 systems/14**
 */

import { describe, expect, it } from 'vitest';
import { calculateCharacterLevel } from '../engine/characterSummary';
import { dreamLevelOf } from '../engine/dreamLevel';
import { validateStatAllocation } from '../engine/skillAllocation';
import type { Character } from '../types/character';
import type { Configuration } from '../types/config';
import {
  addExperience,
  addHeldPassive,
  removeExperience,
  removeHeldPassive,
  setDreamLevel,
  setGrantedPoints,
  setLevelExperience,
} from './dmActions';
import { isRefusal, type PlayerActionChange, type PlayerActionResult } from './playerActions';

/** A ruleset with one investable stat, five points a level, and a four-rung XP ladder */
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
  ],
  // One skill, so a grant can be priced against a spend that is not all stat-side (TICKET-RES-05)
  skills: [{ id: 'skill-stealth', name: 'Stealth', description: '', statWeights: [] }],
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
        { key: 2, values: [100] },
        { key: 3, values: [250] },
      ],
      interpolation: 'step',
      // So a level past the table is a **refusal** rather than an extrapolation — the case the
      // criterion is about
      outOfRange: 'error',
      lookupDirection: 'reverse',
    },
  ],
  createdAt: '2024-01-01',
  updatedAt: '2024-01-01',
} as unknown as Configuration;

/** A ruleset with no XP curve at all, so a level cannot be priced in either direction */
const NO_LADDER = { ...RULES, curves: [] } as unknown as Configuration;

function aCharacter(overrides: Partial<Character> = {}): Character {
  return {
    id: 'character-1',
    name: 'Quackers',
    configurationId: 'config-1',
    raceIds: [],
    investedStatPoints: {},
    investedSkillPoints: {},
    currentResourceValues: {},
    experience: 0,
    inventory: { equippedItems: {}, composedItems: [] },
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

describe('awarding and deducting experience', () => {
  it('reports what the total was and what it is now, and moves nothing else', () => {
    const change = accepted(addExperience(aCharacter({ experience: 40 }), 60));

    expect(change.before).toBe(40);
    expect(change.after).toBe(100);
    expect(change.character.experience).toBe(100);
    expect(calculateCharacterLevel(change.character, RULES)).toBe(2);
  });

  it('refuses a deduction below zero rather than clamping it', () => {
    expect(refusal(removeExperience(aCharacter({ experience: 40 }), 100))).toContain(
      'below zero experience'
    );
  });

  it('accepts a deduction that lands exactly on zero', () => {
    expect(accepted(removeExperience(aCharacter({ experience: 40 }), 40)).after).toBe(0);
  });

  it('refuses a non-positive amount rather than treating it as the other direction', () => {
    expect(refusal(addExperience(aCharacter(), -50))).toContain('positive amount');
    expect(refusal(removeExperience(aCharacter(), 0))).toContain('positive amount');
  });

  it('refuses a character whose stored total is not a number rather than persisting NaN', () => {
    const broken = aCharacter({ experience: undefined as unknown as number });

    expect(refusal(addExperience(broken, 10))).toContain('no readable experience total');
  });

  it('leaves the character it was given untouched', () => {
    const character = aCharacter({ experience: 40 });
    addExperience(character, 10);

    expect(character.experience).toBe(40);
  });
});

describe('setting a level', () => {
  it("writes the curve's threshold experience, and the level then derives to what was asked", () => {
    const change = accepted(setLevelExperience(aCharacter(), RULES, 3));

    expect(change.before).toBe(0);
    expect(change.after).toBe(250);
    expect(calculateCharacterLevel(change.character, RULES)).toBe(3);
  });

  it('reports experience as the before and after, never a level', () => {
    const change = accepted(setLevelExperience(aCharacter({ experience: 120 }), RULES, 1));

    expect(change.before).toBe(120);
    expect(change.after).toBe(0);
  });

  it('is refused, with the reason, when the curve cannot price that level', () => {
    // Past the table, with `outOfRange: 'error'` — no guess, and the curve's own sentence
    expect(refusal(setLevelExperience(aCharacter(), RULES, 9))).toContain('cannot price level 9');
    expect(refusal(setLevelExperience(aCharacter(), NO_LADDER, 2))).toContain('xp_thresholds');
  });

  it('refuses a level that is not a whole number at or above 1', () => {
    expect(refusal(setLevelExperience(aCharacter(), RULES, 2.5))).toContain('whole number');
    expect(refusal(setLevelExperience(aCharacter(), RULES, 0))).toContain('below 1');
  });
});

describe('granting and revoking stat points', () => {
  it('raises the budget the Kernel reports, on top of the derived pool', () => {
    const granted = accepted(setGrantedPoints(aCharacter(), RULES, 3)).character;

    // Level 1 × five points a level, plus the grant
    expect(validateStatAllocation(aCharacter(), RULES).pointBudget).toBe(5);
    expect(validateStatAllocation(granted, RULES).pointBudget).toBe(8);
    expect(validateStatAllocation(granted, RULES).grantedPoints).toBe(3);
  });

  it('reports what the grant was and what it is now', () => {
    const change = accepted(setGrantedPoints(aCharacter({ grantedStatPoints: 3 }), RULES, 1));

    expect(change.before).toBe(3);
    expect(change.after).toBe(1);
  });

  it('refuses a revocation that would leave the character overspent, naming the overspend', () => {
    const spent = aCharacter({ grantedStatPoints: 5, investedStatPoints: { 'stat-str': 9 } });

    // Budget without the grant is 5, so revoking it entirely leaves four points overspent
    expect(refusal(setGrantedPoints(spent, RULES, 0))).toContain('4 points overspent');
  });

  it('says "1 point" rather than "1 points" when that is what the overspend is', () => {
    const spent = aCharacter({ grantedStatPoints: 5, investedStatPoints: { 'stat-str': 6 } });

    expect(refusal(setGrantedPoints(spent, RULES, 0))).toContain('1 point overspent');
  });

  it('allows a revocation the character can still afford', () => {
    const spent = aCharacter({ grantedStatPoints: 5, investedStatPoints: { 'stat-str': 6 } });

    expect(accepted(setGrantedPoints(spent, RULES, 1)).after).toBe(1);
  });

  it('never refuses a *raise*, even on an allocation that is already invalid', () => {
    // A spend the pool cannot cover: more points is the DM helping, not making it worse
    const overspent = aCharacter({ investedStatPoints: { 'stat-str': 40 } });

    expect(accepted(setGrantedPoints(overspent, RULES, 35)).after).toBe(35);
  });

  it('refuses a fractional or negative grant in words', () => {
    expect(refusal(setGrantedPoints(aCharacter(), RULES, 1.5))).toContain('whole number');
    expect(refusal(setGrantedPoints(aCharacter(), RULES, -1))).toContain('cannot be negative');
  });

  /**
   * The grant is priced over the *summed* spend since TICKET-RES-05
   *
   * Every rule above is unchanged; what changed underneath them is what a revocation is measured
   * against, because skill points now come out of the same pool.
   */
  it('prices a revocation over the skill boxes too, not the stat boxes alone', () => {
    const spent = aCharacter({
      grantedStatPoints: 5,
      investedStatPoints: { 'stat-str': 4 },
      investedSkillPoints: { 'skill-stealth': 5 },
    });
    const revoked = setGrantedPoints(spent, RULES, 0);

    // Budget without the grant is 5 against nine points spent across both maps
    expect(refusal(revoked)).toContain('4 points overspent');
  });

  it('still lets a grant cover a spend that is all skill-side', () => {
    const spent = aCharacter({ investedSkillPoints: { 'skill-stealth': 8 } });
    const granted = accepted(setGrantedPoints(spent, RULES, 3)).character;

    expect(validateStatAllocation(spent, RULES).isValid).toBe(false);
    expect(validateStatAllocation(granted, RULES).isValid).toBe(true);
  });
});

describe('setting a dream level', () => {
  it('reports 1 as the before for a character that has never had one, and writes what was typed', () => {
    const untouched = aCharacter();
    const result = setDreamLevel(untouched, 3);
    const change = accepted(result);

    expect(change.before).toBe(1);
    expect(change.after).toBe(3);
    expect(change.character.dreamLevel).toBe(3);
    expect(dreamLevelOf(change.character)).toBe(3);
  });

  it('reports what the dream level was and what it is now', () => {
    const dreaming = aCharacter({ dreamLevel: 2 });
    const result = setDreamLevel(dreaming, 5);
    const change = accepted(result);

    expect(change.before).toBe(2);
    expect(change.after).toBe(5);
  });

  it('refuses a level below the floor, naming it, and writes nothing', () => {
    const dreaming = aCharacter({ dreamLevel: 3 });
    const zeroed = setDreamLevel(dreaming, 0);
    const negative = setDreamLevel(dreaming, -2);

    expect(refusal(zeroed)).toBe('A dream level cannot be below 1.');
    expect(refusal(negative)).toBe('A dream level cannot be below 1.');
    // Refused rather than clamped to the floor — a 0 that quietly became a 1 would leave the DM
    // believing they had set it back to neutral
    expect(dreamLevelOf(dreaming)).toBe(3);
  });

  it('refuses a fractional level rather than rounding one', () => {
    const result = setDreamLevel(aCharacter(), 1.5);

    expect(refusal(result)).toBe('A dream level has to be a whole number.');
  });

  it('accepts the floor itself, so a raise can be taken back to neutral', () => {
    const dreaming = aCharacter({ dreamLevel: 4 });
    const result = setDreamLevel(dreaming, 1);
    const change = accepted(result);

    expect(change.after).toBe(1);
    expect(change.character.dreamLevel).toBe(1);
  });

  it('leaves the character it was given untouched', () => {
    const dreaming = aCharacter({ dreamLevel: 2 });
    setDreamLevel(dreaming, 9);

    expect(dreaming.dreamLevel).toBe(2);
  });
});

describe('handing out and taking back a passive ability', () => {
  /** The ruleset above plus a two-entry catalog — the two shapes the source tab holds */
  const WITH_PASSIVES = {
    ...RULES,
    passives: [
      {
        id: 'passive-blindsight',
        name: 'Blindsight',
        effectText: 'Blindsight out to {skills.stealth.level * 10} feet.',
      },
      { id: 'passive-charmed', name: 'Charm immunity', effectText: 'You cannot be charmed.' },
    ],
  } as unknown as Configuration;

  it('reports the id that came onto the sheet, and leaves everything else alone', () => {
    const change = accepted(addHeldPassive(aCharacter(), WITH_PASSIVES, 'passive-blindsight'));

    expect(change.before).toBeNull();
    expect(change.after).toBe('passive-blindsight');
    expect(change.character.passiveIds).toEqual(['passive-blindsight']);
    expect(change.character.experience).toBe(0);
  });

  it('appends rather than replacing, so a second handout keeps the first', () => {
    const held = aCharacter({ passiveIds: ['passive-blindsight'] });
    const change = accepted(addHeldPassive(held, WITH_PASSIVES, 'passive-charmed'));

    expect(change.character.passiveIds).toEqual(['passive-blindsight', 'passive-charmed']);
  });

  it('refuses a passive this ruleset does not have', () => {
    const result = addHeldPassive(aCharacter(), WITH_PASSIVES, 'passive-nonesuch');

    expect(refusal(result)).toBe('This ruleset has no such passive ability.');
  });

  it('refuses a duplicate by name rather than quietly adding a second entry', () => {
    // A no-op would leave a DM believing the second tap landed, and a second entry would be a row
    // no single revoke could remove
    const held = aCharacter({ passiveIds: ['passive-charmed'] });
    const result = addHeldPassive(held, WITH_PASSIVES, 'passive-charmed');

    expect(refusal(result)).toBe('Quackers already has Charm immunity.');
  });

  it('takes one back and reports which', () => {
    const held = aCharacter({ passiveIds: ['passive-blindsight', 'passive-charmed'] });
    const change = accepted(removeHeldPassive(held, 'passive-blindsight'));

    expect(change.before).toBe('passive-blindsight');
    expect(change.after).toBeNull();
    expect(change.character.passiveIds).toEqual(['passive-charmed']);
  });

  it('removes the field entirely when the last one goes, rather than storing an empty array', () => {
    // *None* has one spelling on the document, so a character who lost their last passive and one
    // who never had any are the same character — `focusPicksField`'s rule
    const held = aCharacter({ passiveIds: ['passive-charmed'] });
    const change = accepted(removeHeldPassive(held, 'passive-charmed'));

    expect('passiveIds' in change.character).toBe(false);
  });

  it('takes back an id the ruleset has lost, because it consults no ruleset at all', () => {
    // The whole reason the revoke is its own action rather than half of a whole-list write: a
    // force-deleted passive is exactly the id most in need of removing
    const held = aCharacter({ passiveIds: ['passive-gone'] });
    const change = accepted(removeHeldPassive(held, 'passive-gone'));

    expect('passiveIds' in change.character).toBe(false);
  });

  it('refuses to take back one the character does not have', () => {
    const result = removeHeldPassive(aCharacter(), 'passive-charmed');

    expect(refusal(result)).toBe('Quackers does not have that passive ability.');
  });

  it('hands nothing out on a ruleset with no catalog', () => {
    const result = addHeldPassive(aCharacter(), RULES, 'passive-charmed');

    expect(refusal(result)).toBe('This ruleset has no such passive ability.');
  });
});
