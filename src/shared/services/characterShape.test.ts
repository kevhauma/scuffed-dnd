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
    inventory: { equippedItems: {}, composedItems: [] },
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

  it('accepts one with no purse, which is a field that did not always exist', () => {
    // TICKET-CUR-02's purse is deliberately optional: a purse nobody has touched is not the same as
    // an empty one, and requiring it would make a stored roster unreadable for want of a new field
    expect(isReadableCharacter(stored({ purse: undefined }))).toBe(true);
  });

  it('refuses one written before composed items, so a v3 roster meets the notice (TICKET-INV-05)', () => {
    // v4.0's clean break reaching the roster (D6). Such a character's `equippedItems` holds
    // *template* ids, which read as builds nobody has — an ordinary-looking sheet with every
    // Player's gear silently gone. Refusing routes it to `IncompatibleDataNotice` and a backup.
    const beforeBuilds = stored({
      inventory: { equippedItems: {}, miscItems: [] } as never,
    });
    // `miscItems` is the *pre*-INV-06 spelling of the pack, kept here on purpose: this is a v3
    // roster, and what makes it unreadable is the absent `composedItems` rather than the extra key

    const readable = isReadableCharacter(beforeBuilds);

    expect(readable).toBe(false);
  });

  it('ignores a key this build no longer has rather than refusing the record', () => {
    // A retired key is inert, not disqualifying: `wallet` (retired by TICKET-CUR-02) and
    // `miscItems` (deleted by TICKET-INV-06) are fields nothing reads, and the fields this check
    // *does* name are what decide readability. Since TICKET-DX-09 deleted the last adapter there is
    // nothing to convert either — a character carrying one is simply read without it.
    const strays = { ...stored(), wallet: { gold: 3 } } as Character;

    const readable = isReadableCharacter(strays);

    expect(readable).toBe(true);
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

    it('requires both of the inventory’s collections', () => {
      // Two since TICKET-INV-06, where INV-05 had three: the Backpack is derived, so a stored
      // `miscItems` is a field nothing reads rather than a collection to insist on
      expect(
        uploadedCharacterErrors({ ...stored(), inventory: { composedItems: [] } }, 'c').join(' ')
      ).toContain('equippedItems');
      const withoutBuilds = { ...stored(), inventory: { equippedItems: {} } };
      const missingSecond = uploadedCharacterErrors(withoutBuilds, 'c');

      expect(missingSecond.join(' ')).toContain('composedItems');
    });

    it('ignores a stored miscItems rather than refusing the character (TICKET-INV-06)', () => {
      // The Backpack stopped being stored; a body still carrying the list is not wrong, it is
      // out of date, and every build it named is in `composedItems` either way — so the character
      // opens with all of them in the bag rather than meeting an error about a field nobody reads
      const stale = {
        ...stored(),
        inventory: { equippedItems: {}, miscItems: ['build-1'], composedItems: [] },
      };

      expect(uploadedCharacterErrors(stale, 'c')).toEqual([]);
    });

    it.each([
      // The two required halves: without them the record is a row nothing can equip or price
      ['no id', [{ templateId: 'axe' }]],
      ['no templateId', [{ id: 'build-1' }]],
      ['an empty id', [{ id: '', templateId: 'axe' }]],
      // A rung that is not a finite number would compare against `MaterialLevel.level` and quietly
      // match nothing while looking like a build the Player made
      ['a null material rung', [{ id: 'b', templateId: 'axe', materialLevel: null }]],
      ['a NaN inlay rung', [{ id: 'b', templateId: 'axe', inlayLevel: Number.NaN }]],
      ['an inlay id that is a number', [{ id: 'b', templateId: 'axe', inlayId: 7 }]],
      ['a build that is not an object at all', ['axe']],
    ])('refuses a composed record with %s (TICKET-INV-05)', (_label, composedItems: unknown[]) => {
      const uploaded = {
        ...stored(),
        inventory: { equippedItems: {}, composedItems },
      };

      const errors = uploadedCharacterErrors(uploaded, 'c');

      expect(errors).not.toEqual([]);
    });

    it('accepts a build with neither material nor inlay — the sheet’s plain rope', () => {
      const rope = {
        ...stored(),
        inventory: {
          equippedItems: {},
          composedItems: [{ id: 'build-1', templateId: 'item-rope' }],
        },
      };

      const errors = uploadedCharacterErrors(rope, 'c');

      expect(errors).toEqual([]);
    });

    it('round-trips a full triple through JSON and past the gate', () => {
      const built = {
        ...stored(),
        inventory: {
          equippedItems: { main_hand: 'build-1' },
          composedItems: [
            {
              id: 'build-1',
              templateId: 'item-battleaxe',
              materialId: 'mat-iron-ore',
              materialLevel: 10,
              inlayId: 'inlay-diamond',
              inlayLevel: 4,
            },
          ],
        },
      };

      const written = JSON.stringify(built);
      const read = JSON.parse(written) as Character;
      const errors = uploadedCharacterErrors(read, 'characters[0]');

      expect(read.inventory.composedItems).toEqual(built.inventory.composedItems);
      expect(errors).toEqual([]);
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
      // not exist when it was written — `purse` arrived with TICKET-CUR-02, `archetypeId` with ARC-03
      const bare = { ...stored(), purse: undefined, archetypeId: undefined };

      const errors = uploadedCharacterErrors(bare, 'c');

      expect(errors).toEqual([]);
    });
  });

  describe('a kit of any size (TICKET-INV-04)', () => {
    /** A character wearing one item in each of `count` slots, named the way a v4 ruleset names them */
    function wearing(count: number): Character {
      const entries = Array.from({ length: count }, (_, index) => [
        `slot_${index}`,
        `build-${index}`,
      ]);
      const equippedItems = Object.fromEntries(entries);
      const composedItems = Array.from({ length: count }, (_, index) => ({
        id: `build-${index}`,
        templateId: `item-${index}`,
      }));

      return stored({ inventory: { equippedItems, composedItems } });
    }

    it('carries a one-slot and a twelve-slot kit through JSON and past the gate', () => {
      // How many slots a ruleset has is the User's answer, so neither the wire shape nor the check
      // above it may have a number of its own
      for (const count of [1, 12]) {
        const character = wearing(count);
        const written = JSON.stringify(character);
        const read = JSON.parse(written) as Character;

        expect(read.inventory.equippedItems, `a kit of ${count} did not survive`).toEqual(
          character.inventory.equippedItems
        );
        expect(Object.keys(read.inventory.equippedItems)).toHaveLength(count);
        expect(uploadedCharacterErrors(read, 'characters[0]')).toEqual([]);
      }
    });
  });
});
