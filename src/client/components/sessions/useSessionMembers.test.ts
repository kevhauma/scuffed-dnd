/**
 * The roster, from the browser's side (TICKET-GAM-04)
 *
 * Three claims worth a test:
 *
 * - **Remove and transfer go to different paths**, and neither goes to the session's *invite* route.
 *   `DELETE /api/sessions/:id/members/:accountId` and `POST /api/sessions/:id/dm` are one segment
 *   apart from `DELETE /api/sessions/:id/invite`, which takes the table's shared code back — a
 *   wrong path here would be a very quiet bug.
 * - **A write re-reads rather than trusting what it said**, which is how the row a DM just removed
 *   leaves the list without the client guessing at the new shape.
 * - **The staleness guard**, for `useSessionInvitations`'s reason: an answer for table A landing
 *   after table B is open would put one table's people under another's.
 *
 * **Validates: v3 Req 39.3, 39.4, 39.7**
 */

import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { SessionMemberListing, SessionMemberSummary } from '#shared/types/api';
import { MEMBER_ROLE } from '#shared/types/api';
import { useSessionMembers } from './useSessionMembers';

/** A JSON response, as `apiRequest` reads one */
function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

/** One Member, as the roster carries them */
function member(overrides: Partial<SessionMemberSummary> = {}): SessionMemberSummary {
  return {
    accountId: 'account-ada',
    name: 'Ada',
    role: MEMBER_ROLE.PLAYER,
    joinedAt: 1_760_000_000_000,
    characters: [],
    ...overrides,
  };
}

/** A listing with the given members and nothing left behind */
function listing(members: SessionMemberSummary[]): SessionMemberListing {
  return { members, departedCharacters: [] };
}

/** `fetch`, answering each `GET` from a queue and every write the same way */
function stubFetch(reads: SessionMemberListing[], onWrite = () => jsonResponse(200, {})) {
  let read = 0;

  const fetchSpy = vi.fn((_path: string, init?: RequestInit) => {
    if (init?.method && init.method !== 'GET') return Promise.resolve(onWrite());

    const answer = reads[Math.min(read, reads.length - 1)];
    read += 1;

    return Promise.resolve(jsonResponse(200, answer));
  });

  vi.stubGlobal('fetch', fetchSpy);

  return fetchSpy;
}

afterEach(() => vi.unstubAllGlobals());

describe('useSessionMembers', () => {
  it('asks nothing while no table is open', () => {
    const fetchSpy = stubFetch([listing([])]);

    renderHook(() => useSessionMembers(null));

    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('reads the open table’s roster', async () => {
    const fetchSpy = stubFetch([listing([member()])]);

    const { result } = renderHook(() => useSessionMembers('session-1'));

    await waitFor(() => expect(result.current.members).toHaveLength(1));
    expect(fetchSpy).toHaveBeenCalledWith('/api/sessions/session-1/members', expect.anything());
  });

  it('carries the characters whose player has gone', async () => {
    stubFetch([{ members: [member()], departedCharacters: [{ id: 'c1', name: 'Old Quackers' }] }]);

    const { result } = renderHook(() => useSessionMembers('session-1'));

    await waitFor(() => expect(result.current.departedCharacters).toHaveLength(1));
  });

  it('re-reads after a removal rather than trusting the 204', async () => {
    const fetchSpy = stubFetch([
      listing([member(), member({ accountId: 'account-bob' })]),
      listing([member()]),
    ]);

    const { result } = renderHook(() => useSessionMembers('session-1'));

    await waitFor(() => expect(result.current.members).toHaveLength(2));

    let removed = false;
    await act(async () => {
      removed = await result.current.remove('account-bob');
    });

    expect(removed).toBe(true);
    expect(result.current.members).toHaveLength(1);
    // The member's own path, never the session's `invite` one — that takes the shared code back
    expect(fetchSpy.mock.calls.find(([, init]) => init?.method === 'DELETE')?.[0]).toBe(
      '/api/sessions/session-1/members/account-bob'
    );
  });

  it('hands the table over through the role’s own path', async () => {
    const fetchSpy = stubFetch([listing([member()])]);

    const { result } = renderHook(() => useSessionMembers('session-1'));

    await waitFor(() => expect(result.current.members).toHaveLength(1));

    await act(async () => {
      await result.current.transfer('account-ada');
    });

    const posted = fetchSpy.mock.calls.find(([, init]) => init?.method === 'POST');

    expect(posted?.[0]).toBe('/api/sessions/session-1/dm');
    expect(JSON.parse(String((posted?.[1] as RequestInit).body))).toEqual({
      accountId: 'account-ada',
    });
  });

  it('shows the server’s own sentence when a write is refused, and keeps the roster', async () => {
    stubFetch([listing([member()])], () =>
      jsonResponse(409, {
        error: { code: 'conflict', message: 'You run this game, so you cannot leave it.' },
      })
    );

    const { result } = renderHook(() => useSessionMembers('session-1'));

    await waitFor(() => expect(result.current.members).toHaveLength(1));

    let removed = true;
    await act(async () => {
      removed = await result.current.remove('account-ada');
    });

    expect(removed).toBe(false);
    expect(result.current.error).toBe('You run this game, so you cannot leave it.');
    expect(result.current.members).toHaveLength(1);
  });

  it('treats a 404 on the re-read as “you have left”, not as a fault', async () => {
    // Giving up **your own** seat is the one write whose re-read is guaranteed to be refused: the
    // roster sits behind `requireMember` and the caller has just stopped being one. Showing *not
    // found* in red on the way out would report a success as a failure.
    let seated = true;

    vi.stubGlobal(
      'fetch',
      vi.fn((_path: string, init?: RequestInit) => {
        if (init?.method === 'DELETE') {
          seated = false;
          return Promise.resolve(new Response(null, { status: 204 }));
        }

        return Promise.resolve(
          seated
            ? jsonResponse(200, listing([member()]))
            : jsonResponse(404, { error: { code: 'not_found', message: 'Not found.' } })
        );
      })
    );

    const { result } = renderHook(() => useSessionMembers('session-1'));

    await waitFor(() => expect(result.current.members).toHaveLength(1));

    let removed = false;
    await act(async () => {
      removed = await result.current.remove('account-ada');
    });

    // The write landed, so the manager closes the row and reloads the games list
    expect(removed).toBe(true);
    expect(result.current.members).toEqual([]);
    expect(result.current.error).toBeNull();
  });

  it('discards an answer for a table that is no longer open', async () => {
    let releaseA: (() => void) | null = null;
    const aLanded = new Promise<void>((resolve) => {
      releaseA = resolve;
    });

    vi.stubGlobal(
      'fetch',
      vi.fn(async (path: string) => {
        if (path === '/api/sessions/session-a/members') {
          await aLanded;
          return jsonResponse(200, listing([member({ accountId: 'from-a' })]));
        }
        return jsonResponse(200, listing([member({ accountId: 'from-b' })]));
      })
    );

    const { result, rerender } = renderHook(({ id }) => useSessionMembers(id), {
      initialProps: { id: 'session-a' },
    });

    rerender({ id: 'session-b' });
    await waitFor(() => expect(result.current.members[0]?.accountId).toBe('from-b'));

    await act(async () => {
      releaseA?.();
      await aLanded;
    });

    expect(result.current.members.map((one) => one.accountId)).toEqual(['from-b']);
  });

  it('clears what it was showing when the row closes', async () => {
    stubFetch([listing([member()])]);

    const { result, rerender } = renderHook(
      ({ id }: { id: string | null }) => useSessionMembers(id),
      { initialProps: { id: 'session-1' as string | null } }
    );

    await waitFor(() => expect(result.current.members).toHaveLength(1));
    rerender({ id: null });

    expect(result.current.members).toEqual([]);
  });
});
