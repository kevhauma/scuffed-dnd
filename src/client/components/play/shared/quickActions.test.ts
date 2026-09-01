/**
 * The quick-action set is derived, not written down (TICKET-DM-03, v3 Req 49.1, 49.2)
 *
 * The claim under test is v1.0 Req 20 applied to the DM's cockpit: **this app has no notion of health
 * or mana**, so a ruleset naming its pools *Vigor* and *Focus* gets *Damage Vigor* and *Restore
 * Focus*, and adding a fourth pool produces two more actions with nothing recompiled but the data.
 * The fixtures below deliberately use names no reader would guess at, because a fixture called
 * `Health` would let a hard-coded label pass.
 *
 * The preset ladders are the other half: derived from each action's own scale, and **absent rather
 * than invented** where the Snapshot cannot supply one.
 *
 * **Validates: v3 Req 49.1, 49.2, 49.4, 49.6; Requirements 20.1-20.5**
 */

import { describe, expect, it } from 'vitest';
import type { QuickAction, QuickActionSource } from './quickActions';
import { inverseOf, QUICK_ACTION_KIND, quickActionsFor } from './quickActions';

/** A source with no pools and no priceable curve — the least a ruleset can supply */
const BARE: QuickActionSource = { pools: [], experienceStep: null };

/** Every label the set produced, in order */
function labelsOf(actions: QuickAction[]): string[] {
  return actions.map((entry) => entry.label);
}

/** The actions naming one pool, whichever kinds they are */
function forPool(actions: QuickAction[], statId: string): QuickAction[] {
  return actions.filter((entry) => entry.statId === statId);
}

/** The one action of a kind that moves the character rather than a pool */
function ofKind(actions: QuickAction[], kind: QuickAction['kind']): QuickAction {
  const found = actions.find((entry) => entry.kind === kind && entry.statId === null);

  if (!found) throw new Error(`no ${kind} action in the set`);

  return found;
}

describe('quickActionsFor', () => {
  it('should produce one damage and one restore per resource stat, labelled from that stat’s own name', () => {
    const source: QuickActionSource = {
      pools: [
        { id: 'stat-vigor', name: 'Vigor', max: 40 },
        { id: 'stat-focus', name: 'Focus', max: 20 },
        { id: 'stat-grit', name: 'Grit', max: 12 },
      ],
      experienceStep: null,
    };

    const actions = quickActionsFor(source);
    const labels = labelsOf(actions);
    const resourceActions = actions.filter((entry) => entry.statId !== null);

    expect(resourceActions).toHaveLength(6);
    expect(labels).toContain('Damage Vigor');
    expect(labels).toContain('Restore Vigor');
    expect(labels).toContain('Damage Focus');
    expect(labels).toContain('Restore Focus');
    expect(labels).toContain('Damage Grit');
    expect(labels).toContain('Restore Grit');
  });

  it('should produce two more actions when the ruleset names a fourth resource, with nothing else changed', () => {
    // The whole of v1.0 Req 20 in one case: the *data* gained a pool and the action set grew
    const three: QuickActionSource = {
      pools: [
        { id: 'stat-vigor', name: 'Vigor', max: 40 },
        { id: 'stat-focus', name: 'Focus', max: 20 },
        { id: 'stat-grit', name: 'Grit', max: 12 },
      ],
      experienceStep: null,
    };
    const four: QuickActionSource = {
      pools: [...three.pools, { id: 'stat-breath', name: 'Breath', max: 8 }],
      experienceStep: null,
    };

    const before = quickActionsFor(three);
    const after = quickActionsFor(four);
    const grown = after.length - before.length;
    const newLabels = labelsOf(after);

    expect(grown).toBe(2);
    expect(newLabels).toContain('Damage Breath');
    expect(newLabels).toContain('Restore Breath');
  });

  it('should produce no resource action at all for a ruleset with no pools', () => {
    // A ruleset may flag nothing `isResource`, and the four that move the character still stand
    const actions = quickActionsFor(BARE);
    const resourceActions = actions.filter((entry) => entry.statId !== null);

    expect(resourceActions).toHaveLength(0);
    expect(actions).toHaveLength(4);
  });

  it('should always offer give and take points and award and deduct experience', () => {
    const actions = quickActionsFor(BARE);
    const kinds = actions.map((entry) => entry.kind);

    expect(kinds).toContain(QUICK_ACTION_KIND.GIVE_POINTS);
    expect(kinds).toContain(QUICK_ACTION_KIND.TAKE_POINTS);
    expect(kinds).toContain(QUICK_ACTION_KIND.AWARD_EXPERIENCE);
    expect(kinds).toContain(QUICK_ACTION_KIND.DEDUCT_EXPERIENCE);
  });

  it('should derive a pool’s steps from that pool’s own maximum', () => {
    const source: QuickActionSource = {
      pools: [{ id: 'stat-vigor', name: 'Vigor', max: 40 }],
      experienceStep: null,
    };

    const actions = quickActionsFor(source);
    const [damage] = forPool(actions, 'stat-vigor');

    // 1, a tenth of 40, a quarter of 40
    expect(damage?.steps).toEqual([1, 4, 10]);
  });

  it('should collapse a small pool’s ladder rather than offering the same amount twice', () => {
    // A pool that maxes at 8 prices its tenth and its quarter at 1 and 2; one button each is the
    // honest rendering, and three buttons reading 1 / 1 / 2 is not
    const source: QuickActionSource = {
      pools: [{ id: 'stat-breath', name: 'Breath', max: 8 }],
      experienceStep: null,
    };

    const actions = quickActionsFor(source);
    const [damage] = forPool(actions, 'stat-breath');

    expect(damage?.steps).toEqual([1, 2]);
  });

  it('should offer one alone when a pool’s maximum cannot be read', () => {
    // A pool whose formula did not evaluate has no scale to derive from — the sheet chips the value
    // and this offers the atom rather than a guessed ladder
    const source: QuickActionSource = {
      pools: [{ id: 'stat-vigor', name: 'Vigor', max: null }],
      experienceStep: null,
    };

    const actions = quickActionsFor(source);
    const [damage] = forPool(actions, 'stat-vigor');

    expect(damage?.steps).toEqual([1]);
  });

  it('should give damage and restore the same ladder, because they move the same pool', () => {
    const source: QuickActionSource = {
      pools: [{ id: 'stat-vigor', name: 'Vigor', max: 40 }],
      experienceStep: null,
    };

    const actions = quickActionsFor(source);
    const [damage, restore] = forPool(actions, 'stat-vigor');

    expect(restore?.steps).toEqual(damage?.steps);
  });

  it('should price the experience presets at what the ruleset says the next level costs', () => {
    const source: QuickActionSource = { pools: [], experienceStep: 300 };

    const actions = quickActionsFor(source);
    const award = ofKind(actions, QUICK_ACTION_KIND.AWARD_EXPERIENCE);
    const deduct = ofKind(actions, QUICK_ACTION_KIND.DEDUCT_EXPERIENCE);

    expect(award.steps).toEqual([300]);
    expect(deduct.steps).toEqual([300]);
  });

  it('should offer no experience preset at all when the curve cannot price the next level', () => {
    // TICKET-DM-01's precedent: a curve that would extrapolate a confident wrong answer is refused
    // rather than guessed at. Typed entry is still offered, so this costs a preset and not the action
    const actions = quickActionsFor(BARE);
    const award = ofKind(actions, QUICK_ACTION_KIND.AWARD_EXPERIENCE);

    expect(award.steps).toEqual([]);
  });

  it('should offer a single point as the only point preset', () => {
    // A point is the ruleset's own unit; any larger step would be a guess about a ruleset nobody has
    // seen, which is what the ticket's note asks this file to record
    const actions = quickActionsFor(BARE);
    const give = ofKind(actions, QUICK_ACTION_KIND.GIVE_POINTS);

    expect(give.steps).toEqual([1]);
  });

  it('should give every action an id unique across the whole set', () => {
    const source: QuickActionSource = {
      pools: [
        { id: 'stat-vigor', name: 'Vigor', max: 40 },
        { id: 'stat-focus', name: 'Focus', max: 20 },
      ],
      experienceStep: 300,
    };

    const actions = quickActionsFor(source);
    const ids = actions.map((entry) => entry.id);
    const unique = new Set(ids);

    expect(unique.size).toBe(actions.length);
  });

  it('should let two pools share a name without colliding, because the id is the stat’s', () => {
    // A User may name two stats the same thing; the sheet's own rule is that only an abbreviation and
    // a combat code are unique. Two identical labels are the ruleset's business, two identical keys
    // would be this module's bug
    const source: QuickActionSource = {
      pools: [
        { id: 'stat-a', name: 'Vigor', max: 40 },
        { id: 'stat-b', name: 'Vigor', max: 40 },
      ],
      experienceStep: null,
    };

    const actions = quickActionsFor(source);
    const ids = actions.map((entry) => entry.id);
    const unique = new Set(ids);

    expect(unique.size).toBe(actions.length);
  });

  it('should pair every action with the action that undoes it', () => {
    const source: QuickActionSource = {
      pools: [{ id: 'stat-vigor', name: 'Vigor', max: 40 }],
      experienceStep: 300,
    };

    const actions = quickActionsFor(source);
    const pairs = actions.map((entry) => [entry.kind, entry.inverse]);

    expect(pairs).toEqual([
      [QUICK_ACTION_KIND.DAMAGE, QUICK_ACTION_KIND.RESTORE],
      [QUICK_ACTION_KIND.RESTORE, QUICK_ACTION_KIND.DAMAGE],
      [QUICK_ACTION_KIND.GIVE_POINTS, QUICK_ACTION_KIND.TAKE_POINTS],
      [QUICK_ACTION_KIND.TAKE_POINTS, QUICK_ACTION_KIND.GIVE_POINTS],
      [QUICK_ACTION_KIND.AWARD_EXPERIENCE, QUICK_ACTION_KIND.DEDUCT_EXPERIENCE],
      [QUICK_ACTION_KIND.DEDUCT_EXPERIENCE, QUICK_ACTION_KIND.AWARD_EXPERIENCE],
    ]);
  });
});

describe('inverseOf', () => {
  it('should undo an inverse back to the action it undid', () => {
    // Every kind is in a pair, so applying it twice is the identity — which is what makes *undo the
    // undo* a thing the DM can do rather than a dead end
    const kinds = Object.values(QUICK_ACTION_KIND);
    const roundTripped = kinds.map((kind) => {
      const once = inverseOf(kind);

      return inverseOf(once);
    });

    expect(roundTripped).toEqual(kinds);
  });
});
