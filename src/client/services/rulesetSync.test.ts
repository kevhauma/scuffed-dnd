/**
 * Where a ruleset edit goes, and how often (TICKET-RUL-02)
 *
 * Two claims worth a test rather than an eyeball.
 *
 * **Local mode needs no server**, asserted with `fetch` stubbed to *throw* rather than counted — a
 * path that fetched and ignored the answer would satisfy a call-count assertion and would still
 * have broken D6. This is the milestone's fifth Definition-of-Done rule at the one place that could
 * break it.
 *
 * **A burst of edits is one request carrying the last of them.** Driven with fake timers, because
 * the alternative is a test that waits 800 ms per case and gets skipped.
 *
 * **Validates: v3 Req 33.6, 33.8, 36.2**
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { makeValidConfiguration } from '#shared/services/importExport.fixtures';
import type { Configuration } from '#shared/types/config';
import {
  cancelPendingSaves,
  LOCAL_SOURCE,
  persistRuleset,
  RULESET_HOME,
  type RulesetSource,
  SAVE_OUTCOME,
} from './rulesetSync';
import * as storage from './storage';

vi.mock('./storage', () => ({ saveConfiguration: vi.fn() }));

/** The ruleset on the account, at the revision the client believes it holds */
const ACCOUNT: RulesetSource = { home: RULESET_HOME.ACCOUNT, id: 'r1', revision: 4 };

/** A ruleset with a distinguishing name, so a coalesced save can be told from an earlier one */
function ruleset(name: string): Configuration {
  return { ...makeValidConfiguration(), name };
}

/** A saved response, as the route sends one */
function savedResponse(revision: number): Response {
  return new Response(JSON.stringify({ id: 'r1', revision }), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
}

/** What the last request carried */
function lastBody(fetchMock: ReturnType<typeof vi.fn>): {
  revision: number;
  configuration: Configuration;
} {
  const [, init] = fetchMock.mock.calls.at(-1) as [string, RequestInit];
  return JSON.parse(String(init.body));
}

beforeEach(() => {
  cancelPendingSaves();
  vi.mocked(storage.saveConfiguration).mockReset();
});

afterEach(() => {
  cancelPendingSaves();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('persistRuleset — the browser home', () => {
  it('writes LocalStorage and touches no network at all (D6)', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => {
        throw new Error('local mode must not reach the network');
      })
    );

    const config = ruleset('Ducklets');
    const outcome = await persistRuleset(LOCAL_SOURCE, config);

    expect(storage.saveConfiguration).toHaveBeenCalledWith(config);
    expect(outcome.outcome).toBe(SAVE_OUTCOME.SAVED);
  });

  it('lets a storage failure out, exactly as it did before this ticket', () => {
    // `configStore`'s `autoSave` has caught this since CR-11 and rolls the edit back. Swallowing it
    // here would turn a refused write into a silent one, which is the bug CR-11 fixed.
    vi.mocked(storage.saveConfiguration).mockImplementation(() => {
      throw new Error('quota');
    });

    expect(() => persistRuleset(LOCAL_SOURCE, ruleset('Ducklets'))).toThrow('quota');
  });
});

describe('persistRuleset — the session home (TICKET-CHAR-04)', () => {
  /**
   * A game's pinned Snapshot, which takes no edits at all (D7)
   *
   * This is the answer to *can any surface write to a Snapshot?*, and it is answered **here** rather
   * than by each panel knowing not to offer one — which is the whole reason the home is a value in
   * this union instead of a flag somewhere.
   */
  const AT_A_TABLE = { home: RULESET_HOME.SESSION, sessionId: 'session-1' } as const;

  it('refuses the edit, writes no LocalStorage and sends no request', async () => {
    const fetchMock = vi.fn(() => {
      throw new Error('a Snapshot takes no edits');
    });
    vi.stubGlobal('fetch', fetchMock);

    const outcome = await persistRuleset(AT_A_TABLE, ruleset('Ducklets'));

    expect(outcome.outcome).toBe(SAVE_OUTCOME.FAILED);
    expect(storage.saveConfiguration).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('says why, rather than discarding the edit quietly', () => {
    // A surface that silently dropped a change would leave somebody retuning a stat for ten
    // minutes and wondering why nothing stuck
    return persistRuleset(AT_A_TABLE, ruleset('Ducklets')).then((outcome) => {
      expect(outcome.outcome === SAVE_OUTCOME.FAILED && outcome.message).toMatch(
        /copy of the rules your game is played by/i
      );
    });
  });
});

describe('persistRuleset — the account home', () => {
  it('coalesces a burst of edits into one request carrying the last state', async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn(async () => savedResponse(5));
    vi.stubGlobal('fetch', fetchMock);

    const saves = [
      persistRuleset(ACCOUNT, ruleset('one')),
      persistRuleset(ACCOUNT, ruleset('two')),
      persistRuleset(ACCOUNT, ruleset('three')),
    ];

    // Nothing has gone yet: the point of the debounce is that typing is not twelve requests
    expect(fetchMock).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(1000);
    const outcomes = await Promise.all(saves);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(lastBody(fetchMock).configuration.name).toBe('three');
    // Every caller learns what happened, not just the one whose state was sent
    expect(outcomes.every((outcome) => outcome.outcome === SAVE_OUTCOME.SAVED)).toBe(true);
  });

  it('states the revision it is based on', async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn(async () => savedResponse(5));
    vi.stubGlobal('fetch', fetchMock);

    const save = persistRuleset(ACCOUNT, ruleset('Ducklets'));
    await vi.advanceTimersByTimeAsync(1000);

    expect(lastBody(fetchMock).revision).toBe(4);
    expect(await save).toEqual({ outcome: SAVE_OUTCOME.SAVED, rulesetId: 'r1', revision: 5 });
  });

  it('reports a stale revision as a conflict rather than a failure', async () => {
    vi.useFakeTimers();
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              error: { code: 'conflict', message: 'Somebody else saved this.' },
              currentRevision: 9,
            }),
            { status: 409, headers: { 'content-type': 'application/json' } }
          )
      )
    );

    const save = persistRuleset(ACCOUNT, ruleset('Ducklets'));
    await vi.advanceTimersByTimeAsync(1000);

    expect(await save).toEqual({
      outcome: SAVE_OUTCOME.CONFLICT,
      rulesetId: 'r1',
      message: 'Somebody else saved this.',
    });
  });

  it('carries the refused fields through on a shape failure', async () => {
    vi.useFakeTimers();
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              error: { code: 'bad_request', message: 'Not a shape this server can read.' },
              fields: ['stats: must be an array'],
            }),
            { status: 400, headers: { 'content-type': 'application/json' } }
          )
      )
    );

    const save = persistRuleset(ACCOUNT, ruleset('Ducklets'));
    await vi.advanceTimersByTimeAsync(1000);

    expect(await save).toEqual({
      outcome: SAVE_OUTCOME.FAILED,
      rulesetId: 'r1',
      message: 'Not a shape this server can read.',
      fields: ['stats: must be an array'],
    });
  });

  it('reports an unreachable server without pretending the server decided anything', async () => {
    vi.useFakeTimers();
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.reject(new TypeError('network')))
    );

    const save = persistRuleset(ACCOUNT, ruleset('Ducklets'));
    await vi.advanceTimersByTimeAsync(1000);
    const outcome = await save;

    expect(outcome.outcome).toBe(SAVE_OUTCOME.FAILED);
  });

  it('never has two writes in flight for one ruleset at once', async () => {
    // Two overlapping PUTs would race the revision guard against *each other*, and the loser's
    // conflict would be this module's doing rather than a second Owner's — a conflict the User
    // cannot act on, because nobody else did anything.
    vi.useFakeTimers();

    let release: (() => void) | undefined;
    const fetchMock = vi.fn(
      async () =>
        new Promise<Response>((resolve) => {
          release = () => resolve(savedResponse(5));
        })
    );
    vi.stubGlobal('fetch', fetchMock);

    void persistRuleset(ACCOUNT, ruleset('one'));
    await vi.advanceTimersByTimeAsync(1000);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    // A second edit arrives while the first is still on the wire
    void persistRuleset(ACCOUNT, ruleset('two'));
    await vi.advanceTimersByTimeAsync(1000);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    release?.();
    await vi.advanceTimersByTimeAsync(1000);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(lastBody(fetchMock).configuration.name).toBe('two');
    // **And it states the revision the first save produced, not the one the caller believed.**
    // The caller scheduled at 4 because that is all the store knew; by send time the server had
    // confirmed 5. Sending 4 would be refused — a conflict this module caused, with nobody else
    // having edited anything, which is exactly what the one-write-in-flight rule exists to prevent
    // and did not until the RUL-02 review found it.
    expect(lastBody(fetchMock).revision).toBe(5);
  });

  it('does not manufacture a conflict out of its own successful save', async () => {
    // The same defect from the other side, stated as a behaviour rather than as a payload: two
    // sequential edits, the second scheduled before the first was confirmed, and both accepted
    vi.useFakeTimers();

    let current = 4;
    const fetchMock = vi.fn(async (_input: string, init: RequestInit) => {
      const { revision } = JSON.parse(String(init.body)) as { revision: number };
      if (revision !== current) {
        return new Response(
          JSON.stringify({
            error: { code: 'conflict', message: 'stale' },
            currentRevision: current,
          }),
          { status: 409, headers: { 'content-type': 'application/json' } }
        );
      }
      current += 1;
      return savedResponse(current);
    });
    vi.stubGlobal('fetch', fetchMock);

    const first = persistRuleset(ACCOUNT, ruleset('one'));
    await vi.advanceTimersByTimeAsync(1000);

    // ACCOUNT still says revision 4 — the store has not been told about the save yet
    const second = persistRuleset(ACCOUNT, ruleset('two'));
    await vi.advanceTimersByTimeAsync(1000);

    expect((await first).outcome).toBe(SAVE_OUTCOME.SAVED);
    expect((await second).outcome).toBe(SAVE_OUTCOME.SAVED);
  });

  it('says which ruleset an outcome is about', () => {
    // A request already on the wire cannot be aborted, so an outcome can arrive after another
    // ruleset has been opened. Without the id the store would adopt this revision onto that one.
    vi.useFakeTimers();
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => savedResponse(5))
    );

    const save = persistRuleset(ACCOUNT, ruleset('Ducklets'));

    return vi.advanceTimersByTimeAsync(1000).then(async () => {
      expect(await save).toEqual({ outcome: SAVE_OUTCOME.SAVED, rulesetId: 'r1', revision: 5 });
    });
  });
});
