/**
 * The two homes, and the promise that they never touch (TICKET-RUL-01)
 *
 * The claim worth testing here is D6's: **signed out, nothing reaches the network**. It is asserted
 * with `fetch` stubbed to throw, which is the only version of that claim that cannot rot — a spy
 * counting calls passes just as well when the hook fetches and swallows the result.
 *
 * The rest is the confirmation loop: the server refuses a delete that a Game_Session stands in the
 * way of, and what the User is shown is **the server's own sentence** rather than a guess this hook
 * makes about what the server would say (v3 Req 33.7).
 *
 * **Validates: v3 Req 33.7, 36.1, 36.2**
 */

import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { RulesetSummary } from '#shared/types/api';

const useAuth = vi.fn();

vi.mock('../auth/useAuth', () => ({ useAuth: () => useAuth() }));

import { useConfigStore } from '../../stores/configStore';
import { useRulesetManager } from './useRulesetManager';

/** One ruleset on the account, in the wire shape both roots share */
function summary(id: string, name: string): RulesetSummary {
  return { id, name, schemaVersion: 9, revision: 1, createdAt: 1, updatedAt: 1 };
}

/** A JSON response, as `apiRequest` reads one */
function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

beforeEach(() => {
  useAuth.mockReturnValue({ email: null, isPending: false, isSignedIn: false });
  useConfigStore.setState({ config: null, localSummary: null, isLoaded: true });
  vi.unstubAllGlobals();
});

describe('useRulesetManager', () => {
  it('issues no request at all while nobody is signed in (D6)', async () => {
    // Stubbed to throw rather than counted: local mode provably needs no server, and a hook that
    // fetched and ignored the answer would satisfy a call-count assertion
    vi.stubGlobal(
      'fetch',
      vi.fn(() => {
        throw new Error('local mode must not reach the network');
      })
    );

    const { result } = renderHook(() => useRulesetManager());

    expect(result.current.isSignedIn).toBe(false);
    expect(result.current.accountRulesets).toEqual([]);
    expect(result.current.error).toBeNull();
  });

  it('falls back rather than rendering NaN when the stored timestamp is unreadable', () => {
    // A ruleset written before the field existed, or one somebody hand-edited. `Date.parse` gives
    // NaN, `toLocaleString` renders that as "Invalid Date", and neither is worth a second failure
    // mode on a list — so the row draws with the epoch instead.
    // `localSummary`, not `config`: since TICKET-RUL-02 `config` holds whichever ruleset is open,
    // and the local row must keep saying what *this browser* holds even while that is the account's
    useConfigStore.setState({
      localSummary: { name: 'Ducklets', updatedAt: 'not a date' },
      isLoaded: true,
    });
    vi.stubGlobal('fetch', vi.fn());

    const { result } = renderHook(() => useRulesetManager());

    expect(result.current.localRuleset).toEqual({ name: 'Ducklets', updatedAt: 0 });
  });

  it('reports the browser’s ruleset whether or not anybody is signed in', () => {
    useConfigStore.setState({
      localSummary: { name: 'Ducklets', updatedAt: '2026-08-01T10:00:00.000Z' },
      isLoaded: true,
    });
    vi.stubGlobal('fetch', vi.fn());

    const { result } = renderHook(() => useRulesetManager());

    // Normalised to epoch milliseconds here rather than in the card, because the two homes store
    // the moment differently and a row that renders a date should not have to know that
    expect(result.current.localRuleset).toEqual({
      name: 'Ducklets',
      updatedAt: Date.parse('2026-08-01T10:00:00.000Z'),
    });
  });

  it('lists the account’s rulesets once there is an account', async () => {
    useAuth.mockReturnValue({ email: 'a@b.c', isPending: false, isSignedIn: true });
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        jsonResponse(200, {
          rulesets: [{ id: 'r1', name: 'Emberfall', revision: 1, updatedAt: 1 }],
        })
      )
    );

    const { result } = renderHook(() => useRulesetManager());

    await waitFor(() => expect(result.current.accountRulesets).toHaveLength(1));
    expect(result.current.accountRulesets[0].name).toBe('Emberfall');
  });

  it('turns a refused delete into the server’s own confirmation (v3 Req 33.7)', async () => {
    useAuth.mockReturnValue({ email: 'a@b.c', isPending: false, isSignedIn: true });

    const fetchMock = vi.fn(async (input: string) => {
      if (input.includes('confirm=true')) return new Response(null, { status: 204 });
      if (input === '/api/rulesets') return jsonResponse(200, { rulesets: [] });
      return jsonResponse(409, {
        error: { code: 'conflict', message: '1 game session was started from this ruleset.' },
      });
    });
    vi.stubGlobal('fetch', fetchMock);

    const { result } = renderHook(() => useRulesetManager());
    await waitFor(() => expect(result.current.isAccountPending).toBe(false));

    act(() => {
      result.current.remove(summary('r1', 'Emberfall'));
    });

    await waitFor(() => expect(result.current.pendingDelete).not.toBeNull());
    expect(result.current.pendingDelete?.message).toBe(
      '1 game session was started from this ruleset.'
    );
    // Not an error banner: a conflict the User can resolve is a question, not a failure
    expect(result.current.error).toBeNull();

    act(() => result.current.confirmDelete());

    await waitFor(() => expect(result.current.pendingDelete).toBeNull());
    expect(fetchMock.mock.calls.some(([url]) => String(url).includes('confirm=true'))).toBe(true);
  });

  it('reports a refusal that is not a conflict as an error', async () => {
    useAuth.mockReturnValue({ email: 'a@b.c', isPending: false, isSignedIn: true });
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: string) =>
        input === '/api/rulesets'
          ? jsonResponse(200, { rulesets: [] })
          : jsonResponse(404, { error: { code: 'not_found', message: 'Not found' } })
      )
    );

    const { result } = renderHook(() => useRulesetManager());
    await waitFor(() => expect(result.current.isAccountPending).toBe(false));

    act(() => {
      result.current.remove(summary('gone', 'Gone'));
    });

    await waitFor(() => expect(result.current.error).toBe('Not found'));
    expect(result.current.pendingDelete).toBeNull();
  });
});
