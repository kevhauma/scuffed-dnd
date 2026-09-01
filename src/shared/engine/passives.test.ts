/**
 * Tests for the passive-ability read side (TICKET-PAS-01)
 *
 * Three questions, and the third is the one worth having a file for: what an untouched character
 * holds, what order a sheet reads in, and what happens to an id the catalog has lost.
 */

import { describe, expect, it } from 'vitest';
import type { Character } from '../types/character';
import type { Passive } from '../types/config';
import { grantablePassives, heldPassiveIdsOf, passivesOf } from './passives';

/** The two shapes the source tab actually holds: plain prose, and prose with a computed number */
const CATALOG: Passive[] = [
  {
    id: 'passive-blindsight',
    name: 'Blindsight',
    effectText: 'You have blindsight out to {skills.perception.level * 10} feet.',
  },
  {
    id: 'passive-poison-low',
    name: 'Low poison resistance',
    effectText: 'You take three quarters of all poison damage.',
  },
  {
    id: 'passive-charmed',
    name: 'Charm immunity',
    effectText: 'You cannot be charmed.',
  },
];

/** A character holding whichever passives the case is about */
function holder(passiveIds?: string[]): Pick<Character, 'passiveIds'> {
  return passiveIds === undefined ? {} : { passiveIds };
}

describe('heldPassiveIdsOf', () => {
  it('should read an absent field as holding none', () => {
    expect(heldPassiveIdsOf(holder())).toEqual([]);
  });

  it('should read an empty list as holding none', () => {
    expect(heldPassiveIdsOf(holder([]))).toEqual([]);
  });

  it('should return the stored ids exactly as they stand', () => {
    // Never de-duplicated and never sorted: every write refuses a duplicate, so a repeat came from a
    // hand-edited file and tidying it here would hide an entry no revoke could name
    const repeated = ['passive-charmed', 'passive-charmed'];

    expect(heldPassiveIdsOf(holder(repeated))).toEqual(repeated);
  });

  it('should read a non-array stored value as holding none', () => {
    const handEdited = { passiveIds: 'passive-charmed' } as unknown as Pick<
      Character,
      'passiveIds'
    >;

    expect(heldPassiveIdsOf(handEdited)).toEqual([]);
  });
});

describe('passivesOf', () => {
  it('should resolve held ids against the catalog', () => {
    const held = passivesOf(holder(['passive-blindsight']), { passives: CATALOG });

    expect(held).toHaveLength(1);
    expect(held[0].passive?.name).toBe('Blindsight');
  });

  it('should read in catalog order rather than the order they were handed out', () => {
    // So a sheet reads the same way down every page, and an ability does not move when another is
    // granted — `spellbookOf`'s rule, and the reason the held list's own order carries no meaning
    const held = passivesOf(holder(['passive-charmed', 'passive-blindsight']), {
      passives: CATALOG,
    });

    expect(held.map((entry) => entry.passiveId)).toEqual(['passive-blindsight', 'passive-charmed']);
  });

  it('should draw an id the catalog has lost as a row with nothing behind it', () => {
    // The force-delete case. Dropping it would leave the holder with an id no surface shows and no
    // control can clear, which is the one thing a revoke exists for.
    const held = passivesOf(holder(['passive-blindsight', 'passive-gone']), { passives: CATALOG });

    expect(held).toHaveLength(2);
    expect(held[1]).toEqual({ passiveId: 'passive-gone', passive: null });
  });

  it('should append lost ids after the ones the catalog still has', () => {
    const held = passivesOf(holder(['passive-gone', 'passive-charmed']), { passives: CATALOG });

    expect(held.map((entry) => entry.passiveId)).toEqual(['passive-charmed', 'passive-gone']);
  });

  it('should hold none on a ruleset with no catalog at all', () => {
    expect(passivesOf(holder(), {})).toEqual([]);
  });

  it('should draw every held id on a ruleset whose catalog has gone', () => {
    const held = passivesOf(holder(['passive-charmed']), {});

    expect(held).toEqual([{ passiveId: 'passive-charmed', passive: null }]);
  });
});

describe('grantablePassives', () => {
  it('should offer the whole catalog to a character holding none', () => {
    expect(grantablePassives(holder(), { passives: CATALOG })).toEqual(CATALOG);
  });

  it('should be the complement of what is held, so a grant moves a row between the two', () => {
    const grantable = grantablePassives(holder(['passive-blindsight']), { passives: CATALOG });

    expect(grantable.map((passive) => passive.id)).toEqual([
      'passive-poison-low',
      'passive-charmed',
    ]);
  });

  it('should offer nothing on a ruleset with no catalog', () => {
    expect(grantablePassives(holder(), {})).toEqual([]);
  });
});
