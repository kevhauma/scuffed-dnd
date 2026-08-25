/**
 * The config store's second destination (TICKET-RUL-02)
 *
 * `useConfigStore` gained one field and two actions; its thirty CRUD actions kept their signatures
 * and their behaviour. This file is about the field.
 *
 * **The claim that matters is a negative one**: opening the Account's ruleset must not read or
 * write the browser's, and going back must not read or write the Account's. It is asserted with
 * *divergent documents in both homes* — two rulesets with different names — so a path that
 * accidentally read the wrong one shows up as the wrong name rather than as a passing test on
 * identical data (v3 Req 36.2, 36.7).
 *
 * The **existing** `configStore.test.ts` is deliberately untouched by this ticket, which is the
 * milestone's fifth Definition-of-Done rule: a ticket that had to edit local mode's tests to make
 * server mode fit has put the branch in the wrong place.
 *
 * **Validates: v3 Req 33.6, 33.8, 36.2**
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { act } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { makeValidConfiguration } from '#shared/services/importExport.fixtures';
import type { Configuration } from '#shared/types/config';
import { RULESET_HOME } from '../services/rulesetSync';
import * as storage from '../services/storage';
import { useConfigStore } from './configStore';
import { useUIStore } from './uiStore';

vi.mock('../services/storage', () => ({
  saveConfiguration: vi.fn(),
  loadConfiguration: vi.fn(),
  clearAllData: vi.fn(),
}));

/** Every non-test module under a directory, recursively */
function modulesUnder(directory: string): string[] {
  return readdirSync(directory).flatMap((entry) => {
    const path = join(directory, entry);
    if (statSync(path).isDirectory()) return modulesUnder(path);
    return /\.tsx?$/.test(entry) && !entry.includes('.test.') ? [path] : [];
  });
}

/** A module's source with its comments removed, so prose about a rule is not mistaken for it */
function codeIn(file: string): string {
  return readFileSync(file, 'utf8').replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, '');
}

/** A ruleset with a distinguishing name */
function ruleset(name: string): Configuration {
  return { ...makeValidConfiguration(), name };
}

/** The document `GET /api/rulesets/:id` answers with */
function documentResponse(name: string, revision: number): Response {
  return new Response(
    JSON.stringify({ id: 'r1', name, schemaVersion: 9, revision, configuration: ruleset(name) }),
    { status: 200, headers: { 'content-type': 'application/json' } }
  );
}

beforeEach(() => {
  useConfigStore.setState({
    config: null,
    isLoaded: false,
    source: { home: RULESET_HOME.BROWSER },
  });
  useUIStore.setState({ rulesetAlert: null, storageFailure: null });
  vi.mocked(storage.saveConfiguration).mockReset();
  vi.mocked(storage.loadConfiguration).mockReset().mockReturnValue(ruleset('In this browser'));
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('the two homes', () => {
  it('starts pointed at the browser, so local mode is the unchanged path', () => {
    expect(useConfigStore.getState().source).toEqual({ home: RULESET_HOME.BROWSER });
  });

  it('opens an account ruleset without reading LocalStorage', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => documentResponse('On the account', 7))
    );

    await act(async () => {
      await useConfigStore.getState().openAccountRuleset('r1');
    });

    const { config, source } = useConfigStore.getState();

    expect(config?.name).toBe('On the account');
    expect(source).toEqual({ home: RULESET_HOME.ACCOUNT, id: 'r1', revision: 7 });
    // Not "was called with the right thing" — not called at all. The browser's ruleset is not a
    // fallback, a cache or a starting point for the account's (D6).
    expect(storage.loadConfiguration).not.toHaveBeenCalled();
    expect(storage.saveConfiguration).not.toHaveBeenCalled();
  });

  it('goes back to the browser’s own ruleset, and the account’s does not shadow it', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => documentResponse('On the account', 7))
    );

    await act(async () => {
      await useConfigStore.getState().openAccountRuleset('r1');
    });
    act(() => {
      useConfigStore.getState().openLocalRuleset();
    });

    // Divergent documents in both homes: a path that read the wrong one shows up as the wrong name
    expect(useConfigStore.getState().config?.name).toBe('In this browser');
    expect(useConfigStore.getState().source).toEqual({ home: RULESET_HOME.BROWSER });
  });

  it('leaves what is open alone when the account ruleset cannot be opened', async () => {
    act(() => {
      useConfigStore.getState().openLocalRuleset();
    });
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(JSON.stringify({ error: { code: 'not_found', message: 'Not found' } }), {
            status: 404,
            headers: { 'content-type': 'application/json' },
          })
      )
    );

    let opened = true;
    await act(async () => {
      opened = await useConfigStore.getState().openAccountRuleset('gone');
    });

    expect(opened).toBe(false);
    expect(useConfigStore.getState().config?.name).toBe('In this browser');
    expect(useConfigStore.getState().source).toEqual({ home: RULESET_HOME.BROWSER });
    expect(useUIStore.getState().rulesetAlert?.message).toBe('Not found');
  });
});

describe('what “this browser” holds while the account’s ruleset is open', () => {
  it('keeps reporting the browser’s own ruleset, not the one in memory', () => {
    // `/rulesets` draws both homes at once, so the local row cannot read `config` — that is the
    // *account's* document whenever one is open, and the row would show its name under a heading
    // saying "This browser"
    act(() => {
      useConfigStore.getState().openLocalRuleset();
    });
    expect(useConfigStore.getState().localSummary?.name).toBe('In this browser');

    useConfigStore.setState({
      config: ruleset('On the account'),
      source: { home: RULESET_HOME.ACCOUNT, id: 'r1', revision: 1 },
    });

    expect(useConfigStore.getState().config?.name).toBe('On the account');
    expect(useConfigStore.getState().localSummary?.name).toBe('In this browser');
  });

  it('follows a local edit without every action having to say so', () => {
    // Refreshed in `autoSave`, which is the one thing all thirty CRUD actions already funnel
    // through — the ticket's whole premise is that their signatures do not change
    act(() => {
      useConfigStore.getState().openLocalRuleset();
    });
    act(() => useConfigStore.getState().renameConfig('Renamed locally'));

    expect(useConfigStore.getState().localSummary?.name).toBe('Renamed locally');
  });
});

describe('actions that mean “this browser”', () => {
  /** Open the account's ruleset, so each case below starts with the wrong home selected */
  async function withAccountRulesetOpen() {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => documentResponse('On the account', 7))
    );
    await act(async () => {
      await useConfigStore.getState().openAccountRuleset('r1');
    });
    vi.mocked(storage.saveConfiguration).mockClear();
  }

  it('sends an import to LocalStorage, never over the account ruleset', async () => {
    // The path that was live and lossy until the RUL-02 review: Import Configuration on the config
    // dashboard calls `replaceConfig`, `autoSave` read `source`, and the imported document went out
    // as a `PUT` over the Account's ruleset. Nobody asked for an upload; the button says it replaces
    // "this ruleset". Putting a Configuration on the Account is IO-04's job and is a **create**.
    await withAccountRulesetOpen();

    act(() => useConfigStore.getState().replaceConfig(ruleset('Imported from a file')));

    expect(useConfigStore.getState().source).toEqual({ home: RULESET_HOME.BROWSER });
    expect(storage.saveConfiguration).toHaveBeenCalledTimes(1);
  });

  it('starts a fresh ruleset in the browser rather than over the account’s', async () => {
    await withAccountRulesetOpen();

    act(() => useConfigStore.getState().initializeConfig('Brand new'));

    expect(useConfigStore.getState().source).toEqual({ home: RULESET_HOME.BROWSER });
    expect(storage.saveConfiguration).toHaveBeenCalledTimes(1);
  });

  it('leaves the browser home selected after discarding stored data', async () => {
    await withAccountRulesetOpen();

    act(() => useConfigStore.getState().discardStoredData());

    // Otherwise the next edit would `PUT` an emptied ruleset to the Account
    expect(useConfigStore.getState().source).toEqual({ home: RULESET_HOME.BROWSER });
    expect(useConfigStore.getState().localSummary).toBeNull();
  });

  it('switches home even when the stored ruleset cannot be read', () => {
    // `loadConfiguration` throws on data this build does not understand. The **home** must still
    // change: a caller that navigated anyway would be editing the Account's ruleset believing it
    // was the browser's, and every keystroke would save there.
    useConfigStore.setState({ source: { home: RULESET_HOME.ACCOUNT, id: 'r1', revision: 1 } });
    vi.mocked(storage.loadConfiguration).mockImplementation(() => {
      throw new Error('unreadable');
    });

    let opened = true;
    act(() => {
      opened = useConfigStore.getState().openLocalRuleset();
    });

    expect(opened).toBe(false);
    expect(useConfigStore.getState().source).toEqual({ home: RULESET_HOME.BROWSER });
    expect(useUIStore.getState().storageFailure).not.toBeNull();
  });
});

describe('signing in and out (v3 Req 36.2)', () => {
  it('gives no auth surface a way to touch either LocalStorage key', () => {
    // *"Signing in SHALL NOT alter, move or clear it"* is a promise about code that does not exist,
    // and the only way to check one of those is to look. A behavioural test would have to enumerate
    // every sign-in path to be worth anything; this enumerates the modules instead, so a future
    // ticket that wires storage into sign-out fails here rather than in somebody's browser.
    const root = resolve(process.cwd(), 'src/client');
    const surfaces = [
      ...modulesUnder(join(root, 'components/auth')),
      join(root, 'routes/signin.tsx'),
      join(root, 'routes/signup.tsx'),
    ];

    const offenders = surfaces
      .filter((file) => /\blocalStorage\b|services\/storage|clearAllData/.test(codeIn(file)))
      .map((file) => relative(root, file).replace(/\\/g, '/'));

    expect(offenders).toEqual([]);
    // …and the scan looked at something, which is the failure mode a source scan has
    expect(surfaces.length).toBeGreaterThan(10);
  });
});

describe('saving the open ruleset', () => {
  it('persists a browser ruleset to LocalStorage and issues no request (D6)', () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => {
        throw new Error('local mode must not reach the network');
      })
    );

    act(() => {
      useConfigStore.getState().openLocalRuleset();
    });
    act(() => useConfigStore.getState().renameConfig('Renamed locally'));

    expect(storage.saveConfiguration).toHaveBeenCalledTimes(1);
    expect(useConfigStore.getState().config?.name).toBe('Renamed locally');
  });

  it('adopts the revision the server actually stored', async () => {
    vi.useFakeTimers();
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_input: string, init: RequestInit) =>
        init.method === 'PUT'
          ? new Response(JSON.stringify({ id: 'r1', revision: 8 }), {
              status: 200,
              headers: { 'content-type': 'application/json' },
            })
          : documentResponse('On the account', 7)
      )
    );

    await act(async () => {
      await useConfigStore.getState().openAccountRuleset('r1');
    });
    act(() => useConfigStore.getState().renameConfig('Renamed on the account'));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });

    // Adopting anything else — the base plus one, say — is how a client talks itself into a
    // conflict it caused
    expect(useConfigStore.getState().source).toEqual({
      home: RULESET_HOME.ACCOUNT,
      id: 'r1',
      revision: 8,
    });
    expect(storage.saveConfiguration).not.toHaveBeenCalled();
  });

  it('leaves the User’s edit in memory when the server refuses it, and says so', async () => {
    vi.useFakeTimers();
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_input: string, init: RequestInit) =>
        init.method === 'PUT'
          ? new Response(
              JSON.stringify({
                error: { code: 'conflict', message: 'Somebody else saved this ruleset.' },
                currentRevision: 9,
              }),
              { status: 409, headers: { 'content-type': 'application/json' } }
            )
          : documentResponse('On the account', 7)
      )
    );

    await act(async () => {
      await useConfigStore.getState().openAccountRuleset('r1');
    });
    act(() => useConfigStore.getState().renameConfig('Still mine'));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });

    // The store, not just the response: v3 Req 33.8 is about what the User is left holding. The
    // edit stays on screen and a banner explains it — the opposite of the LocalStorage path, which
    // rolls back, because there the change *cannot* be kept and here somebody else's also exists.
    expect(useConfigStore.getState().config?.name).toBe('Still mine');
    expect(useUIStore.getState().rulesetAlert?.message).toBe('Somebody else saved this ruleset.');
    // And the base revision is untouched, so a retry is the User's decision rather than automatic
    expect(useConfigStore.getState().source).toEqual({
      home: RULESET_HOME.ACCOUNT,
      id: 'r1',
      revision: 7,
    });
  });
});
