/**
 * One wizard, two destinations (TICKET-CHAR-04)
 *
 * **The branch is the subject.** `createCharacterHere` is the one place the app decides whether a
 * new character goes to LocalStorage or to a table, and the way that goes wrong is not a crash — it
 * is a character quietly written to the wrong home. So both directions are driven with `fetch`
 * stubbed, and each asserts the *other* destination was untouched:
 *
 * - Local: LocalStorage holds it, and **nothing was requested**. That is D6's promise, and a stub
 *   that throws is what makes the assertion real rather than decorative.
 * - Session: the request went out with **only the Player's choices** on it, and LocalStorage is
 *   still empty. A body carrying a derived value is refused by the server, but the client should
 *   not be sending one in the first place.
 *
 * **The refusal carries the server's sentence.** A bare `null` would leave the wizard showing a
 * Player a button that stopped working, which is the failure the union return exists to prevent.
 *
 * **Validates: v3 Req 40.0, 40.5, 40.6**
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createFreshConfiguration } from '#shared/services/freshConfiguration';
import type { Configuration } from '#shared/types/config';
import { RULESET_HOME, type RulesetSource } from '../services/rulesetSync';
import { useCharacterStore } from './characterStore';

/**
 * A ruleset complete enough to price a character
 *
 * `createFreshConfiguration` rather than an object literal, because *complete enough* means the
 * `xp_thresholds` and `points_per_level` a budget is derived through — a hand-written ruleset
 * without them makes every allocation unpriceable and every creation refused, which would have
 * this file passing for the wrong reason.
 */
function config(): Configuration {
  return createFreshConfiguration('Destination Ruleset');
}

/** The Player's choices, and nothing else */
const CHOICES = {
  name: 'Quackers',
  raceIds: [],
  investedStatPoints: {},
  investedSkillPoints: {},
};

/** A JSON response, as `apiSend` reads one */
function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

const LOCAL: RulesetSource = { home: RULESET_HOME.BROWSER };
const AT_A_TABLE: RulesetSource = { home: RULESET_HOME.SESSION, sessionId: 'session-1' };

beforeEach(() => {
  localStorage.clear();
  useCharacterStore.setState({ characters: [], isLoaded: true });
});

afterEach(() => vi.unstubAllGlobals());

describe('createCharacterHere', () => {
  it('writes a local character to this browser and asks the network nothing', async () => {
    vi.stubGlobal('fetch', () => {
      throw new Error('local mode must not reach the network');
    });

    const result = await useCharacterStore.getState().createCharacterHere(LOCAL, CHOICES, config());

    expect(result.created?.name).toBe('Quackers');
    expect(localStorage.getItem('dnd_builder_characters')).toContain('Quackers');
    expect(useCharacterStore.getState().characters).toHaveLength(1);
  });

  it('sends a session character to its table and writes nothing to this browser', async () => {
    const fetchSpy = vi.fn(() =>
      Promise.resolve(
        jsonResponse(200, {
          id: 'character-1',
          sessionId: 'session-1',
          rulesetId: null,
          ownerAccountId: 'account-1',
          name: 'Quackers',
          revision: 1,
          createdAt: 1,
          updatedAt: 1,
          character: { id: 'character-1', name: 'Quackers' },
        })
      )
    );
    vi.stubGlobal('fetch', fetchSpy);

    const result = await useCharacterStore
      .getState()
      .createCharacterHere(AT_A_TABLE, CHOICES, config());

    expect(result.created?.id).toBe('character-1');

    const [path, init] = fetchSpy.mock.calls[0] as unknown as [string, RequestInit];

    expect(path).toBe('/api/sessions/session-1/characters');
    expect(init.method).toBe('POST');

    // **Only the Player's choices.** Everything else about a character is worked out from the
    // Snapshot, and the server rejects a body carrying one of those by name. `archetypeId` is
    // absent rather than `undefined` because this ruleset defines none and `JSON.stringify` drops
    // it — which is the shape the server's `optionalString` reads as *not picked*.
    expect(Object.keys(JSON.parse(String(init.body)) as object).sort()).toEqual([
      'investedSkillPoints',
      'investedStatPoints',
      'name',
      'raceIds',
    ]);

    // The two homes never meet: nothing went to the browser's own roster
    expect(localStorage.getItem('dnd_builder_characters')).toBeNull();
    expect(useCharacterStore.getState().characters).toEqual([]);
  });

  it('hands back the server’s own sentence when a table refuses it', async () => {
    vi.stubGlobal('fetch', () =>
      Promise.resolve(
        jsonResponse(400, {
          error: { code: 'bad_request', message: 'A character needs an archetype.' },
        })
      )
    );

    const result = await useCharacterStore
      .getState()
      .createCharacterHere(AT_A_TABLE, CHOICES, config());

    expect(result.created).toBeNull();
    // Not a bare `null`: the wizard has to be able to tell the Player which rule they broke
    expect(result.created === null && result.message).toBe('A character needs an archetype.');
  });

  it('says something rather than nothing when local creation is refused', async () => {
    vi.stubGlobal('fetch', () => {
      throw new Error('local mode must not reach the network');
    });

    // Three races is past the blend the sheet's hybrid is defined over
    const result = await useCharacterStore
      .getState()
      .createCharacterHere(LOCAL, { ...CHOICES, raceIds: ['a', 'b', 'c'] }, config());

    expect(result.created).toBeNull();
    expect(result.created === null && result.message.length).toBeGreaterThan(0);
    expect(useCharacterStore.getState().characters).toEqual([]);
  });
});
