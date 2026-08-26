/**
 * The one rule about whether a stored Character can be read (TICKET-IO-04)
 *
 * **The point of the module is that there is one of these, not two**, so the cases below are written
 * against the fields whose absence is a *crash* or a *lie* — which is what earned each of them a
 * place in the check rather than being a field somebody happened to think of.
 *
 * **Validates: v3 Req 36.5**
 */

import { describe, expect, it } from 'vitest';
import type { Character } from '../types/character';
import { isReadableCharacter, uploadedCharacterErrors } from './characterShape';

/** A character in the shape LocalStorage holds one */
function stored(overrides: Partial<Character> = {}): Character {
  return {
    id: 'character-1',
    name: 'Quackers',
    configurationId: 'ruleset-1',
    raceIds: [],
    investedStatPoints: {},
    investedSkillPoints: {},
    currentResourceValues: {},
    experience: 0,
    inventory: { equippedItems: {}, miscItems: [] },
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('isReadableCharacter', () => {
  it('accepts a character this build wrote', () => {
    expect(isReadableCharacter(stored())).toBe(true);
  });

  it('refuses one with no invested stat points, which every read would crash on', () => {
    expect(isReadableCharacter(stored({ investedStatPoints: undefined as never }))).toBe(false);
  });

  it('refuses one with no current resource values', () => {
    expect(isReadableCharacter(stored({ currentResourceValues: undefined as never }))).toBe(false);
  });

  it('refuses one with no experience, whose absence would read as a confident level 1', () => {
    expect(isReadableCharacter(stored({ experience: undefined as never }))).toBe(false);
  });

  it('refuses a NaN experience rather than storing an award computed from nothing', () => {
    expect(isReadableCharacter(stored({ experience: Number.NaN }))).toBe(false);
  });

  it('refuses nothing at all', () => {
    expect(isReadableCharacter(null)).toBe(false);
    expect(isReadableCharacter(undefined)).toBe(false);
  });

  it('accepts one with no wallet, which is a field that did not always exist', () => {
    // TICKET-CUR-02's purse is deliberately optional: a purse nobody has touched is not the same as
    // an empty one, and requiring it would make a stored roster unreadable for want of a new field
    expect(isReadableCharacter(stored({ wallet: undefined }))).toBe(true);
  });
});

describe('uploadedCharacterErrors', () => {
  it('finds nothing wrong with a stored character', () => {
    expect(uploadedCharacterErrors(stored(), 'characters[0]')).toEqual([]);
  });

  it('names the path it was given, so a caller can point at the record', () => {
    const errors = uploadedCharacterErrors({}, 'characters[3]');

    expect(errors.every((message) => message.startsWith('characters[3]'))).toBe(true);
  });

  it('refuses anything that is not an object, including an array', () => {
    expect(uploadedCharacterErrors('Quackers', 'characters[0]')).toHaveLength(1);
    expect(uploadedCharacterErrors([], 'characters[0]')).toHaveLength(1);
    expect(uploadedCharacterErrors(null, 'characters[0]')).toHaveLength(1);
  });

  it('requires the three strings a row is stored under', () => {
    const errors = uploadedCharacterErrors(
      { ...stored(), id: '', name: 42, configurationId: undefined },
      'characters[0]'
    );

    expect(errors.join(' ')).toContain('characters[0].id');
    expect(errors.join(' ')).toContain('characters[0].name');
    expect(errors.join(' ')).toContain('characters[0].configurationId');
  });

  it('reports a missing allocation map', () => {
    const errors = uploadedCharacterErrors(
      stored({ investedStatPoints: undefined as never }),
      'characters[0]'
    );

    expect(errors).toEqual([
      'characters[0].investedStatPoints must be an object of finite numbers keyed by stat id',
    ]);
  });

  describe('it is stricter than the browser’s own check, and has to be (the IO-04 review)', () => {
    // `isReadableCharacter` guards data *this app* wrote; this guards a request body. `!== undefined`
    // accepts `null` and accepts a scalar, and a `Character` stored with either is a `TypeError` for
    // whichever surface reads it — the server's own re-derivation included, since
    // `calculateCharacter` walks `inventory.equippedItems` and `raceIds` without guarding them.
    it('refuses a null allocation map that the browser’s predicate would let through', () => {
      const nulled = { ...stored(), investedStatPoints: null };

      expect(isReadableCharacter(nulled as never)).toBe(true);
      expect(uploadedCharacterErrors(nulled, 'characters[0]')).not.toEqual([]);
    });

    it('refuses a scalar where a map belongs', () => {
      expect(uploadedCharacterErrors({ ...stored(), currentResourceValues: 0 }, 'c')).not.toEqual(
        []
      );
    });

    it('refuses a map holding anything that is not a finite number', () => {
      expect(
        uploadedCharacterErrors({ ...stored(), investedSkillPoints: { a: 'lots' } }, 'c')
      ).not.toEqual([]);
      expect(
        uploadedCharacterErrors({ ...stored(), investedSkillPoints: { a: Number.NaN } }, 'c')
      ).not.toEqual([]);
    });

    it('requires the inventory a sheet dereferences', () => {
      const errors = uploadedCharacterErrors({ ...stored(), inventory: undefined }, 'c');

      expect(errors.join(' ')).toContain('c.inventory');
    });

    it('requires the inventory’s own two halves', () => {
      expect(
        uploadedCharacterErrors({ ...stored(), inventory: { miscItems: [] } }, 'c').join(' ')
      ).toContain('equippedItems');
      expect(
        uploadedCharacterErrors({ ...stored(), inventory: { equippedItems: {} } }, 'c').join(' ')
      ).toContain('miscItems');
    });

    it('requires raceIds to be a list of ids', () => {
      expect(uploadedCharacterErrors({ ...stored(), raceIds: 'elf' }, 'c').join(' ')).toContain(
        'raceIds'
      );
      expect(uploadedCharacterErrors({ ...stored(), raceIds: [7] }, 'c').join(' ')).toContain(
        'raceIds'
      );
    });

    it('requires the two timestamps', () => {
      expect(
        uploadedCharacterErrors({ ...stored(), createdAt: undefined }, 'c').join(' ')
      ).toContain('createdAt');
    });

    it('still accepts the two fields the type marks optional', () => {
      // A stored roster predating either must not become unreadable for want of a field that did
      // not exist when it was written — `wallet` arrived with TICKET-CUR-02, `archetypeId` with ARC-03
      expect(
        uploadedCharacterErrors({ ...stored(), wallet: undefined, archetypeId: undefined }, 'c')
      ).toEqual([]);
    });
  });
});
