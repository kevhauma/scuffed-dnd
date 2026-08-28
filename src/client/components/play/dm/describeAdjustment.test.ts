/**
 * How a DM adjustment reads back to a Player (TICKET-DM-01)
 *
 * The case that matters most is `dm-set-level`: what the server wrote was **experience**, and a
 * sentence naming a level here would be the app's only claim that a level is a thing you can store
 * (D9). Every other case is the before/after pair being read the right way round.
 *
 * **Validates: v3 Req 42.2, 42.6, 42.7**
 */

import { describe, expect, it } from 'vitest';
import { type CharacterAdjustment, DM_ACTION, type DmAction } from '#shared/types/api';
import { describeAdjustment } from './describeAdjustment';

/** One adjustment, with everything a case does not care about filled in */
function adjustment(
  action: DmAction,
  before: CharacterAdjustment['before'],
  after: CharacterAdjustment['after'],
  target = ''
): CharacterAdjustment {
  return {
    id: 'event-1',
    seq: 1,
    action,
    target,
    before,
    after,
    at: Date.parse('2026-08-27T12:00:00.000Z'),
    by: 'The DM',
  };
}

const STAT_NAMES = { 'stat-health': 'Health' };

describe('describeAdjustment', () => {
  it('should name the amount awarded as well as the totals either side of it', () => {
    expect(describeAdjustment(adjustment(DM_ACTION.AWARD_EXPERIENCE, 40, 340), STAT_NAMES)).toBe(
      'Awarded 300 experience — 40 → 340'
    );
  });

  it('should read a deduction in the direction it happened', () => {
    expect(describeAdjustment(adjustment(DM_ACTION.DEDUCT_EXPERIENCE, 340, 40), STAT_NAMES)).toBe(
      'Deducted 300 experience — 340 → 40'
    );
  });

  it('should describe a level change as the experience it wrote, never as a level', () => {
    const sentence = describeAdjustment(adjustment(DM_ACTION.SET_LEVEL, 0, 450), STAT_NAMES);

    expect(sentence).toContain('experience at 450');
    expect(sentence).not.toMatch(/level \d/);
  });

  it('should tell a grant from a revocation by which way the number moved', () => {
    expect(describeAdjustment(adjustment(DM_ACTION.GRANT_POINTS, 0, 3), STAT_NAMES)).toContain(
      'Granted'
    );
    expect(describeAdjustment(adjustment(DM_ACTION.GRANT_POINTS, 3, 1), STAT_NAMES)).toContain(
      'Revoked'
    );
  });

  it("should spell a pool by the ruleset's name for it", () => {
    expect(
      describeAdjustment(adjustment(DM_ACTION.SET_RESOURCE, 30, 12, 'stat-health'), STAT_NAMES)
    ).toBe('Set Health to 12 — was 30');
  });

  it('should fall back to the stat id when the ruleset no longer defines it', () => {
    // A stat deleted from the Snapshot since still has a row in the log — the Event is what
    // happened, and editing it is editing the past
    expect(
      describeAdjustment(adjustment(DM_ACTION.SET_RESOURCE, 30, 12, 'stat-gone'), STAT_NAMES)
    ).toContain('stat-gone');
  });
});
