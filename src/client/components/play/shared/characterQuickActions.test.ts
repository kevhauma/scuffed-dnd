/**
 * One character's quick-action source, derived once for both placements (TICKET-DM-04, v3 Req 49.7)
 *
 * `quickActions.test.ts` covers what the *set* is, given a source. This covers what the **source** is,
 * given a character and a Snapshot — the step that lived inside `useCharacterSheet` until the session
 * roster needed the same answer and two derivations became a drift with a date on it.
 *
 * The cross-placement claim itself — *the sheet and the roster produce the same set* — is
 * `sessions/roster/rosterQuickActions.test.tsx`, which asserts it against the two real surfaces rather
 * than against this function called twice.
 *
 * **Validates: v3 Req 49.1, 49.2, 49.7**
 */

import { describe, expect, it } from 'vitest';
import { calculateCharacter } from '#shared/engine/calculator';
import type { Stat } from '#shared/types/config';
import { makeCharacter, makeSnapshot } from '../../sessions/roster/roster.fixtures';
import { quickActionSourceFor, quickActionsForCharacter } from './characterQuickActions';
import { QUICK_ACTION_KIND } from './quickActions';

describe('quickActionSourceFor', () => {
  it('takes its pools from whatever the Snapshot flags, in the ruleset’s own order', () => {
    const character = makeCharacter();
    const config = makeSnapshot();
    const calculated = calculateCharacter(character, config);

    const source = quickActionSourceFor(character, config, calculated);
    const names = source.pools.map((pool) => pool.name);

    // Might is not a resource and is not here; the two that are come in `order`
    expect(names).toEqual(['Vigor', 'Focus']);
  });

  it('reads each pool’s maximum from the engine', () => {
    const character = makeCharacter();
    const config = makeSnapshot();
    const calculated = calculateCharacter(character, config);

    const source = quickActionSourceFor(character, config, calculated);
    const vigor = source.pools[0];

    expect(vigor.max).toBe(40);
  });

  it('reports a pool with no scale as such, rather than as one whose scale is zero', () => {
    // A broken formula gives a maximum that cannot be read. `null` is what makes `poolSteps` offer
    // `1` alone rather than a ladder derived from a number nobody has.
    const base = makeSnapshot();
    const broken: Stat = {
      id: 'stat-ruin',
      name: 'Ruin',
      abbreviation: 'RUI',
      description: '',
      order: 3,
      countsTowardTotal: false,
      isResource: true,
      rounding: 'none',
      formula: 'NOPE * 2',
    };

    const config = makeSnapshot({ stats: [...base.stats, broken] });
    const character = makeCharacter();
    const calculated = calculateCharacter(character, config);

    const source = quickActionSourceFor(character, config, calculated);
    const ruin = source.pools[2];

    expect(ruin.max).toBeNull();
  });

  it('prices the experience preset at what the next level still costs, from where they stand', () => {
    // 300 XP is level 2 on this curve and level 3 costs 900, so what is still owed is 600 — the
    // ruleset's own number rather than a round one somebody liked (TICKET-DM-01's ruling, D9)
    const character = makeCharacter({ experience: 300 });
    const config = makeSnapshot();
    const calculated = calculateCharacter(character, config);

    const source = quickActionSourceFor(character, config, calculated);

    expect(source.experienceStep).toBe(600);
  });

  it('offers no experience preset when the curve cannot price the next level', () => {
    const character = makeCharacter();
    const config = makeSnapshot({ curves: [] });
    const calculated = calculateCharacter(character, config);

    const source = quickActionSourceFor(character, config, calculated);

    expect(source.experienceStep).toBeNull();
  });

  it('offers no experience preset when the curve refuses to price past its top', () => {
    // Concept 06's recommended `outOfRange: 'error'` — silent clamping is how a level-50 character
    // ends up with a level-15 gain and nobody notices. A curve that refuses costs the DM a preset
    // and not the action; the amount box is offered either way.
    const base = makeSnapshot();
    const [curve] = base.curves ?? [];
    const strict = { ...curve, outOfRange: 'error' as const };
    const config = makeSnapshot({ curves: [strict] });
    const character = makeCharacter({ experience: 9_000 });
    const calculated = calculateCharacter(character, config);

    const source = quickActionSourceFor(character, config, calculated);

    expect(source.experienceStep).toBeNull();
  });

  it('extrapolates past the top when the curve is set to (the fixture’s own setting)', () => {
    // The complement, so the case above is pinning the *curve's* rule rather than a coincidence:
    // this ruleset says `extrapolate`, so it can price a next level and the preset is offered
    const character = makeCharacter({ experience: 9_000 });
    const config = makeSnapshot();
    const calculated = calculateCharacter(character, config);

    const source = quickActionSourceFor(character, config, calculated);

    expect(source.experienceStep).not.toBeNull();
  });
});

describe('quickActionsForCharacter', () => {
  it('produces two actions per pool plus the four that move the character', () => {
    const character = makeCharacter();
    const config = makeSnapshot();
    const calculated = calculateCharacter(character, config);

    const actions = quickActionsForCharacter(character, config, calculated);

    // Two pools → four, plus give/take points and award/deduct experience
    expect(actions).toHaveLength(8);
  });

  it('labels each pool action in the ruleset’s own words (v3 Req 49.2)', () => {
    const character = makeCharacter();
    const config = makeSnapshot();
    const calculated = calculateCharacter(character, config);

    const actions = quickActionsForCharacter(character, config, calculated);
    const labels = actions.map((action) => action.label);

    expect(labels).toContain('Damage Vigor');
    expect(labels).toContain('Restore Focus');
  });

  it('offers a pool with no scale the single step alone', () => {
    const base = makeSnapshot();
    const broken: Stat = {
      id: 'stat-ruin',
      name: 'Ruin',
      abbreviation: 'RUI',
      description: '',
      order: 3,
      countsTowardTotal: false,
      isResource: true,
      rounding: 'none',
      formula: 'NOPE * 2',
    };

    const config = makeSnapshot({ stats: [...base.stats, broken] });
    const character = makeCharacter();
    const calculated = calculateCharacter(character, config);

    const actions = quickActionsForCharacter(character, config, calculated);
    const damage = actions.find(
      (action) => action.kind === QUICK_ACTION_KIND.DAMAGE && action.statId === 'stat-ruin'
    );

    expect(damage?.steps).toEqual([1]);
  });
});
