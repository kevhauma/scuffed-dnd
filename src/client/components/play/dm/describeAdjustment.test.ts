/**
 * How a DM adjustment reads back to a Player (TICKET-DM-01)
 *
 * The case that matters most is `dm-set-level`: what the server wrote was **experience**, and a
 * sentence naming a level here would be the app's only claim that a level is a thing you can store
 * (D9). Every other case is the before/after pair being read the right way round.
 *
 * **TICKET-DM-02 added six**, two of which are worth the file on their own: a **purse** sentence
 * reads its amounts through the ruleset's tiers rather than as bare base-tier integers, so the log
 * and the purse card say the same words about the same money; and **`dm-drop-item` names nothing**,
 * because its target is the id of a build the act destroyed — the honest sentence rather than an
 * invented name.
 *
 * **Validates: v3 Req 42.2, 42.5, 42.6, 42.7, 43.2**
 */

import { describe, expect, it } from 'vitest';
import { type CharacterAdjustment, DM_ACTION, type DmAction } from '#shared/types/api';
import type { AdjustmentVocabulary } from './adjustmentVocabulary';
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

/**
 * The words this ruleset reads an adjustment in
 *
 * **One object across every kind** — stats and passives since TICKET-PAS-01, item templates and
 * equipment slots since TICKET-DM-02, plus the money phrase. Still named `STAT_NAMES` at the call
 * sites below, which are the pre-existing cases left alone under the DX-10 rule.
 *
 * `money` is spelled out rather than reached through `formatPurse` so the cases assert a **fixed**
 * phrasing: what is being tested here is that the sentence says whatever the vocabulary says, and a
 * real formatter would make these cases a second test of `currency.ts`.
 */
const STAT_NAMES: AdjustmentVocabulary = {
  names: {
    'stat-health': 'Health',
    'passive-blindsight': 'Blindsight',
    'item-axe': 'Battleaxe',
    main_hand: 'Main hand',
  },
  money: (amount: number) => `${amount} Gold`,
};

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

  it('should read a dream level as the number that was stored (TICKET-RES-04)', () => {
    const event = adjustment(DM_ACTION.SET_DREAM_LEVEL, 1, 3);
    const sentence = describeAdjustment(event, STAT_NAMES);

    expect(sentence).toBe('Set the dream level — 1 → 3');
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

  it('should name the passive that was handed out, not a number (TICKET-PAS-01)', () => {
    // Neither before nor after is a number here — they are the id and `null` — so a sentence built
    // from `amount()` would have read both as 0 and said nothing true
    const granted = adjustment(
      DM_ACTION.GRANT_PASSIVE,
      null,
      'passive-blindsight',
      'passive-blindsight'
    );

    expect(describeAdjustment(granted, STAT_NAMES)).toBe('Granted the passive Blindsight');
  });

  it('should name the passive that was taken back', () => {
    const revoked = adjustment(
      DM_ACTION.REVOKE_PASSIVE,
      'passive-blindsight',
      null,
      'passive-blindsight'
    );

    expect(describeAdjustment(revoked, STAT_NAMES)).toBe('Took back the passive Blindsight');
  });

  it('should fall back to the id for a passive the ruleset has since lost', () => {
    // A row in the log outlives the entity it names, and *"granted 9f3c…"* is at least a true line
    const granted = adjustment(DM_ACTION.GRANT_PASSIVE, null, 'passive-gone', 'passive-gone');

    expect(describeAdjustment(granted, STAT_NAMES)).toBe('Granted the passive passive-gone');
  });

  it("should read a purse through the ruleset's own tiers, never as a bare stored number", () => {
    /*
     * The whole reason the vocabulary carries a money phrase (TICKET-DM-02). The stored purse is one
     * amount in the base tier and `formatPurse` decides what to call it every render (v3 Req 43.2);
     * a log saying *"30 → 42"* beside a card saying *"4 Gold"* would be the app disagreeing with
     * itself about what somebody is carrying.
     */
    const set = adjustment(DM_ACTION.SET_PURSE, 30, 42);
    const sentence = describeAdjustment(set, STAT_NAMES);

    expect(sentence).toBe('Set the purse — 30 Gold → 42 Gold');
  });

  it('should tell money coming in from money going out, and name what moved', () => {
    const paid = adjustment(DM_ACTION.ADJUST_PURSE, 30, 370);
    const spent = adjustment(DM_ACTION.ADJUST_PURSE, 30, 18);

    const gained = describeAdjustment(paid, STAT_NAMES);
    const lost = describeAdjustment(spent, STAT_NAMES);

    expect(gained).toBe('Added 340 Gold to the purse — now 370 Gold');
    expect(lost).toBe('Took 12 Gold from the purse — now 18 Gold');
  });

  it('should name the template a build was made from, since the build itself is nobody else’s', () => {
    // `target` is the **template**; `after` is the new build's own id, which names a record only
    // this character has and which no reader of the log could resolve
    const made = adjustment(DM_ACTION.BUILD_ITEM, null, 'build-77', 'item-axe');
    const sentence = describeAdjustment(made, STAT_NAMES);

    expect(sentence).toBe('Made Battleaxe');
  });

  it('should say a build was taken away without inventing a name for it', () => {
    /*
     * The one target nothing can spell, and the case that pins the decision: `target` is a
     * `ComposedItem.id` for a build that stopped existing in the act this row records, so there is
     * nothing left on the ruleset or the character to resolve it against. A fabricated name would be
     * worse than the honest sentence — see the route's docblock.
     */
    const dropped = adjustment(DM_ACTION.DROP_ITEM, 'build-77', null, 'build-77');
    const sentence = describeAdjustment(dropped, STAT_NAMES);

    expect(sentence).toBe('Took an item out of the pack');
    expect(sentence).not.toContain('build-77');
  });

  it("should name an equipment slot by the ruleset's word for it, not by its slug", () => {
    // `target` here is an `EquipmentSlot.type` — a slug the User writes — rather than a UUID, which
    // is the widening `adjustmentVocabulary.ts` documents
    const worn = adjustment(DM_ACTION.EQUIP_ITEM, null, 'build-77', 'main_hand');
    const taken = adjustment(DM_ACTION.UNEQUIP_ITEM, 'build-77', null, 'main_hand');

    const put = describeAdjustment(worn, STAT_NAMES);
    const removed = describeAdjustment(taken, STAT_NAMES);

    expect(put).toBe('Put an item in Main hand');
    expect(removed).toBe('Took what was in Main hand off');
  });

  it('should fall back to the slug for a slot the ruleset has since retired', () => {
    // Requirement 12.4's slots are the User's to delete, and a row in the log outlives one
    const worn = adjustment(DM_ACTION.EQUIP_ITEM, null, 'build-77', 'third_hand');
    const sentence = describeAdjustment(worn, STAT_NAMES);

    expect(sentence).toBe('Put an item in third_hand');
  });
});
