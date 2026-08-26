/**
 * The two ways onto the Account (TICKET-IO-04)
 *
 * Three claims are worth a test rather than an eyeball, and the first two are the ticket's:
 *
 * - **The one unprompted offer is not spent on an empty browser** (v3 Req 36.6). Claiming it is a
 *   write the server answers once ever, so asking while there is nothing to upload would burn it on
 *   a dialog with nothing to say — and the Account would never be offered again.
 * - **A signed-out visitor issues no request**, asserted with `fetch` stubbed to *throw* rather than
 *   counted, which is the version of that claim that cannot rot.
 * - **The confirmation stands between the click and the copy** (v3 Req 36.3): opening it sends
 *   nothing, and only the confirm does.
 *
 * **Validates: v3 Req 35.1, 35.5, 36.3, 36.5, 36.6**
 */

import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { toStoredConfiguration } from '#shared/engine/formula/references';
import { createFreshConfiguration } from '#shared/services/freshConfiguration';
import { useRulesetTransfer } from './useRulesetTransfer';

const CONFIG_KEY = 'dnd_builder_config';
const CHARACTERS_KEY = 'dnd_builder_characters';

/** A JSON response, as `apiRequest` reads one */
function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

/** What the import route answers with */
function created(overrides: Record<string, unknown> = {}) {
  return {
    id: 'r1',
    name: 'Ducklets',
    schemaVersion: 9,
    revision: 1,
    createdAt: 1,
    updatedAt: 1,
    charactersCreated: 0,
    report: { isValid: true, errors: [], warnings: [], information: [], timestamp: 'now' },
    ...overrides,
  };
}

/** Put a ruleset in this browser, exactly as the app would have */
function seedBrowser(): void {
  localStorage.setItem(
    CONFIG_KEY,
    JSON.stringify(toStoredConfiguration(createFreshConfiguration('Ducklets')))
  );
  localStorage.setItem(CHARACTERS_KEY, JSON.stringify([]));
}

/** `fetch`, stubbed to answer every call the same way */
function stubFetch(response: () => Response) {
  const fetchSpy = vi.fn(() => Promise.resolve(response()));
  vi.stubGlobal('fetch', fetchSpy);
  return fetchSpy;
}

beforeEach(() => {
  localStorage.clear();
  vi.unstubAllGlobals();
});

describe('useRulesetTransfer', () => {
  it('issues no request at all while nobody is signed in', async () => {
    seedBrowser();
    vi.stubGlobal(
      'fetch',
      vi.fn(() => {
        throw new Error('local mode must not reach the network');
      })
    );

    const { result } = renderHook(() =>
      useRulesetTransfer({ isSignedIn: false, hasLocalRuleset: true, onCreated: vi.fn() })
    );

    expect(result.current.canUpload).toBe(false);
    // The prompt claim is the only thing that fires on mount, and it is gated on there being an
    // Account — a throwing `fetch` would have surfaced as an unhandled rejection otherwise
    await waitFor(() => expect(result.current.failure).toBeNull());
  });

  it('does not spend the one prompt on a browser holding nothing (v3 Req 36.6)', async () => {
    const fetchSpy = stubFetch(() => jsonResponse(200, { shouldPrompt: true }));

    renderHook(() =>
      useRulesetTransfer({ isSignedIn: true, hasLocalRuleset: false, onCreated: vi.fn() })
    );

    await waitFor(() => expect(fetchSpy).not.toHaveBeenCalled());
  });

  it('opens the confirmation unprompted when the server says this Account is owed one', async () => {
    seedBrowser();
    stubFetch(() => jsonResponse(200, { shouldPrompt: true }));

    const { result } = renderHook(() =>
      useRulesetTransfer({ isSignedIn: true, hasLocalRuleset: true, onCreated: vi.fn() })
    );

    await waitFor(() => expect(result.current.pendingUpload?.name).toBe('Ducklets'));
  });

  it('stays closed when the offer has already been taken', async () => {
    seedBrowser();
    const fetchSpy = stubFetch(() => jsonResponse(200, { shouldPrompt: false }));

    const { result } = renderHook(() =>
      useRulesetTransfer({ isSignedIn: true, hasLocalRuleset: true, onCreated: vi.fn() })
    );

    await waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(1));
    expect(result.current.pendingUpload).toBeNull();
  });

  it('sends nothing until the confirmation is confirmed (v3 Req 36.3)', async () => {
    seedBrowser();
    const fetchSpy = stubFetch(() => jsonResponse(200, { shouldPrompt: false }));

    const { result } = renderHook(() =>
      useRulesetTransfer({ isSignedIn: true, hasLocalRuleset: true, onCreated: vi.fn() })
    );

    await waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(1));

    act(() => result.current.openUpload());

    expect(result.current.pendingUpload?.name).toBe('Ducklets');
    // Still only the prompt claim: opening the question asks nothing of the server
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it('copies on confirmation, and reports the created ruleset by name', async () => {
    seedBrowser();
    const onCreated = vi.fn();
    let answer = jsonResponse(200, { shouldPrompt: false });
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve(answer.clone()))
    );

    const { result } = renderHook(() =>
      useRulesetTransfer({ isSignedIn: true, hasLocalRuleset: true, onCreated })
    );

    act(() => result.current.openUpload());
    answer = jsonResponse(200, created({ name: 'Ducklets', charactersCreated: 2 }));
    await act(async () => result.current.confirmUpload());

    await waitFor(() => expect(result.current.result?.name).toBe('Ducklets'));
    expect(result.current.result?.charactersCreated).toBe(2);
    expect(result.current.pendingUpload).toBeNull();
    expect(onCreated).toHaveBeenCalled();
  });

  it('keeps the confirmation open and says why when the server refuses', async () => {
    seedBrowser();
    let answer = jsonResponse(200, { shouldPrompt: false });
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve(answer.clone()))
    );

    const { result } = renderHook(() =>
      useRulesetTransfer({ isSignedIn: true, hasLocalRuleset: true, onCreated: vi.fn() })
    );

    act(() => result.current.openUpload());
    answer = jsonResponse(400, {
      error: { code: 'bad_request', message: 'That ruleset is not a shape this server can read.' },
    });
    await act(async () => result.current.confirmUpload());

    await waitFor(() => expect(result.current.failure?.message).toContain('not a shape'));
    // The User's decision is still in front of them rather than a dialog that vanished
    expect(result.current.pendingUpload).not.toBeNull();
    expect(result.current.result).toBeNull();
  });

  it('carries the failing fields the server named, not just the sentence', async () => {
    // The server attaches them precisely so a client can say *which part could not be read*, and
    // the config dashboard's Import has listed them since v1.0 — reading only `message` made the
    // account path the vaguer of the two for the same file (the IO-04 review)
    stubFetch(() =>
      jsonResponse(400, {
        error: {
          code: 'bad_request',
          message: 'That ruleset is not a shape this server can read.',
        },
        fields: ["Field 'stats' must be an array", "Field 'skills' must be an array"],
      })
    );

    const { result } = renderHook(() =>
      useRulesetTransfer({ isSignedIn: true, hasLocalRuleset: false, onCreated: vi.fn() })
    );

    act(() =>
      result.current.importFile(
        new File([JSON.stringify({ schemaVersion: 9 })], 'ruleset.json', {
          type: 'application/json',
        })
      )
    );

    await waitFor(() => expect(result.current.failure?.fields).toHaveLength(2));
    expect(result.current.failure?.fields[0]).toContain('stats');
  });

  it('refuses a second file while the first is still on the wire', async () => {
    // Without the guard, picking twice in quick succession creates two rulesets from one intention
    let release: (value: Response) => void = () => {};
    const fetchSpy = vi.fn(
      () =>
        new Promise<Response>((resolve) => {
          release = resolve;
        })
    );
    vi.stubGlobal('fetch', fetchSpy);

    const { result } = renderHook(() =>
      useRulesetTransfer({ isSignedIn: true, hasLocalRuleset: false, onCreated: vi.fn() })
    );

    const file = () =>
      new File([JSON.stringify({ schemaVersion: 9 })], 'ruleset.json', {
        type: 'application/json',
      });

    act(() => result.current.importFile(file()));
    await waitFor(() => expect(result.current.isBusy).toBe(true));

    act(() => result.current.importFile(file()));

    expect(fetchSpy).toHaveBeenCalledTimes(1);

    await act(async () => release(jsonResponse(200, created())));
  });

  it('reports the referential report of an imported file without calling it a refusal', async () => {
    const report = {
      isValid: false,
      errors: [{ severity: 'error', category: 'reference', message: 'ladder missing' }],
      warnings: [],
      information: [],
      timestamp: 'now',
    };
    stubFetch(() => jsonResponse(200, created({ name: 'From a file', report })));

    const { result } = renderHook(() =>
      useRulesetTransfer({ isSignedIn: true, hasLocalRuleset: false, onCreated: vi.fn() })
    );

    const file = new File([JSON.stringify({ schemaVersion: 9 })], 'ruleset.json', {
      type: 'application/json',
    });

    act(() => result.current.importFile(file));

    await waitFor(() => expect(result.current.result?.name).toBe('From a file'));
    expect(result.current.result?.issues).toHaveLength(1);
    expect(result.current.failure).toBeNull();
  });

  it('refuses a file that is not JSON without asking the server about it', async () => {
    const fetchSpy = stubFetch(() => jsonResponse(200, created()));

    const { result } = renderHook(() =>
      useRulesetTransfer({ isSignedIn: true, hasLocalRuleset: false, onCreated: vi.fn() })
    );

    act(() => result.current.importFile(new File(['not json at all'], 'ruleset.json')));

    await waitFor(() => expect(result.current.failure?.message).toContain('Invalid JSON'));
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
