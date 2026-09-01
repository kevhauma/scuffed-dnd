/**
 * One DM adjustment, in a sentence (TICKET-DM-01)
 *
 * A pure mapper, kept out of the component that renders it for
 * [`pointBudgetView.ts`](../shared/pointBudgetView.ts)'s reason: it is the part worth testing
 * directly, and a component test would have to render a card to assert a string.
 *
 * **The Event is the record and this is a reading of it.** Every sentence is built from `before` and
 * `after` — the two numbers `applyPlayerAction` writes on every accepted action (v3 Req 42.6) — so
 * the log can say *what changed* without re-reading the character, and a sheet edited five times
 * since still describes each step correctly.
 *
 * **A `dm-set-level` reads as experience, not as a level**, which is the one place this could have
 * lied. The DM typed a level and the server wrote what the ruleset prices it at
 * ([D9](../../../../../docs/v3.0_backend/overview.md#d9--level-stays-derived-points-to-spend-becomes-a-grant));
 * the level the Player is now at is derived from that total by the sheet beside this panel, and
 * printing a stored one here would be the app's only claim that a level is a thing you can write.
 *
 * ## A table rather than a `switch`, since TICKET-DM-02
 *
 * It was a `switch` with a `never` default while there were eight actions to read. DM-02 took it to
 * fourteen and `fallow` measured it at **23 cyclomatic** — which a flat lookup deserves, because a
 * flat lookup is what it is. {@link SENTENCES} is that lookup said properly: a
 * `Record<DmAction, …>`, which is a **stronger** exhaustiveness check than the `never` it replaces
 * (a missing action fails to compile, and so does one that no longer exists), and it leaves the
 * function that dispatches at a complexity of two.
 *
 * **Validates: v3 Req 42.2, 42.5, 42.6, 42.7, 43.2**
 */

import { type CharacterAdjustment, DM_ACTION, type DmAction } from '#shared/types/api';
import type { AdjustmentVocabulary } from './adjustmentVocabulary';

/**
 * One adjustment with the parts a sentence is built from already read off it
 *
 * Prepared once by {@link describeAdjustment} rather than by each entry below, so a sentence is a
 * template literal and nothing else — which is what makes fifteen of them readable side by side.
 */
interface AdjustmentReading {
  /**
   * Which entity it named, spelled as this ruleset spells it
   *
   * **Falling back to the id is deliberate**: an entity deleted from the Snapshot since still has a
   * row in the log, and *"granted 9f3c…"* is at least a true one.
   */
  entity: string;
  /** What the value was, as a number — 0 for the adjustments that carry an id or nothing */
  before: number;
  after: number;
  /** How this ruleset says an amount of money (v3 Req 43.2) */
  money: (amount: number) => string;
}

/** A before/after value as a number, or 0 for the shapes an adjustment never carries */
function amount(value: CharacterAdjustment['before']): number {
  return typeof value === 'number' ? value : 0;
}

/**
 * What each named adjustment reads as
 *
 * **`Record<DmAction, …>` is the exhaustiveness check.** A sixteenth action without a sentence for
 * it fails to compile here, which is the guarantee the old `switch`'s `never` default gave — plus
 * one it did not: a retired action left behind is a compile error too. TICKET-DM-03's
 * `dm-adjust-resource` is the fifteenth, and this is where the compiler asked for it.
 */
const SENTENCES: Record<DmAction, (reading: AdjustmentReading) => string> = {
  [DM_ACTION.AWARD_EXPERIENCE]: ({ before, after }) =>
    `Awarded ${after - before} experience — ${before} → ${after}`,

  [DM_ACTION.DEDUCT_EXPERIENCE]: ({ before, after }) =>
    `Deducted ${before - after} experience — ${before} → ${after}`,

  // The level is not in the payload and is not stored anywhere; what happened was a write to
  // experience, and that is what this says
  [DM_ACTION.SET_LEVEL]: ({ before, after }) =>
    `Set the level, putting experience at ${after} — was ${before}`,

  [DM_ACTION.GRANT_POINTS]: ({ before, after }) =>
    after >= before
      ? `Granted stat points — ${before} → ${after}`
      : `Revoked stat points — ${before} → ${after}`,

  // Unlike `dm-set-level` above, the number in the payload *is* what was stored — dream level is
  // player state nothing derives (TICKET-RES-04)
  [DM_ACTION.SET_DREAM_LEVEL]: ({ before, after }) => `Set the dream level — ${before} → ${after}`,

  [DM_ACTION.SET_RESOURCE]: ({ entity, before, after }) =>
    `Set ${entity} to ${after} — was ${before}`,

  /*
   * **What actually moved, not what was asked for** (TICKET-DM-03). The delta is not in the payload
   * and deliberately is not: `adjustResourceValue` clamps at the derived maximum, so *restore 20*
   * against a pool four short of full is four points, and printing the 20 would be the log's one
   * claim that a write landed whole when it did not. `after - before` is the truth the Event holds.
   * That is also what makes the quick action's *undo is an inverse, not a restoration* readable — the
   * two rows say different numbers, and they should.
   */
  [DM_ACTION.ADJUST_RESOURCE]: ({ entity, before, after }) =>
    after >= before
      ? `Restored ${after - before} to ${entity} — ${before} → ${after}`
      : `Took ${before - after} off ${entity} — ${before} → ${after}`,

  // Neither before nor after is a number here — they are the id and `null` — so the sentence is
  // built from the entity alone. Reading them as amounts would have said nothing true.
  [DM_ACTION.GRANT_PASSIVE]: ({ entity }) => `Granted the passive ${entity}`,
  [DM_ACTION.REVOKE_PASSIVE]: ({ entity }) => `Took back the passive ${entity}`,

  // Both purse sentences read their amounts through the ruleset's own tiers (v3 Req 43.2), so the
  // log and the purse card say the same words about the same money
  [DM_ACTION.SET_PURSE]: ({ money, before, after }) =>
    `Set the purse — ${money(before)} → ${money(after)}`,

  [DM_ACTION.ADJUST_PURSE]: ({ money, before, after }) =>
    after >= before
      ? `Added ${money(after - before)} to the purse — now ${money(after)}`
      : `Took ${money(before - after)} from the purse — now ${money(after)}`,

  // The **template**, which is what `target` holds; the build's own id is in `after` and names a
  // record only this character has, so the template is the half a reader can be told about
  [DM_ACTION.BUILD_ITEM]: ({ entity }) => `Made ${entity}`,

  /*
   * **The one adjustment whose target cannot be spelled, and it says so rather than guessing.**
   * `target` is a `ComposedItem.id` for a build that stopped existing in the very act this row
   * records, so there is nothing left on the ruleset or on the character to resolve it against.
   * Naming the template instead would need the build the act destroyed, and inventing a name would
   * be worse than the honest sentence.
   */
  [DM_ACTION.DROP_ITEM]: () => 'Took an item out of the pack',

  // `entity` is an `EquipmentSlot.type` here rather than an id — see `adjustmentVocabulary.ts`
  [DM_ACTION.EQUIP_ITEM]: ({ entity }) => `Put an item in ${entity}`,
  [DM_ACTION.UNEQUIP_ITEM]: ({ entity }) => `Took what was in ${entity} off`,
};

/**
 * What one adjustment did, as a line a Player can read
 *
 * **One vocabulary, not one parameter per entity kind** (TICKET-PAS-01, widened by TICKET-DM-02). It
 * was `statNames` while a resource was the only adjustment naming an entity; there are now four
 * kinds of key and an amount of money, and a parameter each would mean every caller deciding which
 * sentence needs which. [`adjustmentVocabulary.ts`](./adjustmentVocabulary.ts) explains why the key
 * spaces cannot collide and why the money phrase is resolved there rather than here.
 *
 * @param adjustment The Event, as the server projected it
 * @param words How this ruleset spells each entity, and how it says an amount of money
 * @returns The sentence
 */
export function describeAdjustment(
  adjustment: CharacterAdjustment,
  words: AdjustmentVocabulary
): string {
  const sentence = SENTENCES[adjustment.action];

  // Unreachable while the wire says `DmAction` and {@link SENTENCES} is exhaustive — kept because
  // the log is *stored history*, and a row written by a version that named an action this one has
  // since retired is a true record rather than a crash
  if (!sentence) return `Adjusted the sheet (${String(adjustment.action)})`;

  const before = amount(adjustment.before);
  const after = amount(adjustment.after);
  const entity = words.names[adjustment.target] ?? adjustment.target;

  return sentence({ entity, before, after, money: words.money });
}
