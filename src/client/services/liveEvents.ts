/**
 * What a broadcast Event does to the sheet a browser is holding (TICKET-LIVE-02, v3 Req 44.7)
 *
 * The client half of the fan-out: *given this Event and this character, what is this character
 * now?* — or, honestly, *ask the server again*. Pure, so the rule is testable without a socket, a
 * store or a component.
 *
 * ## Which Events can be applied, and why that is a principle rather than a list
 *
 * An Event is applicable **exactly when its `after` is one of the five sanctioned stored fields of
 * player state** — the ones CLAUDE.md enumerates as the only things a `Character` keeps that nothing
 * derives: `currentResourceValues`, `experience`, `purse`, `grantedStatPoints` and `dreamLevel`.
 * Everything else an action can change is *structure* — a build, a learned spell, a passive, a focus
 * pick, an allocation — and those are told to the reader as *what the value became*, which for a
 * structural change is a fact about the whole document rather than a field.
 *
 * That line is what stops this module from becoming a second implementation of `playerActions.ts`.
 * **Nothing here runs a rule**: `after` is the value the *server's* Kernel already decided on, and
 * the whole of an applier is writing it where it belongs. Nothing derived is read or written either
 * — a level moves because `characterSummary` re-derives it from the patched experience, which is
 * v3 Req 45.1 applied to the feed.
 *
 * **`cast-spell` is the case that proves the table has to be explicit.** It moves a resource pool
 * and its before/after *are* pool values — but its Event's `target` is the **spell's** id, because
 * that is what the act named. An applier that inferred *resource* from the shape of the values would
 * write a mana total into `currentResourceValues['<a spell id>']` and quietly corrupt the sheet. It
 * is `null` here, and the reader asks.
 *
 * The resource arm carries **its own guard on `target`** for the same reason rather than trusting
 * the five routes that feed it: it is the only arm that uses a payload field as an object *key*, and
 * *safe because every caller behaves* is precisely the argument the paragraph above rejects.
 *
 * ## The stamp, and why it is not cosmetic
 *
 * An applied patch also moves `updatedAt`, from the Event's own `at`. `applyPlayerAction` reads the
 * clock **once** and spends it on the character's column, the document's `updatedAt` and the Event's
 * `createdAt`, so this reproduces the string the server stored rather than approximating it —
 * `play.test.ts`'s *stamps the character and its Event from one instant* fails if that ever stops
 * being true. It matters because `useCharacterAdjustments` keys its read on that string: with it,
 * the adjustment log picks up the DM's change beside the number that moved, with no second
 * mechanism; without it, the log would sit one entry short until something else re-read the sheet.
 *
 * **Validates: v3 Req 44.7, 45.1**
 */

import type { PlayerActionEvent, SheetAction } from '#shared/types/api';
import { DM_ACTION, PLAYER_ACTION, ROLL_EVENT } from '#shared/types/api';
import type { Character } from '#shared/types/character';
import type { LiveEvent } from '#shared/types/liveSocket';

/** Which stored field an Event's `after` belongs in */
const EVENT_PATCH = {
  /** One entry of `currentResourceValues`, named by the Event's `target` */
  RESOURCE: 'resource',
  EXPERIENCE: 'experience',
  PURSE: 'purse',
  GRANTED_POINTS: 'granted-points',
  DREAM_LEVEL: 'dream-level',
} as const;

/** One of the five */
type EventPatch = (typeof EVENT_PATCH)[keyof typeof EVENT_PATCH];

/**
 * What each named action writes, or `null` for one whose answer is *ask again*
 *
 * **Exhaustive by type**, which is the point: a ticket that adds an action gets a compile error
 * here naming it, rather than an action that silently never applies and never refetches either.
 * `describeAdjustment`'s `Record<DmAction, …>` set that precedent for the same reason.
 */
const PATCH_FOR: Record<SheetAction, EventPatch | null> = {
  // The five stored fields
  [PLAYER_ACTION.SET_RESOURCE]: EVENT_PATCH.RESOURCE,
  [PLAYER_ACTION.ADJUST_RESOURCE]: EVENT_PATCH.RESOURCE,
  [PLAYER_ACTION.RESET_RESOURCE]: EVENT_PATCH.RESOURCE,
  [DM_ACTION.SET_RESOURCE]: EVENT_PATCH.RESOURCE,
  [DM_ACTION.ADJUST_RESOURCE]: EVENT_PATCH.RESOURCE,
  [DM_ACTION.AWARD_EXPERIENCE]: EVENT_PATCH.EXPERIENCE,
  [DM_ACTION.DEDUCT_EXPERIENCE]: EVENT_PATCH.EXPERIENCE,
  // `dm-set-level` stores **experience**, never a level: the server prices the level off the
  // ruleset's own curve and writes what it costs (D9). The client re-derives the level from it.
  [DM_ACTION.SET_LEVEL]: EVENT_PATCH.EXPERIENCE,
  [DM_ACTION.SET_PURSE]: EVENT_PATCH.PURSE,
  [DM_ACTION.ADJUST_PURSE]: EVENT_PATCH.PURSE,
  [DM_ACTION.GRANT_POINTS]: EVENT_PATCH.GRANTED_POINTS,
  [DM_ACTION.SET_DREAM_LEVEL]: EVENT_PATCH.DREAM_LEVEL,

  // …and everything that changes the shape of the document rather than one of its numbers
  [PLAYER_ACTION.INVEST_STAT_POINTS]: null,
  [PLAYER_ACTION.INVEST_SKILL_POINTS]: null,
  [PLAYER_ACTION.SET_FOCUS_SKILLS]: null,
  [PLAYER_ACTION.EQUIP_ITEM]: null,
  [PLAYER_ACTION.UNEQUIP_ITEM]: null,
  [PLAYER_ACTION.BUILD_ITEM]: null,
  [PLAYER_ACTION.DROP_ITEM]: null,
  [PLAYER_ACTION.LEARN_SPELL]: null,
  [PLAYER_ACTION.UNLEARN_SPELL]: null,
  // Its values are a pool's and its target is a spell's — see the module note
  [PLAYER_ACTION.CAST_SPELL]: null,
  [DM_ACTION.GRANT_PASSIVE]: null,
  [DM_ACTION.REVOKE_PASSIVE]: null,
  [DM_ACTION.BUILD_ITEM]: null,
  [DM_ACTION.DROP_ITEM]: null,
  [DM_ACTION.EQUIP_ITEM]: null,
  [DM_ACTION.UNEQUIP_ITEM]: null,
};

/** How an Event landed on the sheet a reader is holding */
export const EVENT_EFFECT = {
  /** It was about this sheet, and the sheet now holds what it says */
  APPLIED: 'applied',
  /** It was not about this sheet — somebody else's character, or a roll, which stores nothing */
  ELSEWHERE: 'elsewhere',
  /** It was about this sheet and only a re-read can say what the sheet now is */
  STALE: 'stale',
} as const;

/** One of the three */
export type LiveEventEffect = (typeof EVENT_EFFECT)[keyof typeof EVENT_EFFECT];

/** What an Event did, and the character it produced when it produced one */
export type LiveEventOutcome =
  | { effect: typeof EVENT_EFFECT.APPLIED; character: Character }
  | { effect: typeof EVENT_EFFECT.ELSEWHERE }
  | { effect: typeof EVENT_EFFECT.STALE };

/** Nothing to do here */
const elsewhere: LiveEventOutcome = { effect: EVENT_EFFECT.ELSEWHERE };

/** Something to do, and only the server can say what */
const stale: LiveEventOutcome = { effect: EVENT_EFFECT.STALE };

/**
 * The five writes, each one line, none of them a rule
 *
 * **`null` means the payload could not be trusted with this write**, which only the resource arm
 * can say: it is the one that uses `target` as an **object key**, and every other arm names its
 * field itself. All five resource routes do pass a `statId` today — but *it holds because thirteen
 * call sites behave* is the reasoning `cast-spell`'s note exists to reject, so the guard lives in
 * the arm that would be harmed rather than in the routes that feed it.
 */
const APPLIERS: Record<
  EventPatch,
  (character: Character, event: PlayerActionEvent) => Character | null
> = {
  [EVENT_PATCH.RESOURCE]: (character, event) => {
    if (typeof event.target !== 'string' || event.target === '') return null;

    return {
      ...character,
      currentResourceValues: {
        ...character.currentResourceValues,
        [event.target]: event.after as number,
      },
    };
  },
  [EVENT_PATCH.EXPERIENCE]: (character, event) => ({
    ...character,
    experience: event.after as number,
  }),
  [EVENT_PATCH.PURSE]: (character, event) => ({ ...character, purse: event.after as number }),
  [EVENT_PATCH.GRANTED_POINTS]: (character, event) => ({
    ...character,
    grantedStatPoints: event.after as number,
  }),
  [EVENT_PATCH.DREAM_LEVEL]: (character, event) => ({
    ...character,
    dreamLevel: event.after as number,
  }),
};

/** A payload that looks like the sheet action it claims to be */
function actionPayloadOf(event: LiveEvent): PlayerActionEvent | null {
  const payload = event.payload as Partial<PlayerActionEvent> | null;

  if (!payload || typeof payload.characterId !== 'string') return null;

  return payload as PlayerActionEvent;
}

/**
 * Apply one Event to the character a browser is holding open
 *
 * @param character The sheet as it stands
 * @param event What happened at the table
 * @returns What to do about it, and the patched character when there is one
 */
export function applyEventToCharacter(character: Character, event: LiveEvent): LiveEventOutcome {
  const isSheetAction = Object.hasOwn(PATCH_FOR, event.type);

  // A roll stores nothing; a Snapshot refresh changed the *rules*; anything unrecognised is
  // something this build does not know how to read. Only the middle one is about this sheet — and
  // the other two cost a reader nothing, because `ELSEWHERE` for a roll is what keeps the roll feed
  // from refetching a character every time somebody throws dice.
  if (!isSheetAction) return event.type === ROLL_EVENT ? elsewhere : stale;

  const payload = actionPayloadOf(event);

  if (!payload) return stale;
  if (payload.characterId !== character.id) return elsewhere;

  const patch = PATCH_FOR[event.type as SheetAction];

  if (patch === null) return stale;
  if (typeof payload.after !== 'number') return stale;

  const apply = APPLIERS[patch];
  const patched = apply(character, payload);

  // The arm refused it — a resource Event whose `target` is not a key. Asking is the same answer
  // this function gives for anything else it cannot read with confidence.
  if (patched === null) return stale;

  return {
    effect: EVENT_EFFECT.APPLIED,
    // The server's own instant, not this browser's — see the module note
    character: { ...patched, updatedAt: new Date(event.at).toISOString() },
  };
}
