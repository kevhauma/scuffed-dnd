/**
 * The DM's outbox, from the browser's side (TICKET-GAM-03)
 *
 * **The staleness guard is why this file exists.** Expanding table A and then table B in quick
 * succession can land A's answer after B's, and here that would put one table's invitees under
 * another table's panel — somebody's email address on the wrong page. `useSessionInvite` has the
 * same guard and no test; that is folder precedent rather than a rule, and it is the wrong
 * precedent to follow for a race documented as protecting a privacy leak.
 *
 * The other two claims: **a write re-reads rather than trusting what it said**, and **revoke goes to
 * the invitation's own path** rather than to the session's — the two collections are deliberately
 * different, and a `DELETE` sent to the wrong one takes back the table's shared code.
 *
 * **Validates: v3 Req 38.3, 38.4**
 */

import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AddressedInvite } from '#shared/types/api';
import { INVITE_STATE } from '#shared/types/api';
import { useSessionInvitations } from './useSessionInvitations';

/** A JSON response, as `apiRequest` reads one */
function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

/** One addressed invitation, as the DM's listing carries it */
function sent(overrides: Partial<AddressedInvite> = {}): AddressedInvite {
  return {
    id: 'invite-1',
    email: 'ada@example.test',
    state: INVITE_STATE.PENDING,
    expiresAt: 1_760_000_000_000,
    ...overrides,
  };
}

/** `fetch`, answering each `GET` from a queue keyed by the session in the path */
function stubFetch(
  byPath: Record<string, AddressedInvite[]>,
  onWrite = () => jsonResponse(200, {})
) {
  const fetchSpy = vi.fn((path: string, init?: RequestInit) => {
    if (init?.method && init.method !== 'GET') return Promise.resolve(onWrite());

    return Promise.resolve(jsonResponse(200, { invites: byPath[path] ?? [] }));
  });

  vi.stubGlobal('fetch', fetchSpy);

  return fetchSpy;
}

afterEach(() => vi.unstubAllGlobals());

describe('useSessionInvitations', () => {
  it('asks nothing while no table is open', () => {
    const fetchSpy = stubFetch({});

    renderHook(() => useSessionInvitations(null));

    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('reads the open table’s outbox', async () => {
    stubFetch({ '/api/sessions/session-1/invitations': [sent()] });

    const { result } = renderHook(() => useSessionInvitations('session-1'));

    await waitFor(() => expect(result.current.invites).toHaveLength(1));
    expect(result.current.invites[0].email).toBe('ada@example.test');
  });

  it('discards an answer for a table that is no longer open', async () => {
    // A cannot be answered until B has been asked, so A's response is guaranteed to land last —
    // the exact ordering the `showing` ref exists for, made deterministic rather than raced
    let releaseA: (() => void) | null = null;
    const aLanded = new Promise<void>((resolve) => {
      releaseA = resolve;
    });

    vi.stubGlobal(
      'fetch',
      vi.fn(async (path: string) => {
        if (path === '/api/sessions/session-a/invitations') {
          await aLanded;
          return jsonResponse(200, { invites: [sent({ id: 'from-a', email: 'a@example.test' })] });
        }
        return jsonResponse(200, { invites: [sent({ id: 'from-b', email: 'b@example.test' })] });
      })
    );

    const { result, rerender } = renderHook(({ id }) => useSessionInvitations(id), {
      initialProps: { id: 'session-a' },
    });

    rerender({ id: 'session-b' });
    await waitFor(() => expect(result.current.invites[0]?.id).toBe('from-b'));

    await act(async () => {
      releaseA?.();
      await aLanded;
    });

    // A's answer arrived second and was dropped, rather than putting A's invitees under B
    expect(result.current.invites.map((one) => one.id)).toEqual(['from-b']);
  });

  it('clears what it was showing when the row closes', async () => {
    stubFetch({ '/api/sessions/session-1/invitations': [sent()] });

    const { result, rerender } = renderHook(
      ({ id }: { id: string | null }) => useSessionInvitations(id),
      { initialProps: { id: 'session-1' as string | null } }
    );

    await waitFor(() => expect(result.current.invites).toHaveLength(1));
    rerender({ id: null });

    expect(result.current.invites).toEqual([]);
  });

  it('re-reads after sending, and reports that it landed', async () => {
    const listings: Record<string, AddressedInvite[]> = { '/api/sessions/s/invitations': [] };
    const fetchSpy = vi.fn((path: string, init?: RequestInit) => {
      if (init?.method === 'POST') {
        listings['/api/sessions/s/invitations'] = [sent()];
        return Promise.resolve(jsonResponse(200, sent()));
      }
      return Promise.resolve(jsonResponse(200, { invites: listings[path] ?? [] }));
    });
    vi.stubGlobal('fetch', fetchSpy);

    const { result } = renderHook(() => useSessionInvitations('s'));

    await waitFor(() => expect(result.current.isPending).toBe(false));

    let landed = false;
    await act(async () => {
      landed = await result.current.send('ada@example.test');
    });

    expect(landed).toBe(true);
    // The listing came from a re-read, not from the write's own answer
    expect(result.current.invites).toHaveLength(1);
  });

  it('reports a refused send without clearing what is on screen', async () => {
    stubFetch({ '/api/sessions/s/invitations': [sent()] }, () =>
      jsonResponse(409, {
        error: { code: 'conflict', message: 'ada@example.test is already at this table.' },
      })
    );

    const { result } = renderHook(() => useSessionInvitations('s'));

    await waitFor(() => expect(result.current.invites).toHaveLength(1));

    let landed = true;
    await act(async () => {
      landed = await result.current.send('ada@example.test');
    });

    expect(landed).toBe(false);
    expect(result.current.error).toBe('ada@example.test is already at this table.');
    expect(result.current.invites).toHaveLength(1);
  });

  it('takes one back through the invitation’s own path, not the session’s', async () => {
    const fetchSpy = stubFetch({ '/api/sessions/s/invitations': [sent()] }, () =>
      jsonResponse(200, {})
    );

    const { result } = renderHook(() => useSessionInvitations('s'));

    await waitFor(() => expect(result.current.invites).toHaveLength(1));

    await act(async () => {
      result.current.revoke('invite-1');
      await vi.waitFor(() =>
        expect(fetchSpy.mock.calls.some(([, init]) => init?.method === 'DELETE')).toBe(true)
      );
    });

    // `/api/invitations/:id`, never `/api/sessions/:id/invite` — that one is the shared code
    const deleted = fetchSpy.mock.calls.find(([, init]) => init?.method === 'DELETE');
    expect(deleted?.[0]).toBe('/api/invitations/invite-1');
  });
});
