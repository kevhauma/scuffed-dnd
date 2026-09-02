/**
 * Binding the quick actions to the store, for the actor who has them (TICKET-DM-03)
 *
 * [`quickActions.ts`](../shared/quickActions.ts) decides *what the actions are* from the Snapshot;
 * this decides *which store action each one reaches* and *who is allowed to press it*. The split is
 * the ROLL-01/ROLL-02 one the ticket names: a derivation that knows no React, and a hook that knows
 * no ruleset.
 *
 * **It returns `null` for anyone who is not the table's DM** —
 * [`usePurseControls`](../sheet/usePurseControls.ts)' shape, and v3 Req 49.10's *absent, not present
 * and disabled*. The predicate is [`useIsDungeonMaster`](./useIsDungeonMaster.ts), which is the thing
 * the three DM surfaces genuinely share; what this hook subscribes to is **its own six selectors and
 * nothing else**, which is the rule DM-02 arrived at after a bundle of every DM action was rejected
 * for making each caller subscribe to writes it never makes.
 *
 * ## The gate and the bindings are two exports since TICKET-DM-04
 *
 * `useIsDungeonMaster` answers from `characterStore.tableCharacter` — *the* character open at a table
 * — and the session roster has **no** character open: it draws twenty of them from a listing. So the
 * roster cannot reuse that predicate, and making it try would have meant either widening the store's
 * meaning of *open* or subscribing every row to selectors it never reads (the bundle DM-02 rejected).
 *
 * The split is therefore of *subjects*, not a workaround: {@link useQuickActionBindings} is **what
 * each action sends**, which is identical on both surfaces, and {@link useQuickActions} is that plus
 * **who may press it**, answered from the store. The roster answers the same question from its member
 * listing and gates its own rendering — one rule read from the two sources that can each see it, with
 * `rosterQuickActions.test.tsx` asserting the two agree for the same reader and character. Every one
 * of these requests is refused by `requireCharacterDM` regardless of what any browser drew, which is
 * the half of v3 Req 49.10 that does not depend on a client being right.
 *
 * ## Every action is a shortcut to a route that already exists
 *
 * v3 Req 49.3, and {@link QuickActionControls.requests} is that claim in a form a test can read.
 * Five of the six reach DM-01/DM-02 routes untouched. The sixth, `dm-adjust-resource`, is the one
 * route TICKET-DM-03 added — see
 * [`dmAdjustResource.ts`](../../../../server/routes/dm/dmAdjustResource.ts) for why a second caller
 * of `adjustResourceValue` is not the private mechanism that requirement forbids, and the ticket's
 * *Decided while building* for the correction it owed the overview.
 *
 * ## Two shapes of write, and why they differ
 *
 * - **A resource moves by a delta.** Nothing here reads the pool, so *take 7 off them* is seven off
 *   whatever the pool turned out to be — TICKET-RES-03's rule, unbroken: the delta lands on what is
 *   **stored**, so a current left above a fallen maximum loses exactly what was asked for and stays
 *   flagged rather than being rewritten.
 * - **A point grant moves by a total**, because `dm-grant-points` takes one — deliberately, so two
 *   overlapping adjustments cannot compound (TICKET-DM-01). *Give 5* is therefore
 *   `grantedStatPoints + 5` computed here, and **that is not the stale read the resource delta
 *   avoids**: the grant is a number the DM is looking at on the same card, it moves only when a DM
 *   moves it, and the store swallows a second write while one is in flight. A pool moves when
 *   anything at the table happens to the character, which is the difference.
 *
 * **Validates: v3 Req 49.3, 49.4, 49.5, 49.6, 49.10; Requirements 14.3, 14.4**
 */

import { useState } from 'react';
import type { CharacterAdjustment, DmAction } from '#shared/types/api';
import { DM_ACTION } from '#shared/types/api';
import { useCharacterStore } from '../../../stores/characterStore';
import type { QuickAction, QuickActionKind } from '../shared/quickActions';
import { inverseOf, isSendableAmount, QUICK_ACTION_KIND } from '../shared/quickActions';
import type { AdjustmentVocabulary } from './adjustmentVocabulary';
import { describeAdjustment } from './describeAdjustment';
import { useIsDungeonMaster } from './useIsDungeonMaster';

/** What the sidebar calls, or `null` for a reader who has no quick actions */
export interface QuickActionControls {
  /** True while an adjustment is on the wire — the store swallows a second write until it lands */
  isBusy: boolean;
  /** Apply one action with an amount, which must be a positive whole quantity */
  apply: (action: QuickAction, amount: number) => void;
  /**
   * What the last accepted action did, as the Event recorded it — `null` until one lands
   *
   * v3 Req 49.5's first half. **Read off the Event rather than computed here**, which is what makes
   * it a before → after of what actually happened: a restore that clamped says so, because
   * `describeAdjustment` reads the pair the server wrote. A refusal leaves this `null` and the
   * sheet's own banner carries the server's sentence, so the surface stays on the pre-action state.
   */
  outcome: string | null;
  /**
   * Undo the last accepted action by applying its inverse — `null` when there is nothing to undo
   *
   * **An inverse, not a restoration** (v3 Req 49.6). It sends the same amount through the opposite
   * action and the same route, so it is refused exactly when that action would be — an undo of an
   * award that would take experience below zero is refused in the server's own words, like any other
   * deduction. What it does **not** do is put the character back where they were: a restore clamps at
   * the maximum, and a maximum that has fallen since means the two genuinely differ. The sidebar says
   * so beside the button.
   */
  undo: (() => void) | null;
  /**
   * Which named intent each kind of action sends (v3 Req 49.3)
   *
   * **The enumeration the acceptance criterion asks for, taken off the same table the sends come from
   * so the two cannot drift.** A test walks it and asserts every value is a route `apiRouter` already
   * answers — see [`quickActionRoutes.test.ts`](./quickActionRoutes.test.ts). TICKET-DM-04's roster
   * reads it for the same reason.
   */
  requests: Record<QuickActionKind, DmAction>;
}

/** What was last asked for, so its inverse can be built and its Event recognised */
interface LastAction {
  /**
   * Whose sheet it was asked against
   *
   * **Not redundant with the hook's own parameter, and leaving it out was a real bug.**
   * `routes/play/character.$id.tsx` renders `<CharacterSheet characterId={id} />` with **no `key`**,
   * so a route param change reuses the instance and this state survives it. Without the id, an action
   * recorded against one character could be undone against the next one opened — silently, and the
   * undo writes to the wrong sheet. `seq` cannot stand in for it: it is **session**-scoped, so the
   * new character's feed will very plausibly clear the mark on its own. TICKET-DM-04 puts this hook
   * on a roster, where several characters are on screen at once, so the guard matters twice.
   */
  characterId: string;
  kind: QuickActionKind;
  statId: string | null;
  amount: number;
  /**
   * The newest Event seq at the moment it was sent
   *
   * How *my action landed* is told from *an older row is still newest*: the adjustment feed re-reads
   * whenever the sheet changes, so a row above this mark is the one this action wrote.
   */
  sinceSeq: number;
}

/** One kind's write, bound to a character and an actor */
type Send = (amount: number, statId: string | null) => void;

/** Every kind's write and the intent it sends, in one table so neither can be added without the other */
interface Binding {
  request: DmAction;
  send: Send;
}

/**
 * Project the bindings table down to the intents alone
 *
 * **The keys come from `QUICK_ACTION_KIND` rather than from a second literal**, so the enumeration
 * {@link QuickActionControls.requests} promises is genuinely one table read twice and not two tables
 * that agree today. The review found the first version listing all six keys again — safe, because the
 * `Record` annotation makes an omission a compile error, but a copy nonetheless, and the docblock
 * claimed there wasn't one.
 *
 * The cast undoes `Object.fromEntries`' key widening, which is a TypeScript limitation rather than a
 * modelling one: it returns `{ [k: string]: T }` for any iterable of pairs, however precisely the
 * keys are typed going in.
 */
function requestsFrom(
  bindings: Record<QuickActionKind, Binding>
): Record<QuickActionKind, DmAction> {
  const kinds = Object.values(QUICK_ACTION_KIND);
  const entries = kinds.map((kind) => [kind, bindings[kind].request]);

  return Object.fromEntries(entries) as Record<QuickActionKind, DmAction>;
}

/**
 * The Event the last action wrote, or `null` while it has not landed (v3 Req 49.5)
 *
 * A pure function outside the hook, for the reason `pointBudgetView.ts` is one: it is the part with
 * the reasoning in it, and a hook that inlined its four conditions was the shape `fallow` measured
 * `useDmControls` over the threshold for at TICKET-DM-02.
 *
 * **A refusal is excluded rather than merely unmatched.** The store clears `actionError` on the way
 * out and sets it on a refusal, so a non-null one means the write did not happen — and the surface
 * has to stay on the pre-action state rather than reporting the last thing that did.
 *
 * **So is an action asked against a different character** — see {@link LastAction.characterId}. This
 * is the function that owns *did my action land*, so it is the one place that question is answered,
 * and *landed on somebody else's sheet* is not a yes.
 *
 * @param last What was asked for, or `null` when nothing has been
 * @param characterId The sheet being drawn now
 * @param newest The most recent adjustment on this sheet, or `undefined` when there are none
 * @param actionError The server's sentence for the last refusal, or `null`
 * @returns The Event this action wrote, or `null`
 */
function landedSince(
  last: LastAction | null,
  characterId: string,
  newest: CharacterAdjustment | undefined,
  actionError: string | null
): CharacterAdjustment | null {
  if (last === null || actionError !== null || newest === undefined) return null;
  if (last.characterId !== characterId) return null;

  return newest.seq > last.sinceSeq ? newest : null;
}

/**
 * What each quick action sends, for a reader who has already been found allowed (TICKET-DM-04)
 *
 * **The bindings without the gate.** Both placements of the quick actions share every line of this —
 * the six store actions, the delta-versus-total distinction, the *did my action land* mark and the
 * inverse — and differ only in how they know whether the reader is the table's DM. See the module
 * note for why that question cannot be asked the same way twice.
 *
 * **Call {@link useQuickActions} unless the surface has already answered it**: this one hands out live
 * controls to whoever asks, and the answer to *who is asking* is the caller's to have made.
 *
 * @param characterId Whose sheet the actions act on
 * @param adjustments That character's adjustments, newest first — for the outcome and the undo
 * @param words How this ruleset spells what an adjustment names
 * @param grantedPoints What the DM has already granted, which a give or take is a total upon
 * @returns The controls
 */
export function useQuickActionBindings(
  characterId: string,
  adjustments: CharacterAdjustment[],
  words: AdjustmentVocabulary,
  grantedPoints: number
): QuickActionControls {
  const isBusy = useCharacterStore((state) => state.isActing);
  const actionError = useCharacterStore((state) => state.actionError);

  const dmAdjustResource = useCharacterStore((state) => state.dmAdjustResource);
  const dmSetGrantedPoints = useCharacterStore((state) => state.dmSetGrantedPoints);
  const dmAwardExperience = useCharacterStore((state) => state.dmAwardExperience);
  const dmDeductExperience = useCharacterStore((state) => state.dmDeductExperience);

  const [last, setLast] = useState<LastAction | null>(null);

  /*
   * `Record<QuickActionKind, Binding>` for {@link describeAdjustment}'s reason: a seventh kind
   * without a binding fails to compile, and so does a binding for a kind that no longer exists.
   */
  const bindings: Record<QuickActionKind, Binding> = {
    [QUICK_ACTION_KIND.DAMAGE]: {
      request: DM_ACTION.ADJUST_RESOURCE,
      send: (amount, statId) => {
        if (statId === null) return;
        dmAdjustResource(characterId, statId, -amount);
      },
    },
    [QUICK_ACTION_KIND.RESTORE]: {
      request: DM_ACTION.ADJUST_RESOURCE,
      send: (amount, statId) => {
        if (statId === null) return;
        dmAdjustResource(characterId, statId, amount);
      },
    },
    // A total, not a delta — see the module note on why this read-modify-write is not the stale read
    // the pair above avoids
    [QUICK_ACTION_KIND.GIVE_POINTS]: {
      request: DM_ACTION.GRANT_POINTS,
      send: (amount) => dmSetGrantedPoints(characterId, grantedPoints + amount),
    },
    [QUICK_ACTION_KIND.TAKE_POINTS]: {
      request: DM_ACTION.GRANT_POINTS,
      send: (amount) => dmSetGrantedPoints(characterId, grantedPoints - amount),
    },
    [QUICK_ACTION_KIND.AWARD_EXPERIENCE]: {
      request: DM_ACTION.AWARD_EXPERIENCE,
      send: (amount) => dmAwardExperience(characterId, amount),
    },
    [QUICK_ACTION_KIND.DEDUCT_EXPERIENCE]: {
      request: DM_ACTION.DEDUCT_EXPERIENCE,
      send: (amount) => dmDeductExperience(characterId, amount),
    },
  };

  const newest = adjustments[0];
  const landed = landedSince(last, characterId, newest, actionError);

  const send = (kind: QuickActionKind, statId: string | null, amount: number) => {
    // Not a rule — the Kernel owns what an amount may be — and not the row's own check either: this
    // guards the **preset** path and TICKET-DM-04's roster, neither of which goes through a box.
    // Shared with the row rather than written twice, which is what the review asked for.
    if (!isSendableAmount(amount)) return;

    const mark = newest?.seq ?? 0;
    setLast({ characterId, kind, statId, amount, sinceSeq: mark });

    bindings[kind].send(amount, statId);
  };

  const requests = requestsFrom(bindings);

  const undoLast = () => {
    if (last === null) return;

    const inverse = inverseOf(last.kind);
    send(inverse, last.statId, last.amount);
  };

  return {
    isBusy,
    apply: (action: QuickAction, amount: number) => send(action.kind, action.statId, amount),
    outcome: landed === null ? null : describeAdjustment(landed, words),
    undo: landed === null ? null : undoLast,
    requests,
  };
}

/**
 * The quick actions for the sheet's sidebar — the bindings, and only for the table's DM
 *
 * {@link useQuickActionBindings} plus the gate, which on this surface is
 * [`useIsDungeonMaster`](./useIsDungeonMaster.ts)'s comparison against the one character the store
 * holds open. `null` for everybody else, so the sidebar is **absent rather than disabled**
 * (v3 Req 49.10): a disabled control tells a Player a power exists and invites a request to use it.
 *
 * @param characterId Whose sheet
 * @param adjustments That character's adjustments, newest first
 * @param words How this ruleset spells what an adjustment names
 * @param grantedPoints What the DM has already granted
 * @returns The controls, or `null` for a reader who has no quick actions
 */
export function useQuickActions(
  characterId: string,
  adjustments: CharacterAdjustment[],
  words: AdjustmentVocabulary,
  grantedPoints: number
): QuickActionControls | null {
  const isDungeonMaster = useIsDungeonMaster(characterId);
  const controls = useQuickActionBindings(characterId, adjustments, words, grantedPoints);

  if (!isDungeonMaster) return null;

  return controls;
}
