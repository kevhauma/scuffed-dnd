/**
 * The words the adjustment log reads (TICKET-PAS-01)
 *
 * `describeAdjustment.test.ts`'s other half. That file asserts the sentence; this one asserts the
 * lookup it is built from, and the two cases worth having a file for are the ones a component test
 * would never reach: **the passives come from the catalog rather than from the character**, so an
 * ability revoked five minutes ago still reads by name in the row that revoked it, and **the two
 * kinds share one map**, which is only safe because every id is a UUID.
 *
 * **Validates: v3 Req 42.6, 42.7; v4 systems/14**
 */

import { describe, expect, it } from 'vitest';
import type { Configuration } from '#shared/types/config';
import { adjustmentNamesFrom } from './adjustmentNames';

/** A ruleset whose catalog holds two passives */
const RULES = {
  passives: [
    { id: 'passive-blindsight', name: 'Blindsight', effectText: '' },
    { id: 'passive-charmed', name: 'Charm immunity', effectText: '' },
  ],
} as unknown as Configuration;

/** The stat rows the sheet is rendering */
const STATS = [
  { id: 'stat-health', name: 'Health' },
  { id: 'stat-mana', name: 'Mana' },
];

describe('adjustmentNamesFrom', () => {
  it('spells every stat the sheet is rendering', () => {
    const names = adjustmentNamesFrom(RULES, STATS);

    expect(names['stat-health']).toBe('Health');
    expect(names['stat-mana']).toBe('Mana');
  });

  it('spells every passive in the catalog, not merely the ones a character holds', () => {
    // The whole reason this reads the catalog: a revoked ability is gone from the character and
    // still has a row in the log, and *"Took back the passive 9f3c…"* would be unreadable
    const names = adjustmentNamesFrom(RULES, STATS);

    expect(names['passive-blindsight']).toBe('Blindsight');
    expect(names['passive-charmed']).toBe('Charm immunity');
  });

  it('carries both kinds in one map, which is safe because every id is a UUID', () => {
    const names = adjustmentNamesFrom(RULES, STATS);

    expect(Object.keys(names)).toHaveLength(4);
  });

  it('names the stats when a ruleset has no catalog at all', () => {
    const names = adjustmentNamesFrom({} as Configuration, STATS);

    expect(names).toEqual({ 'stat-health': 'Health', 'stat-mana': 'Mana' });
  });

  it('answers with the stats alone before a ruleset is loaded', () => {
    // The sheet calls this on every render, including the ones where `config` is still null
    expect(adjustmentNamesFrom(null, STATS)['stat-health']).toBe('Health');
  });

  it('is empty when there is nothing to spell', () => {
    expect(adjustmentNamesFrom(null, [])).toEqual({});
  });

  it('lets a stat win a collision, since the sheet is what an id most likely names', () => {
    // Not reachable with real UUIDs, and pinned so the merge order is a decision rather than an
    // accident: a hand-edited ruleset that reused one id resolves to the row on screen
    const collided = {
      passives: [{ id: 'stat-health', name: 'Not a stat', effectText: '' }],
    } as unknown as Configuration;

    expect(adjustmentNamesFrom(collided, STATS)['stat-health']).toBe('Health');
  });
});
