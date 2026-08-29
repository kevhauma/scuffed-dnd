/**
 * The race count as ruleset data, and the picks it counts (TICKET-RACE-04)
 *
 * Three things are pinned here. **The dial** — `const.race_count`, absent meaning the sheet's two,
 * an unusable value meaning the same. **The rule's number** — the dial with its one stated
 * exception, a ruleset that offers no races. And **the resolution** — picks in pick order with
 * duplicates kept, which is what makes a pure-blood expressible now that `Empty` is gone.
 *
 * The fourth case is the one the ticket asked for by name: `MAX_RACE_COUNT` is gone and each of its
 * four former call sites reads the ruleset instead. Four copies of a rule is how the old one drifted
 * — *at most 2*, spelled four times — so the shape of the fix is asserted rather than described.
 */

import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import type { Constant, Race } from '../types/config';
import {
  DEFAULT_RACE_COUNT,
  RACE_COUNT_NAME,
  raceCount,
  racesRequired,
  resolveRaces,
} from './races';

/** The ruleset's constants, holding a race count and nothing else */
function withCount(value: number): Constant[] {
  return [
    {
      id: 'const-race-count',
      name: RACE_COUNT_NAME,
      displayName: 'Races per character',
      description: '',
      value,
    },
  ];
}

function race(id: string): Race {
  return { id, name: id, description: '', statValues: {} };
}

describe('raceCount — the ruleset’s dial', () => {
  it('reads the constant the ruleset states', () => {
    const one = withCount(1);
    const three = withCount(3);
    // Zero is a real answer, not an unusable one: a ruleset whose characters have no lineage
    const none = withCount(0);

    expect(raceCount(one)).toBe(1);
    expect(raceCount(three)).toBe(3);
    expect(raceCount(none)).toBe(0);
  });

  it('reads an absent constant as the sheet’s two', () => {
    // The reader owns the default, so a ruleset written before this ticket behaves exactly as it
    // did and round-trips without growing a constant
    expect(raceCount()).toBe(DEFAULT_RACE_COUNT);
    expect(raceCount([])).toBe(DEFAULT_RACE_COUNT);
    expect(DEFAULT_RACE_COUNT).toBe(2);
  });

  it('falls back rather than believing a number that cannot be a count', () => {
    // Half a parent is not something the blend can divide by, and a negative count has no reading
    // at all — the seed is a better answer than either
    const fractional = withCount(2.5);
    const negative = withCount(-1);
    const unreadable = withCount(Number.NaN);

    expect(raceCount(fractional)).toBe(DEFAULT_RACE_COUNT);
    expect(raceCount(negative)).toBe(DEFAULT_RACE_COUNT);
    expect(raceCount(unreadable)).toBe(DEFAULT_RACE_COUNT);
  });
});

describe('racesRequired — how many a character must carry', () => {
  it('is the dial when the ruleset offers races', () => {
    const offered = [race('a'), race('b')];
    const seeded = { races: offered };
    const fourfold = { races: offered, constants: withCount(4) };

    expect(racesRequired(seeded)).toBe(2);
    expect(racesRequired(fourfold)).toBe(4);
  });

  it('is none when the ruleset offers no races at all', () => {
    // v1.0 Req 11.2's raceless character. A fresh ruleset starts with an empty race list, so a
    // rule that demanded two picks from it would make a brand new ruleset unplayable.
    const empty = { races: [] };
    const emptyButAsking = { races: [], constants: withCount(3) };

    expect(racesRequired(empty)).toBe(0);
    expect(racesRequired(emptyButAsking)).toBe(0);
  });

  it('still asks for the full count from a ruleset with only one race', () => {
    // Not an exception: one race and a count of two is a pure-blood, which is the whole ruling
    const lonely = { races: [race('only')] };

    expect(racesRequired(lonely)).toBe(2);
  });
});

describe('resolveRaces — the picks, in order, duplicates kept, capped at the count', () => {
  const ruleset = { races: [race('a'), race('b'), race('c')] };

  it('keeps a race picked more than once', () => {
    const resolved = resolveRaces(ruleset, ['a', 'a']);
    const ids = resolved.map((one) => one.id);

    expect(ids).toEqual(['a', 'a']);
  });

  it('follows the pick order rather than the ruleset’s order', () => {
    const resolved = resolveRaces(ruleset, ['c', 'a']);
    const ids = resolved.map((one) => one.id);

    expect(ids).toEqual(['c', 'a']);
  });

  it('drops a pick the ruleset no longer defines', () => {
    // The ruleset alone decides what exists (TICKET-REF-02) — a deleted race contributes nothing
    const resolved = resolveRaces(ruleset, ['a', 'deleted']);
    const ids = resolved.map((one) => one.id);

    expect(ids).toEqual(['a']);
  });

  it('answers nothing for no picks', () => {
    expect(resolveRaces(ruleset, [])).toEqual([]);
  });

  it('caps a character stored at a higher count than the ruleset now asks for', () => {
    // The case that made the cap belong here rather than only in the blend: `race_count` is a dial,
    // so lowering a live ruleset from 3 to 2 turns every seated 3-pick character into this. The
    // sheet's `raceNames` reads this list, so an uncapped answer would name three and blend two.
    const lowered = resolveRaces(ruleset, ['a', 'b', 'c']);
    const raised = resolveRaces({ ...ruleset, constants: withCount(3) }, ['a', 'b', 'c']);

    expect(lowered.map((one) => one.id)).toEqual(['a', 'b']);
    expect(raised.map((one) => one.id)).toEqual(['a', 'b', 'c']);
  });

  it('drops unresolvable picks before capping, so a deleted race eats no slot', () => {
    const resolved = resolveRaces(ruleset, ['deleted', 'a', 'b']);
    const ids = resolved.map((one) => one.id);

    expect(ids).toEqual(['a', 'b']);
  });
});

describe('the count lives in exactly one place', () => {
  const SOURCE_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../');

  /**
   * The four modules that spelled *at most 2* before this ticket
   *
   * Read directly rather than through a walk of `src/`, which is what
   * `client/components/config/races/challengeRate.test.ts` does for a different claim: that scan
   * exists because *any* module could start reading a field, while this claim is about four named
   * ones — and `npx tsc --noEmit` already fails on anything that imports a constant that no longer
   * exists, so a walk would only be re-proving the typechecker.
   */
  const FORMER_CALL_SITES = [
    'shared/engine/calculators/statCalculator.ts',
    'shared/services/characterCreation.ts',
    'client/stores/characterStore.ts',
    'client/components/play/creation/useCharacterCreation.ts',
  ];

  it.each(FORMER_CALL_SITES)('%s names no MAX_RACE_COUNT and reads the ruleset', (relative) => {
    const path = join(SOURCE_ROOT, relative);
    const source = readFileSync(path, 'utf8');

    expect(source).not.toContain('MAX_RACE_COUNT');
    // Relative within `shared/`, aliased from `client/` — either way it is this module
    expect(source).toMatch(/from '(#shared|\.\.)(\/engine)?\/races'/);
  });

  it('is written as a literal nowhere but this module', () => {
    // `race_count` the *string* is the constant's name, and only its reader may spell it: a second
    // module resolving the constant itself would be the drift this ticket deleted, arriving back
    const path = join(SOURCE_ROOT, 'shared/engine/races.ts');
    const reader = readFileSync(path, 'utf8');

    expect(reader).toContain(`'${RACE_COUNT_NAME}'`);

    for (const relative of FORMER_CALL_SITES) {
      const callSite = join(SOURCE_ROOT, relative);
      const source = readFileSync(callSite, 'utf8');
      expect(source).not.toContain(`'${RACE_COUNT_NAME}'`);
    }
  });
});
