/**
 * A character that lives at a table, driven through the store (TICKET-PLY-01)
 *
 * **A second file rather than more cases in `characterStore.test.ts`**, and that is the milestone's
 * fifth Definition-of-Done rule showing through: local mode's suite has to pass *unchanged*, so the
 * cheapest way to keep that true is not to touch it. Everything here is about the other home.
 *
 * Three things it holds:
 *
 * 1. **The branch is on where the character lives, not on what the action is.** Every one of the
 *    store's writes reaches the table when the id is the open table character's, and the request
 *    carries the intent's own name.
 * 2. **A refusal changes nothing.** The character stays exactly as it was and the server's sentence
 *    lands in `actionError` — v3 Req 41.5's *the surface never shows an action that did not land*,
 *    which is a claim about store state and is asserted as one.
 * 3. **A local character asks the network nothing.** `fetch` is stubbed to **throw** rather than
 *    counted, because a path that fetched and ignored the answer satisfies a call count and has
 *    still broken D6.
 *
 * **Validates: v3 Req 36.2, 41.1, 41.5, 45.1**
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DM_ACTION, PLAYER_ACTION } from '#shared/types/api';
import type { Character } from '#shared/types/character';
import type { Configuration } from '#shared/types/config';

vi.mock('../services/storage', () => ({
  loadCharacters: vi.fn(() => []),
  saveCharacters: vi.fn(),
}));

/**
 * The live socket, stubbed to **throw** (TICKET-LIVE-03, v3 Req 44.9)
 *
 * *Every action still works with the connection down* is the requirement, and this is the strongest
 * form of it available to a store test: if any write path ever reached for the socket, the action
 * would throw here rather than quietly degrade. Inert today, because nothing under `stores/` imports
 * it — which is the claim, asserted structurally in `services/liveSocket.test.ts` as well.
 */
vi.mock('../services/liveSocket', () => ({
  liveConnection: () => {
    throw new Error('an action must not need the socket');
  },
}));

import { EVENT_EFFECT } from '../services/liveEvents';
import * as storage from '../services/storage';
import { useCharacterStore } from './characterStore';

/** The smallest ruleset the actions under test need */
const RULES = {
  id: 'config-1',
  name: 'Test',
  version: '1.0',
  schemaVersion: 10,
  stats: [
    {
      id: 'stat-health',
      name: 'Health',
      abbreviation: 'HP',
      description: '',
      order: 0,
      countsTowardTotal: false,
      isResource: true,
      rounding: 'none',
    },
  ],
  skills: [],
  materials: [],
  materialCategories: [],
  items: [],
  equipmentSlots: [],
  races: [],
  currencyTiers: [],
  createdAt: '2024-01-01',
  updatedAt: '2024-01-01',
} as unknown as Configuration;

function aCharacter(overrides: Partial<Character> = {}): Character {
  return {
    id: 'character-1',
    name: 'Quackers',
    configurationId: 'config-1',
    raceIds: [],
    investedStatPoints: {},
    investedSkillPoints: {},
    currentResourceValues: { 'stat-health': 30 },
    experience: 0,
    inventory: { equippedItems: {}, composedItems: [] },
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
    ...overrides,
  };
}

/** What the last `fetch` was asked for */
function lastRequest(): { url: string; method: string; body: unknown } {
  const stub = vi.mocked(globalThis.fetch);
  const [url, init] = stub.mock.calls[stub.mock.calls.length - 1] as [string, RequestInit];

  return {
    url,
    method: init.method ?? 'GET',
    body: init.body === undefined ? undefined : JSON.parse(init.body as string),
  };
}

/** `fetch` answering every call with one JSON body */
function respondWith(status: number, body: unknown) {
  globalThis.fetch = vi.fn(async () =>
    Promise.resolve(
      new Response(JSON.stringify(body), {
        status,
        headers: { 'Content-Type': 'application/json' },
      })
    )
  ) as unknown as typeof fetch;
}

/** `fetch` that fails the case if anything calls it */
function refuseToFetch() {
  globalThis.fetch = vi.fn(() => {
    throw new Error('local mode must not reach the network');
  }) as unknown as typeof fetch;
}

const original = globalThis.fetch;

beforeEach(() => {
  vi.clearAllMocks();
  globalThis.fetch = original;
  useCharacterStore.setState({
    characters: [],
    isLoaded: true,
    tableCharacter: null,
    isActing: false,
    actionError: null,
  });
});

describe('opening a character that lives at a table', () => {
  it('holds it open and reports which table it plays at', async () => {
    respondWith(200, {
      id: 'character-1',
      sessionId: 'session-1',
      rulesetId: null,
      ownerAccountId: 'account-1',
      name: 'Quackers',
      revision: 1,
      createdAt: 0,
      updatedAt: 0,
      character: aCharacter(),
    });

    const sessionId = await useCharacterStore.getState().openTableCharacter('character-1');

    expect(sessionId).toBe('session-1');
    expect(useCharacterStore.getState().tableCharacter?.id).toBe('character-1');
    // Held, not just returned: the roll log is session-scoped, and the sheet has no other way to
    // know which table to ask (TICKET-ROLL-07). It was deleted as dead in PLY-01 and came back with
    // this reader — an assertion here is what stops it going a second time.
    expect(useCharacterStore.getState().tableSessionId).toBe('session-1');
    // The browser's own roster is untouched, which is what makes the two homes two homes (D6)
    expect(useCharacterStore.getState().characters).toEqual([]);
    expect(storage.saveCharacters).not.toHaveBeenCalled();
  });

  it('refuses to hold a character that sits at no table', async () => {
    // `GET /api/characters/:id` answers an IO-04 upload to its owner quite correctly. Holding one
    // here would be a sheet read against the *browser's* ruleset, with the purse and experience
    // hidden as though a DM owned them, and every write meeting the routes' 409.
    respondWith(200, {
      id: 'character-1',
      sessionId: null,
      rulesetId: 'ruleset-1',
      ownerAccountId: 'account-1',
      name: 'Quackers',
      revision: 1,
      createdAt: 0,
      updatedAt: 0,
      character: aCharacter(),
    });

    const sessionId = await useCharacterStore.getState().openTableCharacter('character-1');

    expect(sessionId).toBeNull();
    expect(useCharacterStore.getState().tableCharacter).toBeNull();
  });

  it('says so rather than throwing when it cannot be read', async () => {
    respondWith(404, { error: { code: 'not_found', message: 'Not found' } });

    const sessionId = await useCharacterStore.getState().openTableCharacter('character-1');

    expect(sessionId).toBeNull();
    expect(useCharacterStore.getState().tableCharacter).toBeNull();
    expect(useCharacterStore.getState().actionError).toContain('could not be opened');
  });
});

describe('a write to the character open at a table', () => {
  beforeEach(() => {
    useCharacterStore.setState({ tableCharacter: aCharacter() });
  });

  it('posts the intent by name and adopts the character the server sends back', async () => {
    const moved = aCharacter({ currentResourceValues: { 'stat-health': 23 } });
    respondWith(200, {
      id: 'character-1',
      sessionId: 'session-1',
      rulesetId: null,
      ownerAccountId: 'account-1',
      name: 'Quackers',
      revision: 2,
      createdAt: 0,
      updatedAt: 0,
      character: moved,
    });

    useCharacterStore.getState().adjustCurrentStatValue('character-1', 'stat-health', -7, RULES);
    await vi.waitFor(() => expect(useCharacterStore.getState().isActing).toBe(false));

    expect(lastRequest().url).toBe(`/api/characters/character-1/${PLAYER_ACTION.ADJUST_RESOURCE}`);
    expect(lastRequest().method).toBe('POST');
    expect(lastRequest().body).toEqual({ statId: 'stat-health', delta: -7 });

    expect(useCharacterStore.getState().tableCharacter?.currentResourceValues['stat-health']).toBe(
      23
    );
    // Nothing about a table character is ever written to LocalStorage (v3 Req 36.2)
    expect(storage.saveCharacters).not.toHaveBeenCalled();
  });

  it.each([
    [
      PLAYER_ACTION.INVEST_STAT_POINTS,
      () => useCharacterStore.getState().setInvestedStatPoints('character-1', 'stat-x', 2, RULES),
      { statId: 'stat-x', points: 2 },
    ],
    [
      PLAYER_ACTION.INVEST_SKILL_POINTS,
      () => useCharacterStore.getState().setInvestedSkillPoints('character-1', 'skill-x', 4, RULES),
      { skillId: 'skill-x', points: 4 },
    ],
    [
      PLAYER_ACTION.SET_RESOURCE,
      () =>
        useCharacterStore.getState().updateCurrentStatValue('character-1', 'stat-health', 5, RULES),
      { statId: 'stat-health', value: 5 },
    ],
    [
      PLAYER_ACTION.RESET_RESOURCE,
      () =>
        useCharacterStore
          .getState()
          .resetCurrentStatValueToMax('character-1', 'stat-health', RULES),
      { statId: 'stat-health' },
    ],
    [
      PLAYER_ACTION.EQUIP_ITEM,
      () => useCharacterStore.getState().equipItem('character-1', 'head', 'item-1', RULES),
      { equipmentSlotType: 'head', itemId: 'item-1' },
    ],
    [
      PLAYER_ACTION.UNEQUIP_ITEM,
      () => useCharacterStore.getState().unequipItem('character-1', 'head'),
      { equipmentSlotType: 'head' },
    ],
    [
      PLAYER_ACTION.BUILD_ITEM,
      () =>
        useCharacterStore
          .getState()
          .buildItem(
            'character-1',
            { templateId: 'item-1', materialId: 'mat-iron', materialLevel: 1 },
            RULES
          ),
      // The whole triple goes on the wire: the *template* is `itemId` and the parts are spelled as
      // `ComposedItem` spells them, so the route assembles a record rather than translating one
      {
        itemId: 'item-1',
        materialId: 'mat-iron',
        materialLevel: 1,
        inlayId: undefined,
        inlayLevel: undefined,
      },
    ],
    [
      PLAYER_ACTION.DROP_ITEM,
      () => useCharacterStore.getState().discardItem('character-1', 'item-1', RULES),
      { itemId: 'item-1' },
    ],
  ])('sends %s with the fields that action needs', async (action, run, body) => {
    respondWith(200, {
      id: 'character-1',
      sessionId: 'session-1',
      rulesetId: null,
      ownerAccountId: 'account-1',
      name: 'Quackers',
      revision: 2,
      createdAt: 0,
      updatedAt: 0,
      character: aCharacter(),
    });

    run();
    await vi.waitFor(() => expect(useCharacterStore.getState().isActing).toBe(false));

    expect(lastRequest().url).toBe(`/api/characters/character-1/${action}`);
    expect(lastRequest().body).toEqual(body);
  });

  it('leaves the character exactly as it was when the server refuses, and says why', async () => {
    respondWith(400, {
      error: {
        code: 'bad_request',
        message: 'That spend is more than the points this character has.',
      },
    });

    useCharacterStore.getState().setInvestedStatPoints('character-1', 'stat-x', 99, RULES);
    await vi.waitFor(() => expect(useCharacterStore.getState().isActing).toBe(false));

    const { tableCharacter, actionError } = useCharacterStore.getState();

    expect(tableCharacter).toEqual(aCharacter());
    expect(actionError).toBe('That spend is more than the points this character has.');
  });

  it('clears the last refusal when the next action is accepted', async () => {
    useCharacterStore.setState({ actionError: 'something earlier went wrong' });
    respondWith(200, {
      id: 'character-1',
      sessionId: 'session-1',
      rulesetId: null,
      ownerAccountId: 'account-1',
      name: 'Quackers',
      revision: 2,
      createdAt: 0,
      updatedAt: 0,
      character: aCharacter(),
    });

    useCharacterStore.getState().updateCurrentStatValue('character-1', 'stat-health', 5, RULES);
    await vi.waitFor(() => expect(useCharacterStore.getState().isActing).toBe(false));

    expect(useCharacterStore.getState().actionError).toBeNull();
  });

  it('keeps one write in flight, so a second tap cannot lose the first', async () => {
    // Both would be applied to the row the server found, and the later answer would replace the
    // earlier one — the client half of the race the routes close by reading the body first
    respondWith(200, {
      id: 'character-1',
      sessionId: 'session-1',
      rulesetId: null,
      ownerAccountId: 'account-1',
      name: 'Quackers',
      revision: 2,
      createdAt: 0,
      updatedAt: 0,
      character: aCharacter(),
    });

    useCharacterStore.getState().adjustCurrentStatValue('character-1', 'stat-health', -5, RULES);
    useCharacterStore.getState().adjustCurrentStatValue('character-1', 'stat-health', -5, RULES);

    await vi.waitFor(() => expect(useCharacterStore.getState().isActing).toBe(false));

    expect(vi.mocked(globalThis.fetch)).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['experience', () => useCharacterStore.getState().awardExperience('character-1', 100)],
    ['experience deducted', () => useCharacterStore.getState().deductExperience('character-1', 10)],
    ['a purse', () => useCharacterStore.getState().setPurse('character-1', 5)],
    // TICKET-RES-04: the User's ruling put the dream level on the DM's side, so the Player's own
    // action is refused at a table exactly as their experience and their purse are
    ['a dream level', () => useCharacterStore.getState().updateDreamLevel('character-1', 3)],
    // TICKET-PAS-01: a passive is somebody else's decision about your character, so at a table there
    // is no player route to the field at all — the local action has nowhere to send it
    [
      'a passive granted',
      () => useCharacterStore.getState().grantPassive('character-1', 'p1', RULES),
    ],
    ['a passive revoked', () => useCharacterStore.getState().revokePassive('character-1', 'p1')],
  ])('refuses %s at a table, because it is the DM’s', (_name: string, run: () => void) => {
    // The sheet does not draw these controls, but the rule belongs to the store: falling through to
    // `characters.find(...)` would find nothing and no-op in silence, and the next surface to reach
    // for the action would inherit that rather than the refusal
    refuseToFetch();

    run();

    expect(useCharacterStore.getState().actionError).toContain('Dungeon Master');
    expect(storage.saveCharacters).not.toHaveBeenCalled();
  });

  it('is dismissible, and closing the character forgets it', () => {
    useCharacterStore.setState({ actionError: 'a refusal' });
    useCharacterStore.getState().dismissActionError();

    expect(useCharacterStore.getState().actionError).toBeNull();

    useCharacterStore.setState({ actionError: 'another refusal' });
    useCharacterStore.getState().closeTableCharacter();

    expect(useCharacterStore.getState().tableCharacter).toBeNull();
    expect(useCharacterStore.getState().tableSessionId).toBeNull();
    expect(useCharacterStore.getState().actionError).toBeNull();
  });
});

describe('a write to a character in this browser', () => {
  it('asks the network nothing, even while another character is open at a table', () => {
    // The branch is on *which character*, so the dangerous case is the one where both homes are in
    // play at once — a store that branched on "is any table character open" would fail this
    useCharacterStore.setState({
      characters: [aCharacter({ id: 'local-1' })],
      tableCharacter: aCharacter({ id: 'character-1' }),
    });
    refuseToFetch();

    // Negative, so the Kernel's one-sided clamp passes it straight through and the assertion is
    // about the *write* rather than about what this fixture's maximum happens to be
    useCharacterStore.getState().updateCurrentStatValue('local-1', 'stat-health', -3, RULES);

    expect(useCharacterStore.getState().characters[0].currentResourceValues['stat-health']).toBe(
      -3
    );
    expect(storage.saveCharacters).toHaveBeenCalled();
  });
});

describe("the DM's adjustments (TICKET-DM-01)", () => {
  beforeEach(() => {
    useCharacterStore.setState({ tableCharacter: aCharacter() });
  });

  /** The document the server answers an accepted adjustment with */
  function accepted(character: Character) {
    respondWith(200, {
      id: 'character-1',
      sessionId: 'session-1',
      rulesetId: null,
      ownerAccountId: 'account-2',
      name: 'Quackers',
      revision: 2,
      createdAt: 0,
      updatedAt: 0,
      character,
    });
  }

  it.each([
    [
      DM_ACTION.AWARD_EXPERIENCE,
      () => useCharacterStore.getState().dmAwardExperience('character-1', 300),
      { amount: 300 },
    ],
    [
      DM_ACTION.DEDUCT_EXPERIENCE,
      () => useCharacterStore.getState().dmDeductExperience('character-1', 50),
      { amount: 50 },
    ],
    [
      DM_ACTION.SET_LEVEL,
      () => useCharacterStore.getState().dmSetLevel('character-1', 4),
      { level: 4 },
    ],
    [
      DM_ACTION.GRANT_POINTS,
      () => useCharacterStore.getState().dmSetGrantedPoints('character-1', 3),
      { points: 3 },
    ],
    [
      DM_ACTION.SET_RESOURCE,
      () => useCharacterStore.getState().dmSetResource('character-1', 'stat-health', 12),
      { statId: 'stat-health', value: 12 },
    ],
    // The delta counterpart (TICKET-DM-03), sending `delta` where the pair above sends `value`:
    // *take 7 off them* and *put them at 23* are different instructions, and a shared field name
    // would make a mis-routed body silently valid — the purse pair's reasoning, one collection over
    [
      DM_ACTION.ADJUST_RESOURCE,
      () => useCharacterStore.getState().dmAdjustResource('character-1', 'stat-health', -7),
      { statId: 'stat-health', delta: -7 },
    ],
    [
      DM_ACTION.SET_DREAM_LEVEL,
      () => useCharacterStore.getState().dmSetDreamLevel('character-1', 3),
      { dreamLevel: 3 },
    ],
    [
      DM_ACTION.GRANT_PASSIVE,
      () => useCharacterStore.getState().dmGrantPassive('character-1', 'passive-blindsight'),
      { passiveId: 'passive-blindsight' },
    ],
    [
      DM_ACTION.REVOKE_PASSIVE,
      () => useCharacterStore.getState().dmRevokePassive('character-1', 'passive-blindsight'),
      { passiveId: 'passive-blindsight' },
    ],
    // The money and the pack (TICKET-DM-02). The purse pair sends `amount` and `delta` under
    // different names deliberately: *set it to 40* and *put 40 in it* are opposite instructions,
    // and a shared field would make a mis-routed body silently — and expensively — valid.
    [
      DM_ACTION.SET_PURSE,
      () => useCharacterStore.getState().dmSetPurse('character-1', 340),
      { amount: 340 },
    ],
    [
      DM_ACTION.ADJUST_PURSE,
      () => useCharacterStore.getState().dmAdjustPurse('character-1', -12),
      { delta: -12 },
    ],
    [
      DM_ACTION.BUILD_ITEM,
      () =>
        useCharacterStore.getState().dmBuildItem('character-1', {
          templateId: 'item-axe',
          materialId: 'mat-iron',
          materialLevel: 10,
        }),
      // The id is **not** on the wire: the server mints one, so a client-supplied id would be an id
      // the server had no reason to trust (`buildItem`'s rule, one actor over)
      {
        itemId: 'item-axe',
        materialId: 'mat-iron',
        materialLevel: 10,
        inlayId: undefined,
        inlayLevel: undefined,
      },
    ],
    [
      DM_ACTION.DROP_ITEM,
      () => useCharacterStore.getState().dmDiscardItem('character-1', 'build-77'),
      { itemId: 'build-77' },
    ],
    [
      DM_ACTION.EQUIP_ITEM,
      () => useCharacterStore.getState().dmEquipItem('character-1', 'head_gear', 'build-77'),
      { equipmentSlotType: 'head_gear', itemId: 'build-77' },
    ],
    [
      DM_ACTION.UNEQUIP_ITEM,
      () => useCharacterStore.getState().dmUnequipItem('character-1', 'head_gear'),
      { equipmentSlotType: 'head_gear' },
    ],
  ])('posts %s by name, with only what the server needs to be told', async (action, run, body) => {
    accepted(aCharacter({ experience: 300 }));

    run();
    await vi.waitFor(() => expect(useCharacterStore.getState().isActing).toBe(false));

    // Nothing derived crosses the wire: no level, no budget, no stat value — the milestone's third
    // Definition-of-Done rule, asserted at the one place a client could break it
    expect(lastRequest()).toEqual({
      url: `/api/characters/character-1/${action}`,
      method: 'POST',
      body,
    });
    expect(useCharacterStore.getState().tableCharacter?.experience).toBe(300);
    expect(storage.saveCharacters).not.toHaveBeenCalled();
  });

  it('leaves the character exactly as it was when the server refuses, and says why', async () => {
    respondWith(400, {
      error: { code: 'bad_request', message: 'This ruleset cannot price level 7' },
    });

    useCharacterStore.getState().dmSetLevel('character-1', 7);
    await vi.waitFor(() => expect(useCharacterStore.getState().isActing).toBe(false));

    expect(useCharacterStore.getState().tableCharacter?.experience).toBe(0);
    expect(useCharacterStore.getState().actionError).toBe('This ruleset cannot price level 7');
  });

  it('asks the network nothing for a character that is not the open table one', () => {
    // A DM adjustment has no local home at all — signed out there is no DM — so this is a
    // precondition rather than a branch, and it says so rather than no-opping in silence
    refuseToFetch();

    useCharacterStore.getState().dmAwardExperience('some-other-character', 10);

    expect(useCharacterStore.getState().actionError).toContain('not at a table');
  });
});

describe('an Event broadcast by the table (TICKET-LIVE-02)', () => {
  /** One Event about the open character */
  function anEvent(after: number) {
    return {
      id: 'event-1',
      seq: 4,
      type: DM_ACTION.AWARD_EXPERIENCE,
      actorAccountId: 'account-dm',
      at: Date.parse('2024-06-01T12:00:00.000Z'),
      payload: {
        characterId: 'character-1',
        action: DM_ACTION.AWARD_EXPERIENCE,
        target: '',
        before: 0,
        after,
      },
    };
  }

  beforeEach(() => {
    const open = aCharacter();

    useCharacterStore.setState({ tableCharacter: open, tableSessionId: 'session-1' });
  });

  it('writes what the Event says into the character held open', () => {
    refuseToFetch();

    const awarded = anEvent(300);
    const effect = useCharacterStore.getState().applyTableEvent(awarded);

    expect(effect).toBe(EVENT_EFFECT.APPLIED);

    const held = useCharacterStore.getState().tableCharacter;

    expect(held?.experience).toBe(300);
    // Applying is not persisting: the browser's roster is not where a session character lives, and
    // this write must not put one there (v3 Req 36.2)
    expect(storage.saveCharacters).not.toHaveBeenCalled();
  });

  it('reports a change it cannot apply rather than guessing at one', () => {
    refuseToFetch();

    const structural = {
      ...anEvent(1),
      type: PLAYER_ACTION.BUILD_ITEM,
      payload: {
        characterId: 'character-1',
        action: PLAYER_ACTION.BUILD_ITEM,
        target: 'item-1',
        before: null,
        after: 'build-1',
      },
    };

    const effect = useCharacterStore.getState().applyTableEvent(structural);

    expect(effect).toBe(EVENT_EFFECT.STALE);

    const held = useCharacterStore.getState().tableCharacter;

    expect(held?.experience).toBe(0);
  });

  it('is not stale when no sheet is open at all', () => {
    refuseToFetch();
    useCharacterStore.setState({ tableCharacter: null });

    // A reader holding nothing cannot be behind, and answering `stale` here would send a surface
    // that is not showing a character off to fetch one
    const awarded = anEvent(300);
    const effect = useCharacterStore.getState().applyTableEvent(awarded);

    expect(effect).toBe(EVENT_EFFECT.ELSEWHERE);
  });
});

describe('with the socket unusable (TICKET-LIVE-03, v3 Req 44.9)', () => {
  beforeEach(() => {
    const open = aCharacter();

    useCharacterStore.setState({ tableCharacter: open, tableSessionId: 'session-1' });
  });

  it('performs a Player’s action and shows the result, with no connection at all', async () => {
    // **The requirement in one case**: the application stays correct with the socket disconnected —
    // actions still work over HTTP and only the liveness is lost. The connection is stubbed to
    // *throw* rather than counted, the shape this file uses for D6: a write path that reached for it
    // and swallowed the failure would satisfy a call count and still be broken for a Player on a
    // train. The structural half — that no store or service may so much as name it — is asserted in
    // `services/liveSocket.test.ts`.
    const moved = aCharacter({ currentResourceValues: { 'stat-health': 23 } });
    respondWith(200, {
      id: 'character-1',
      sessionId: 'session-1',
      rulesetId: null,
      ownerAccountId: 'account-1',
      name: 'Quackers',
      revision: 2,
      createdAt: 0,
      updatedAt: 0,
      character: moved,
    });

    useCharacterStore.getState().adjustCurrentStatValue('character-1', 'stat-health', -7, RULES);
    await vi.waitFor(() => expect(useCharacterStore.getState().isActing).toBe(false));

    const held = useCharacterStore.getState().tableCharacter;

    expect(held?.currentResourceValues['stat-health']).toBe(23);
    expect(useCharacterStore.getState().actionError).toBeNull();
  });

  it('performs a DM’s action too, since the socket is on neither path', async () => {
    const awarded = aCharacter({ experience: 300 });
    respondWith(200, {
      id: 'character-1',
      sessionId: 'session-1',
      rulesetId: null,
      ownerAccountId: 'account-1',
      name: 'Quackers',
      revision: 2,
      createdAt: 0,
      updatedAt: 0,
      character: awarded,
    });

    useCharacterStore.getState().dmAwardExperience('character-1', 300);
    await vi.waitFor(() => expect(useCharacterStore.getState().isActing).toBe(false));

    const held = useCharacterStore.getState().tableCharacter;

    expect(held?.experience).toBe(300);
  });
});
