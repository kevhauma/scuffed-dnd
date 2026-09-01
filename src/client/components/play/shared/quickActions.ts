/**
 * The Dungeon Master's quick actions, derived from the ruleset (TICKET-DM-03, v3 Req 49.1, 49.2)
 *
 * **This app has no notion of any particular pool**, and this module is where that stops being a
 * slogan. A pool is whatever the User flagged `isResource` (TICKET-STAT-01), so the action set is
 * *computed from the Snapshot*: one **damage** and one **restore** per resource stat, labelled from
 * that stat's own name, plus give/take points and award/deduct experience. A table playing a system
 * whose pools are *Vigor* and *Focus* gets *Damage Vigor* and *Restore Focus* with no code change,
 * and a fourth resource added to the ruleset produces two more actions the same way (v1.0 Req 20).
 *
 * The only English in this file is the six verbs. **Every noun comes from the caller**, which is what
 * makes the derivation checkable rather than merely intended —
 * [`noResourceVocabulary.test.ts`](../dm/noResourceVocabulary.test.ts) greps the whole quick-action
 * path for a hard-coded resource word and fails on one. **That scan does not exempt comments**, which
 * is why this docblock talks around the two words v3 Req 49.2 names rather than quoting them: a
 * comment naming a resource is how the special case creeps back into a derivation with no room for
 * one — somebody reads it beside the code and writes what it seems to invite.
 *
 * ## Why it imports nothing
 *
 * Not even a type. The obvious signature takes the sheet's `StatBreakdown` rows, which live in
 * [`sheet/useCharacterSheet.ts`](../sheet/useCharacterSheet.ts) — and that module already imports
 * `derivedValue.ts` and `pointBudgetView.ts` from this folder, so naming it here would close a
 * `shared/` → `sheet/` → `shared/` cycle that `fallow` reports and that
 * [`AdjustmentField`](./AdjustmentField.tsx) moved into this folder to avoid. {@link QuickActionPool}
 * is the three fields this actually needs, and the caller reads them off whatever it has. **Do not
 * "helpfully" import `StatBreakdown` here.**
 *
 * ## Where the preset amounts come from
 *
 * A judgement call, recorded so the User can disagree with it. Presets are derived from **each
 * action's own scale where the Snapshot supports one, and are absent rather than invented where it
 * does not** — 1/5/10 would be a guess about a ruleset nobody has seen:
 *
 * - **A pool** has a derived maximum, so its steps are `1`, a tenth of it and a quarter of it. A pool
 *   whose formula cannot be evaluated has no scale to read, and offers `1` alone.
 * - **Points** offer `1`. A point is the ruleset's own unit and one of them is not a guess; any
 *   larger step would be.
 * - **Experience** offers what the ruleset prices the character's *next level* at, from where they
 *   stand — and **nothing at all** when the `xp_thresholds` curve cannot say, which is TICKET-DM-01's
 *   "set level to N" precedent: a curve that would extrapolate a confident wrong answer is refused
 *   rather than guessed at.
 *
 * Typed entry is offered on every action regardless, so a refusing curve costs a preset rather than
 * the action.
 *
 * A pure mapper beside [`derivedValue.ts`](./derivedValue.ts) and
 * [`pointBudgetView.ts`](./pointBudgetView.ts), for their reason: it is the part worth testing
 * directly, and a hook should not have to render a card to assert a list.
 *
 * **Validates: v3 Req 49.1, 49.2, 49.4, 49.6, 49.7; Requirements 20.1-20.5**
 */

/**
 * What a Dungeon Master can do in one press
 *
 * A frozen const object rather than a bare union, as every closed set of strings in this codebase is.
 * The values are **kinds of act, not routes** — which route each reaches is
 * [`useQuickActions`](../dm/useQuickActions.ts)' business, and keeping the two apart is what lets one
 * definition serve both placements (v3 Req 49.7: this sidebar, and TICKET-DM-04's roster).
 */
export const QUICK_ACTION_KIND = {
  /** Take an amount off a resource pool */
  DAMAGE: 'damage',
  /** Put an amount back into one */
  RESTORE: 'restore',
  /** Raise the DM's stat-point grant */
  GIVE_POINTS: 'give-points',
  /** Lower it — refused when it would leave the character overspent */
  TAKE_POINTS: 'take-points',
  /** Add to accumulated experience; the level follows on its own */
  AWARD_EXPERIENCE: 'award-experience',
  /** Take experience away — refused below zero rather than clamped */
  DEDUCT_EXPERIENCE: 'deduct-experience',
} as const;

export type QuickActionKind = (typeof QUICK_ACTION_KIND)[keyof typeof QUICK_ACTION_KIND];

/**
 * One resource stat, as this derivation needs it
 *
 * The three fields and no more — see the module note on why this is not `StatBreakdown`. `max` is
 * `null` for a pool whose formula could not be evaluated, which is a pool with no scale rather than a
 * pool whose scale is zero.
 */
export interface QuickActionPool {
  id: string;
  /** What the ruleset calls it — the only place a resource's name enters this module */
  name: string;
  max: number | null;
}

/** Everything the Snapshot supplies that the action set is derived from */
export interface QuickActionSource {
  /** Every `isResource` stat, in the ruleset's own order */
  pools: QuickActionPool[];
  /**
   * What this character's next level costs them from here, or `null` when the curve cannot price it
   *
   * Read through `experienceForLevel`, which refuses rather than extrapolating — so `null` here means
   * *this ruleset cannot say*, and the surface offers typed entry alone.
   */
  experienceStep: number | null;
}

/** One action, ready for a button */
export interface QuickAction {
  /** Stable across renders and unique across the set — the key a list renders by */
  id: string;
  kind: QuickActionKind;
  /** What the button says, in the ruleset's own words */
  label: string;
  /** Which pool it moves, or `null` for the four that move the character */
  statId: string | null;
  /** Amounts offered as one press, ascending; empty when the Snapshot supports none */
  steps: number[];
  /** The kind that undoes this one — see {@link inverseOf} */
  inverse: QuickActionKind;
}

/**
 * What undoes what (v3 Req 49.6)
 *
 * **Pairs, and every kind is in one.** `Record<QuickActionKind, …>` rather than a lookup with a
 * fallback, so a seventh kind added without an inverse fails to compile — which is the property undo
 * needs: an action nothing can undo would offer the DM a button that silently did nothing.
 *
 * **An inverse is not a restoration**, and the surface says so out loud. Damaging 5 against a maximum
 * that then falls, undone, is a *restore of 5 that clamps* — it does not put the character back where
 * they were, because putting them back would mean the DM's undo overriding the rules every other
 * write obeys.
 */
const INVERSES: Record<QuickActionKind, QuickActionKind> = {
  [QUICK_ACTION_KIND.DAMAGE]: QUICK_ACTION_KIND.RESTORE,
  [QUICK_ACTION_KIND.RESTORE]: QUICK_ACTION_KIND.DAMAGE,
  [QUICK_ACTION_KIND.GIVE_POINTS]: QUICK_ACTION_KIND.TAKE_POINTS,
  [QUICK_ACTION_KIND.TAKE_POINTS]: QUICK_ACTION_KIND.GIVE_POINTS,
  [QUICK_ACTION_KIND.AWARD_EXPERIENCE]: QUICK_ACTION_KIND.DEDUCT_EXPERIENCE,
  [QUICK_ACTION_KIND.DEDUCT_EXPERIENCE]: QUICK_ACTION_KIND.AWARD_EXPERIENCE,
};

/**
 * The kind that undoes a given kind
 *
 * @param kind Which act was performed
 * @returns The act that reverses it
 */
export function inverseOf(kind: QuickActionKind): QuickActionKind {
  return INVERSES[kind];
}

/**
 * Whether an amount is one a quick action can be sent with
 *
 * **Not a rule — the Kernel owns what an amount may be.** This is the difference between *offering a
 * live button* and *offering a dead one*, which is `AdjustmentField`'s precedent on the panel beside
 * the sidebar. Every action here states its own direction, so the amount is a positive whole
 * quantity and a signed one is a caller mistake rather than a way to reverse the act.
 *
 * **One definition with two callers**, which the review asked for rather than a comment explaining
 * why there were two: [`QuickActionRow`](../dm/QuickActionRow.tsx) asks it about a half-typed box,
 * and [`useQuickActions`](../dm/useQuickActions.ts) asks it about everything that reaches `send` —
 * the preset chips and, from TICKET-DM-04, a roster with no box at all. `Number('')` and
 * `Number('  ')` are 0 and `Number('abc')` is `NaN`, so an empty or unparseable box is already a
 * *no* here and the row needs no emptiness check of its own.
 *
 * @param amount What the DM asked for
 * @returns Whether to offer it, and whether to send it
 */
export function isSendableAmount(amount: number): boolean {
  return Number.isInteger(amount) && amount > 0;
}

/** The smallest amount any action offers — one of whatever the thing is counted in */
const SINGLE_STEP = 1;

/** How many parts of a pool's maximum the two derived steps are */
const TENTH = 10;
const QUARTER = 4;

/**
 * Sort a set of candidate amounts into the ladder a surface renders
 *
 * Whole, positive, deduplicated and ascending — a ruleset whose pool maxes out at 8 produces `1` for
 * both the tenth and the quarter, and one button is the honest rendering of that.
 */
function ladder(candidates: number[]): number[] {
  const usable = candidates.filter((step) => Number.isInteger(step) && step > 0);
  const unique = [...new Set(usable)];

  return unique.sort((first, second) => first - second);
}

/**
 * A pool's preset amounts, from the pool's own maximum
 *
 * A maximum that cannot be read leaves `1` alone rather than a guessed ladder — the same discipline
 * the rest of the sheet keeps about a formula that did not evaluate.
 */
function poolSteps(max: number | null): number[] {
  if (max === null || !Number.isFinite(max) || max <= 0) return [SINGLE_STEP];

  const tenth = Math.ceil(max / TENTH);
  const quarter = Math.ceil(max / QUARTER);

  return ladder([SINGLE_STEP, tenth, quarter]);
}

/**
 * Experience's preset, or none at all
 *
 * `null` in means nothing offered, which is TICKET-DM-01's rule for the same curve: this ruleset
 * cannot price the next level, so there is no amount to put on a button and inventing one would be
 * the confident wrong answer that decision exists to refuse.
 */
function experienceSteps(step: number | null): number[] {
  if (step === null) return [];

  return ladder([step]);
}

/**
 * Build one action
 *
 * Separate from {@link quickActionsFor} so that function reads as the list it produces rather than as
 * six object literals, and so the `inverse` lookup happens in exactly one place.
 */
function action(
  kind: QuickActionKind,
  label: string,
  statId: string | null,
  steps: number[]
): QuickAction {
  const inverse = inverseOf(kind);
  const id = statId === null ? kind : `${kind}:${statId}`;

  return { id, kind, label, statId, steps, inverse };
}

/**
 * Derive the whole quick-action set from the Snapshot (v3 Req 49.1, 49.2)
 *
 * The resource pair comes first because it is the one a DM presses during a fight, and the four that
 * move the character follow. Order within the pools is the ruleset's own, so the sidebar lists them
 * the way the sheet does.
 *
 * @param source What the Snapshot says about this character's pools and experience curve
 * @returns Two actions per pool plus the four fixed ones, in render order
 */
export function quickActionsFor(source: QuickActionSource): QuickAction[] {
  const pools = source.pools.flatMap((pool) => {
    const steps = poolSteps(pool.max);

    return [
      action(QUICK_ACTION_KIND.DAMAGE, `Damage ${pool.name}`, pool.id, steps),
      action(QUICK_ACTION_KIND.RESTORE, `Restore ${pool.name}`, pool.id, steps),
    ];
  });

  const pointSteps = [SINGLE_STEP];
  const experience = experienceSteps(source.experienceStep);

  return [
    ...pools,
    action(QUICK_ACTION_KIND.GIVE_POINTS, 'Give points', null, pointSteps),
    action(QUICK_ACTION_KIND.TAKE_POINTS, 'Take points', null, pointSteps),
    action(QUICK_ACTION_KIND.AWARD_EXPERIENCE, 'Award experience', null, experience),
    action(QUICK_ACTION_KIND.DEDUCT_EXPERIENCE, 'Deduct experience', null, experience),
  ];
}
