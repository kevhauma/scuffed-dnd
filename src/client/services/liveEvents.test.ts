/**
 * What a broadcast Event does to an open sheet (TICKET-LIVE-02, v3 Req 44.7)
 *
 * **Every applicable case is driven from the Kernel action that produced the `after`, not from a
 * literal.** That is the whole design of this file: an applier's only job is to put the server's
 * own number where it belongs, so the honest proof is *run the rule, take its `before`/`after`, feed
 * them through the Event, and land on the character the rule produced*. A test asserting
 * `experience === 300` against a hand-written payload would keep passing on the day an action starts
 * reporting something else in `after`.
 *
 * The inapplicable half is asserted **exhaustively** rather than by example: every action not in the
 * applicable set answers `stale`, so an action that quietly stopped being applied would be caught
 * here rather than by somebody noticing a sheet that never moves.
 *
 * **Validates: v3 Req 44.7, 45.1**
 */

import { describe, expect, it } from 'vitest';
import {
  addExperience,
  setDreamLevel,
  setGrantedPoints,
  setLevelExperience,
} from '#shared/services/dmActions';
import { makeValidConfiguration } from '#shared/services/importExport.fixtures';
import {
  adjustPurseBy,
  adjustResourceValue,
  isRefusal,
  type PlayerActionResult,
  setPurseAmount,
  setResourceValue,
} from '#shared/services/playerActions';
import type { PlayerActionEvent, SheetAction } from '#shared/types/api';
import { DM_ACTION, PLAYER_ACTION, ROLL_EVENT, SESSION_EVENT } from '#shared/types/api';
import type { Character } from '#shared/types/character';
import type { Configuration } from '#shared/types/config';
import type { LiveEvent } from '#shared/types/liveSocket';
import { applyEventToCharacter, EVENT_EFFECT } from './liveEvents';

/** When every Event in this file happened */
const AT = 1_700_000_000_000;

/** The ruleset these characters play by — the shared fixture, so a pool actually exists */
const RULES: Configuration = makeValidConfiguration();

/** The first pool the fixture defines */
function aPool(config: Configuration): string {
  const pool = config.stats.find((stat) => stat.isResource);
  expect(pool, 'the fixture should define at least one resource stat').toBeDefined();

  return (pool as { id: string }).id;
}

/** A character holding the four sanctioned numbers, so every applier has something to move */
function aCharacter(overrides: Partial<Character> = {}): Character {
  const poolId = aPool(RULES);

  return {
    id: 'character-1',
    configurationId: RULES.id,
    name: 'Quackers',
    raceIds: [],
    investedStatPoints: {},
    investedSkillPoints: {},
    currentResourceValues: { [poolId]: 10 },
    inventory: { equippedItems: {}, composedItems: [] },
    experience: 100,
    purse: 50,
    grantedStatPoints: 0,
    createdAt: new Date(0).toISOString(),
    updatedAt: new Date(0).toISOString(),
    ...overrides,
  } as Character;
}

/** One Event, carrying what a Kernel rule decided */
function anEvent(type: string, payload: unknown, overrides: Partial<LiveEvent> = {}): LiveEvent {
  return {
    id: 'event-1',
    seq: 1,
    type,
    actorAccountId: 'account-1',
    at: AT,
    payload,
    ...overrides,
  };
}

/** The Event a route would have written for an accepted action */
function eventFor(action: SheetAction, target: string, result: PlayerActionResult): LiveEvent {
  const refused = isRefusal(result);

  expect(refused, `the fixture should accept ${action}`).toBe(false);

  const accepted = result as Exclude<PlayerActionResult, { refusal: string }>;
  const payload: PlayerActionEvent = {
    characterId: 'character-1',
    action,
    target,
    before: accepted.before,
    after: accepted.after,
  };

  return anEvent(action, payload);
}

/** The character an outcome produced, having asserted that it produced one */
function appliedCharacter(character: Character, event: LiveEvent): Character {
  const outcome = applyEventToCharacter(character, event);

  expect(outcome.effect).toBe(EVENT_EFFECT.APPLIED);

  return (outcome as { character: Character }).character;
}

describe('an Event whose after is stored player state', () => {
  it('moves experience where the Kernel moved it', () => {
    const character = aCharacter();
    const result = addExperience(character, 300);
    const event = eventFor(DM_ACTION.AWARD_EXPERIENCE, '', result);

    const patched = appliedCharacter(character, event);
    const kernel = result as { character: Character };

    expect(patched.experience).toBe(kernel.character.experience);
  });

  it('writes what a level costs rather than a level, because that is what the server stored', () => {
    const character = aCharacter();
    const result = setLevelExperience(character, RULES, 3);

    // A ruleset with no `xp_thresholds` curve cannot price a level, which the fixture may well be —
    // in which case there is no Event to apply and nothing here to check
    if (isRefusal(result)) return;

    const event = eventFor(DM_ACTION.SET_LEVEL, '', result);
    const patched = appliedCharacter(character, event);
    const kernel = result as { character: Character };

    expect(patched.experience).toBe(kernel.character.experience);
  });

  it('moves a resource pool, named by the Event’s target', () => {
    const character = aCharacter();
    const poolId = aPool(RULES);
    const result = setResourceValue(character, RULES, poolId, 4);
    const event = eventFor(PLAYER_ACTION.SET_RESOURCE, poolId, result);

    const patched = appliedCharacter(character, event);
    const kernel = result as { character: Character };

    expect(patched.currentResourceValues[poolId]).toBe(
      kernel.character.currentResourceValues[poolId]
    );
  });

  it('moves a pool by a delta the same way', () => {
    const character = aCharacter();
    const poolId = aPool(RULES);
    const result = adjustResourceValue(character, RULES, poolId, -3);
    const event = eventFor(DM_ACTION.ADJUST_RESOURCE, poolId, result);

    const patched = appliedCharacter(character, event);
    const kernel = result as { character: Character };

    // Compared against the Kernel's own answer rather than against 7: a pool is **clamped** to the
    // maximum the ruleset derives, so the arithmetic a reader expects is not always the arithmetic
    // that happened — and the applier's whole job is to write what the server decided
    expect(patched.currentResourceValues[poolId]).toBe(
      kernel.character.currentResourceValues[poolId]
    );
  });

  it('leaves the other pools alone', () => {
    const poolId = aPool(RULES);
    const character = aCharacter({ currentResourceValues: { [poolId]: 10, other: 5 } });
    const result = setResourceValue(character, RULES, poolId, 2);
    const event = eventFor(PLAYER_ACTION.SET_RESOURCE, poolId, result);

    const patched = appliedCharacter(character, event);

    expect(patched.currentResourceValues.other).toBe(5);
  });

  it('sets a purse', () => {
    const character = aCharacter();
    const result = setPurseAmount(character, 900);
    const event = eventFor(DM_ACTION.SET_PURSE, '', result);

    const patched = appliedCharacter(character, event);

    expect(patched.purse).toBe(900);
  });

  it('adjusts a purse', () => {
    const character = aCharacter();
    const result = adjustPurseBy(character, -20);
    const event = eventFor(DM_ACTION.ADJUST_PURSE, '', result);

    const patched = appliedCharacter(character, event);

    expect(patched.purse).toBe(30);
  });

  it('sets the DM’s point grant', () => {
    const character = aCharacter();
    const result = setGrantedPoints(character, RULES, 6);
    const event = eventFor(DM_ACTION.GRANT_POINTS, '', result);

    const patched = appliedCharacter(character, event);

    expect(patched.grantedStatPoints).toBe(6);
  });

  it('sets the dream level', () => {
    const character = aCharacter();
    const result = setDreamLevel(character, 4);
    const event = eventFor(DM_ACTION.SET_DREAM_LEVEL, '', result);

    const patched = appliedCharacter(character, event);

    expect(patched.dreamLevel).toBe(4);
  });

  it('stamps the sheet with the server’s own instant', () => {
    const character = aCharacter();
    const result = addExperience(character, 1);
    const event = eventFor(DM_ACTION.AWARD_EXPERIENCE, '', result);

    const patched = appliedCharacter(character, event);

    // The same number the server wrote to the character's own `updatedAt`, because
    // `applyPlayerAction` reads the clock once — `play.test.ts` fails if that stops being true.
    // `useCharacterAdjustments` keys on this string, so the adjustment log follows the number.
    const stamped = new Date(AT).toISOString();

    expect(patched.updatedAt).toBe(stamped);
  });

  it('derives nothing — the level follows from the experience it wrote', () => {
    const character = aCharacter();
    const result = addExperience(character, 300);
    const event = eventFor(DM_ACTION.AWARD_EXPERIENCE, '', result);

    const patched = appliedCharacter(character, event);
    const fields = Object.keys(patched);

    // No stored level, no stored budget, no stored total — v3 Req 45.1 applied to the feed
    expect(fields).not.toContain('level');
    expect(fields).not.toContain('pointsRemaining');
  });
});

describe('an Event that cannot be applied', () => {
  /** The actions whose `after` is one of the five sanctioned stored fields */
  const APPLICABLE: SheetAction[] = [
    PLAYER_ACTION.SET_RESOURCE,
    PLAYER_ACTION.ADJUST_RESOURCE,
    PLAYER_ACTION.RESET_RESOURCE,
    DM_ACTION.SET_RESOURCE,
    DM_ACTION.ADJUST_RESOURCE,
    DM_ACTION.AWARD_EXPERIENCE,
    DM_ACTION.DEDUCT_EXPERIENCE,
    DM_ACTION.SET_LEVEL,
    DM_ACTION.SET_PURSE,
    DM_ACTION.ADJUST_PURSE,
    DM_ACTION.GRANT_POINTS,
    DM_ACTION.SET_DREAM_LEVEL,
  ];

  it('asks about every action that changes the shape of the document', () => {
    const player = Object.values(PLAYER_ACTION);
    const dm = Object.values(DM_ACTION);
    const every: SheetAction[] = [...player, ...dm];
    const structural = every.filter((action) => !APPLICABLE.includes(action));

    const applied = structural.filter((action) => {
      const payload: PlayerActionEvent = {
        characterId: 'character-1',
        action,
        target: 'anything',
        before: null,
        after: 5,
      };
      const event = anEvent(action, payload);
      const character = aCharacter();
      const outcome = applyEventToCharacter(character, event);

      return outcome.effect !== EVENT_EFFECT.STALE;
    });

    expect(applied).toEqual([]);
  });

  it('never applies a cast, whose values are a pool’s and whose target is a spell’s', () => {
    // The case that makes the table explicit rather than inferred: a `resource` applier reading
    // `target` would write a mana total into `currentResourceValues['<a spell id>']`
    const payload: PlayerActionEvent = {
      characterId: 'character-1',
      action: PLAYER_ACTION.CAST_SPELL,
      target: 'spell-42',
      before: 10,
      after: 7,
    };
    const event = anEvent(PLAYER_ACTION.CAST_SPELL, payload);

    const character = aCharacter();
    const outcome = applyEventToCharacter(character, event);

    expect(outcome.effect).toBe(EVENT_EFFECT.STALE);
  });

  it('asks after a Snapshot refresh, because the rules themselves moved', () => {
    const event = anEvent(SESSION_EVENT.SNAPSHOT_REFRESHED, { rulesetId: 'ruleset-1' });

    const character = aCharacter();
    const outcome = applyEventToCharacter(character, event);

    expect(outcome.effect).toBe(EVENT_EFFECT.STALE);
  });

  it('asks about an Event type this build does not know', () => {
    const event = anEvent('session.something_later', {});

    const character = aCharacter();
    const outcome = applyEventToCharacter(character, event);

    expect(outcome.effect).toBe(EVENT_EFFECT.STALE);
  });

  it('asks when the payload is not the shape its type claims', () => {
    const event = anEvent(DM_ACTION.AWARD_EXPERIENCE, { nothing: 'useful' });

    const character = aCharacter();
    const outcome = applyEventToCharacter(character, event);

    expect(outcome.effect).toBe(EVENT_EFFECT.STALE);
  });

  it('asks when a resource Event names no pool, rather than writing under an empty key', () => {
    // The arm that uses `target` as an object **key** guards it itself. All five resource routes
    // pass a `statId` today — but *it holds because thirteen call sites behave* is the reasoning
    // `cast-spell` above exists to reject, so the check lives where the damage would be done.
    const payload = {
      characterId: 'character-1',
      action: PLAYER_ACTION.SET_RESOURCE,
      target: undefined,
      before: 10,
      after: 4,
    } as unknown as PlayerActionEvent;
    const event = anEvent(PLAYER_ACTION.SET_RESOURCE, payload);

    const character = aCharacter();
    const outcome = applyEventToCharacter(character, event);

    expect(outcome.effect).toBe(EVENT_EFFECT.STALE);
  });

  it('asks when the value is not a number, rather than writing one', () => {
    const payload: PlayerActionEvent = {
      characterId: 'character-1',
      action: DM_ACTION.AWARD_EXPERIENCE,
      target: '',
      before: 0,
      after: 'three hundred',
    };
    const event = anEvent(DM_ACTION.AWARD_EXPERIENCE, payload);

    const character = aCharacter();
    const outcome = applyEventToCharacter(character, event);

    expect(outcome.effect).toBe(EVENT_EFFECT.STALE);
  });
});

describe('an Event about something else', () => {
  it('leaves another character’s sheet alone, and asks for nothing', () => {
    const payload: PlayerActionEvent = {
      characterId: 'somebody-else',
      action: DM_ACTION.AWARD_EXPERIENCE,
      target: '',
      before: 0,
      after: 300,
    };
    const event = anEvent(DM_ACTION.AWARD_EXPERIENCE, payload);

    const character = aCharacter();
    const outcome = applyEventToCharacter(character, event);

    // Not `stale`: a table where one DM adjustment refetched every open sheet would refetch four
    // times for four players, and none of them was about the others
    expect(outcome.effect).toBe(EVENT_EFFECT.ELSEWHERE);
  });

  it('leaves the sheet alone for a roll, which stores nothing', () => {
    const event = anEvent(ROLL_EVENT, { characterId: 'character-1', outcome: {} });

    const character = aCharacter();
    const outcome = applyEventToCharacter(character, event);

    // Its own character, and still `elsewhere` — the roll log listens for these, and a refetch per
    // roll would be a request every time anybody at the table throws dice
    expect(outcome.effect).toBe(EVENT_EFFECT.ELSEWHERE);
  });

  it('leaves the sheet alone for every membership change, the join included (TICKET-LIVE-04)', () => {
    // **All four, and the join is the one worth being explicit about.** A roster does read its
    // member list again over a join — that is `membershipEvents.ts`'s decision, made about a member
    // list — and nothing about it may reach a sheet. Answering `stale` for any of these would
    // refetch every open sheet at the table every time somebody arrived or left, which is the
    // hazard TICKET-DM-04 declined to ship and this criterion exists to rule out.
    const membership = [
      anEvent(SESSION_EVENT.MEMBER_JOINED, { accountId: 'account-newcomer' }),
      anEvent(SESSION_EVENT.MEMBER_REMOVED, { accountId: 'account-ada' }),
      anEvent(SESSION_EVENT.MEMBER_LEFT, { accountId: 'account-ada' }),
      anEvent(SESSION_EVENT.DM_TRANSFERRED, {
        accountId: 'account-ada',
        previousAccountId: 'account-dm',
      }),
    ];

    const character = aCharacter();
    const effects = membership.map((event) => applyEventToCharacter(character, event).effect);
    const elsewhere = membership.map(() => EVENT_EFFECT.ELSEWHERE);

    expect(effects).toEqual(elsewhere);
  });

  it('still asks after a Snapshot refresh, which is the one table Event that is about this sheet', () => {
    // The other half of the table above: four `elsewhere` and one `stale`, and the difference is
    // whether the rules this sheet is derived against have moved. A change here that made the
    // membership values `elsewhere` by making *every* session Event `elsewhere` would leave a sheet
    // priced against rules it no longer plays by, and this is what would fail.
    const event = anEvent(SESSION_EVENT.SNAPSHOT_REFRESHED, { rulesetId: 'ruleset-1' });

    const character = aCharacter();
    const outcome = applyEventToCharacter(character, event);

    expect(outcome.effect).toBe(EVENT_EFFECT.STALE);
  });
});
