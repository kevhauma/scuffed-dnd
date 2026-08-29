/**
 * Focus Skills Tests (TICKET-SKL-05)
 *
 * The three tiers the source workbook computes — 0.9 unchosen, 2.1 chosen once, **3.3 chosen
 * twice** — plus the two absences that are not the same absence: a ruleset that states no dials
 * (neutral, every multiplier exactly 1) and a character that has made no picks (0.9 everywhere,
 * because three empty Setup slots each still contribute `focus_other`).
 *
 * **Validates: v4 systems/06 gap 2**
 */

import { describe, expect, it } from 'vitest';
import type { Character } from '../types/character';
import type { Constant, Skill } from '../types/config';
import {
  FOCUS_CHOSEN_NAME,
  FOCUS_OTHER_NAME,
  FOCUS_SLOT_COUNT,
  focusDials,
  focusMultiplier,
  focusPickRefusal,
  focusPicksOf,
  toFocusSlots,
} from './focusSkills';

/** The sheet's own dials, from the *Enhanced scaling* block — this ticket's fixture, not seed data */
const SHEET_DIALS: Constant[] = [
  {
    id: 'c1',
    name: FOCUS_CHOSEN_NAME,
    displayName: 'Focus chosen',
    description: '',
    value: 1.5,
  },
  {
    id: 'c2',
    name: FOCUS_OTHER_NAME,
    displayName: 'Focus other',
    description: '',
    value: 0.3,
  },
];

function skill(id: string): Skill {
  return { id, name: id, description: '', statWeights: [] };
}

function character(focusSkillIds?: string[]): Character {
  return {
    id: 'char1',
    name: 'Sample',
    configurationId: 'config1',
    raceIds: [],
    investedStatPoints: {},
    investedSkillPoints: {},
    currentResourceValues: {},
    experience: 0,
    inventory: { equippedItems: {}, miscItems: [], composedItems: [] },
    createdAt: '2024-01-01',
    updatedAt: '2024-01-01',
    ...(focusSkillIds ? { focusSkillIds } : {}),
  };
}

describe('the three modifier tiers', () => {
  const dials = focusDials(SHEET_DIALS);
  // The sample character's own picks: Arcane, Summening, **Arcane again**
  const PICKS = ['arcane', 'summening', 'arcane'];

  it('gives an unchosen skill 0.9 — three slots that each name something else', () => {
    expect(focusMultiplier('brewing', PICKS, dials)).toBeCloseTo(0.9, 10);
  });

  it('gives a skill chosen once 2.1', () => {
    expect(focusMultiplier('summening', PICKS, dials)).toBeCloseTo(2.1, 10);
  });

  it('gives a skill chosen twice 3.3 — duplicates stack, which is the point of a list', () => {
    expect(focusMultiplier('arcane', PICKS, dials)).toBeCloseTo(3.3, 10);
  });

  it('gives every skill 0.9 when the character has made no picks at all', () => {
    // Absent picks are *not* the neutral case: three empty Setup slots still each contribute
    // `focus_other`, which is the arithmetic the workbook does with a form nobody filled in
    expect(focusMultiplier('arcane', [], dials)).toBeCloseTo(0.9, 10);
  });

  it('reads a part-filled set of slots as the rest naming something else', () => {
    // One slot filled: 1.5 + 0.3 + 0.3. The sheet's picker fills slots one at a time, so this is an
    // ordinary state rather than a broken one
    expect(focusMultiplier('arcane', ['arcane'], dials)).toBeCloseTo(2.1, 10);
  });
});

describe('a ruleset that states no focus dials', () => {
  it('multiplies every skill by exactly 1, picks or no picks', () => {
    const neutral = focusDials([]);

    // Exactly, not approximately: `FOCUS_SLOT_COUNT` shares of `1 / FOCUS_SLOT_COUNT` are what make
    // *absent means neutral* a fact about the arithmetic rather than a tolerance
    expect(focusMultiplier('arcane', [], neutral)).toBe(1);
    expect(focusMultiplier('arcane', ['arcane', 'arcane', 'arcane'], neutral)).toBe(1);
  });

  it('says it stated nothing, which is what the creation rule asks before demanding picks', () => {
    const silent = focusDials([]);
    const dialled = focusDials(SHEET_DIALS);

    expect(silent.stated).toBe(false);
    expect(dialled.stated).toBe(true);
  });

  it('takes the one dial a ruleset does state and leaves the other neutral', () => {
    const [chosenOnly] = SHEET_DIALS;
    const dials = focusDials([chosenOnly as Constant]);

    expect(dials.stated).toBe(true);
    // A chosen skill gains (1.5 + ⅓ + ⅓) and an unchosen one is untouched — the reading that
    // follows from the constant that was set, rather than a zeroed sheet
    expect(focusMultiplier('arcane', ['arcane'], dials)).toBeCloseTo(2.1666666, 6);
    expect(focusMultiplier('brewing', ['arcane'], dials)).toBe(1);
  });

  it('falls back to neutral for a dial that is not a usable number', () => {
    const broken: Constant[] = [
      { id: 'c1', name: FOCUS_CHOSEN_NAME, displayName: '', description: '', value: Number.NaN },
    ];

    const dials = focusDials(broken);

    expect(dials.stated).toBe(false);
    expect(focusMultiplier('arcane', ['arcane'], dials)).toBe(1);
  });
});

describe('focusPicksOf', () => {
  it('reads an untouched character as no picks rather than as anything else', () => {
    const untouched = character();

    expect(focusPicksOf(untouched)).toEqual([]);
  });

  it('returns a stored list exactly as it stands, uncapped and unsorted', () => {
    const stored = ['arcane', 'summening', 'arcane'];
    const picky = character(stored);

    expect(focusPicksOf(picky)).toEqual(stored);
  });

  it('reads a field that is not a list as no picks', () => {
    const hand = { ...character(), focusSkillIds: 'arcane' } as unknown as Character;

    expect(focusPicksOf(hand)).toEqual([]);
  });
});

describe('toFocusSlots', () => {
  it('draws one slot per pick the ruleset asks for, empty where nothing was chosen', () => {
    expect(toFocusSlots(['arcane'])).toEqual(['arcane', '', '']);
    expect(toFocusSlots([])).toHaveLength(FOCUS_SLOT_COUNT);
  });
});

describe('focusPickRefusal', () => {
  const config = { skills: [skill('arcane'), skill('summening')] };

  it('accepts three picks, duplicates included', () => {
    expect(focusPickRefusal(['arcane', 'summening', 'arcane'], config)).toBeNull();
  });

  it('accepts fewer than three, which is how a slot gets filled one at a time', () => {
    expect(focusPickRefusal([], config)).toBeNull();
    expect(focusPickRefusal(['arcane'], config)).toBeNull();
  });

  it('refuses a fourth pick rather than trimming it', () => {
    const refusal = focusPickRefusal(['arcane', 'arcane', 'arcane', 'summening'], config);

    expect(refusal).toMatch(/4 were named/);
  });

  it('refuses an id this ruleset does not have rather than dropping it', () => {
    expect(focusPickRefusal(['arcane', 'nonesuch'], config)).toMatch(/not a skill/i);
  });

  it('refuses any pick at all against a ruleset with no skills', () => {
    expect(focusPickRefusal(['arcane'], {})).toMatch(/not a skill/i);
    expect(focusPickRefusal([], {})).toBeNull();
  });
});
