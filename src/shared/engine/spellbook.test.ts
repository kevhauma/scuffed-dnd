/**
 * Spellbook Tests (TICKET-SPL-02)
 *
 * Three things this file is about: the **absent default** (a character who has never learned a spell
 * reads as none, and the default lives here rather than at each call site), the **filter** (the
 * learned subset in compendium order, which is what the sheet's `Spellbook` tab is), and the **lost
 * id** (a spell the ruleset no longer has survives as a row rather than disappearing or crashing).
 *
 * **Validates: v4 systems/13 gap 2**
 */

import { describe, expect, it } from 'vitest';
import type { Character } from '../types/character';
import type { Spell } from '../types/config';
import { learnedSpellIdsOf, spellbookOf } from './spellbook';

function spell(id: string, name: string): Spell {
  return { id, name, rangeTime: '60 Feet', effectTemplate: '', manaCost: 90 };
}

const COMPENDIUM = [spell('acid', 'Acid Splash'), spell('fire', 'Fireball'), spell('aid', 'Aid')];

/** Only the fields these functions read — the rest of a `Character` is nothing to do with spells */
function caster(learnedSpellIds?: string[]): Pick<Character, 'learnedSpellIds'> {
  return learnedSpellIds === undefined ? {} : { learnedSpellIds };
}

describe('learnedSpellIdsOf', () => {
  it('reads an absent field as none, so no call site has to decide', () => {
    expect(learnedSpellIdsOf(caster())).toEqual([]);
  });

  it('returns a stored list as it stands', () => {
    expect(learnedSpellIdsOf(caster(['fire', 'aid']))).toEqual(['fire', 'aid']);
  });

  it('does not de-duplicate a hand-edited list, so two entries stay two entries', () => {
    // Every write refuses a duplicate, so a repeat came from outside the app. Collapsing it here
    // would show one row for a document holding two ids no unlearn could tell apart.
    expect(learnedSpellIdsOf(caster(['fire', 'fire']))).toEqual(['fire', 'fire']);
  });
});

describe('spellbookOf', () => {
  it('is empty for a character who has learned nothing', () => {
    expect(spellbookOf(caster(), { spells: COMPENDIUM })).toEqual([]);
  });

  it("is the learned subset — the sheet's own FILTER", () => {
    const book = spellbookOf(caster(['fire']), { spells: COMPENDIUM });

    expect(book).toEqual([{ spellId: 'fire', spell: COMPENDIUM[1] }]);
  });

  it('reads in compendium order rather than in the order they were learned', () => {
    // The sheet's `FILTER` returns table order, so a Spellbook reads the same way down every page
    // and a spell does not move when the Player learns another one
    const book = spellbookOf(caster(['aid', 'acid']), { spells: COMPENDIUM });

    expect(book.map((entry) => entry.spellId)).toEqual(['acid', 'aid']);
  });

  it('keeps an id the ruleset has lost as a row with no spell behind it', () => {
    // The Player is the only one who can clear it, and a row they cannot see is one they cannot
    // unlearn — so it is drawn rather than dropped, and after the rows that still resolve
    const book = spellbookOf(caster(['ghost', 'fire']), { spells: COMPENDIUM });

    expect(book).toEqual([
      { spellId: 'fire', spell: COMPENDIUM[1] },
      { spellId: 'ghost', spell: null },
    ]);
  });

  it('treats a ruleset with no compendium as one that has lost every spell', () => {
    const book = spellbookOf(caster(['fire']), {});

    expect(book).toEqual([{ spellId: 'fire', spell: null }]);
  });
});
