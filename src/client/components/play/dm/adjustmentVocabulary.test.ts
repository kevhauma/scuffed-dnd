/**
 * The words the adjustment log reads (TICKET-PAS-01, widened by TICKET-DM-02)
 *
 * `describeAdjustment.test.ts`'s other half. That file asserts the sentence; this one asserts the
 * lookup it is built from, and the cases worth having a file for are the ones a component test would
 * never reach: **the catalog entries come from the ruleset rather than from the character**, so an
 * ability revoked five minutes ago still reads by name in the row that revoked it; **four key spaces
 * share one map**, which is safe because nothing can mint a slug that is also a UUID; and **money is
 * a phrase rather than a name**, resolved here so the log and the purse card cannot disagree.
 *
 * **Validates: v3 Req 42.5, 42.6, 42.7, 43.2; v4 systems/14**
 */

import { describe, expect, it } from 'vitest';
import type { Configuration } from '#shared/types/config';
import { adjustmentVocabularyFrom } from './adjustmentVocabulary';

/** A ruleset whose catalog holds two passives, an item template, a slot and two currency tiers */
const RULES = {
  passives: [
    { id: 'passive-blindsight', name: 'Blindsight', effectText: '' },
    { id: 'passive-charmed', name: 'Charm immunity', effectText: '' },
  ],
  items: [{ id: 'item-axe', name: 'Battleaxe' }],
  equipmentSlots: [{ type: 'main_hand', name: 'Main hand', description: '' }],
  currencyTiers: [
    { id: 'tier-silver', name: 'Silver', order: 0, conversionToNext: 10 },
    { id: 'tier-gold', name: 'Gold', order: 1, conversionToNext: 10 },
  ],
} as unknown as Configuration;

/** The stat rows the sheet is rendering */
const STATS = [
  { id: 'stat-health', name: 'Health' },
  { id: 'stat-mana', name: 'Mana' },
];

describe('adjustmentVocabularyFrom', () => {
  it('spells every stat the sheet is rendering', () => {
    const words = adjustmentVocabularyFrom(RULES, STATS);

    expect(words.names['stat-health']).toBe('Health');
    expect(words.names['stat-mana']).toBe('Mana');
  });

  it('spells every passive in the catalog, not merely the ones a character holds', () => {
    // The whole reason this reads the catalog: a revoked ability is gone from the character and
    // still has a row in the log, and *"Took back the passive 9f3c…"* would be unreadable
    const words = adjustmentVocabularyFrom(RULES, STATS);

    expect(words.names['passive-blindsight']).toBe('Blindsight');
    expect(words.names['passive-charmed']).toBe('Charm immunity');
  });

  it('spells an item template, which is what a build adjustment names (TICKET-DM-02)', () => {
    const words = adjustmentVocabularyFrom(RULES, STATS);

    expect(words.names['item-axe']).toBe('Battleaxe');
  });

  it('spells an equipment slot by its type, which is a slug rather than an id', () => {
    // The widening the module's docblock records: the claim is no longer *every key is a UUID* but
    // *the key spaces cannot collide*, because a ruleset cannot mint a slug that is also a UUID
    const words = adjustmentVocabularyFrom(RULES, STATS);

    expect(words.names.main_hand).toBe('Main hand');
  });

  it('carries every kind in one map rather than one per kind', () => {
    const words = adjustmentVocabularyFrom(RULES, STATS);
    const keys = Object.keys(words.names);

    expect(keys).toHaveLength(6);
  });

  it("says an amount of money in the ruleset's own tiers, not as a stored base-tier number", () => {
    /*
     * The purse is one amount in the **base** tier and `formatPurse` decides what to call it every
     * render (v3 Req 43.2). Resolved here rather than in `describeAdjustment` because it is the same
     * job this module already does for an id — turn what the Event stored into what a reader sees.
     */
    const words = adjustmentVocabularyFrom(RULES, STATS);
    const phrase = words.money(340);

    expect(phrase).toBe('34 Gold');
  });

  it('says a bare number when the ruleset defines no currency at all', () => {
    // A ruleset may define no tiers, as it may define no races — `formatPurse`'s own answer rather
    // than a fallback invented here
    const words = adjustmentVocabularyFrom({} as Configuration, STATS);
    const phrase = words.money(340);

    expect(phrase).toBe('340');
  });

  it('names the stats when a ruleset has no catalog at all', () => {
    const words = adjustmentVocabularyFrom({} as Configuration, STATS);

    expect(words.names).toEqual({ 'stat-health': 'Health', 'stat-mana': 'Mana' });
  });

  it('answers with the stats alone before a ruleset is loaded', () => {
    // The sheet calls this on every render, including the ones where `config` is still null
    const words = adjustmentVocabularyFrom(null, STATS);

    expect(words.names['stat-health']).toBe('Health');
  });

  it('is empty when there is nothing to spell', () => {
    const words = adjustmentVocabularyFrom(null, []);

    expect(words.names).toEqual({});
  });

  it('lets a stat win a collision, since the sheet is what an id most likely names', () => {
    // Not reachable with real UUIDs, and pinned so the merge order is a decision rather than an
    // accident: a hand-edited ruleset that reused one id resolves to the row on screen
    const collided = {
      passives: [{ id: 'stat-health', name: 'Not a stat', effectText: '' }],
    } as unknown as Configuration;

    const words = adjustmentVocabularyFrom(collided, STATS);

    expect(words.names['stat-health']).toBe('Health');
  });
});
