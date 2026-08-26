/**
 * The invitee's own list, from the browser's side (TICKET-GAM-03)
 *
 * Three claims worth a test:
 *
 * - **Focus is the delivery mechanism.** Nothing is pushed and nothing is emailed (D12), so an
 *   invitation sent while this tab sat in the background arrives because the tab came back and
 *   asked. If that listener goes, the feature silently stops being *delivery* and becomes *a page
 *   you have to reload*.
 * - **Answering re-reads rather than trusting itself**, including after a refusal — *somebody took
 *   that back* is a reason the card should be gone, and leaving it invites a second click.
 * - **A refusal is the server's sentence, rendered**, matching `useJoinSession`.
 *
 * **Validates: v3 Req 38.5, 38.7**
 */

import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { PendingInvitation } from '#shared/types/api';
import { useInvitations } from './useInvitations';

/** A JSON response, as `apiRequest` reads one */
function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

/** One invitation, as the listing carries it */
function invitation(overrides: Partial<PendingInvitation> = {}): PendingInvitation {
  return {
    id: 'invite-1',
    sessionName: 'Tuesday night',
    invitedBy: 'The DM',
    expiresAt: Date.now() + 1_000_000,
    ...overrides,
  };
}

/** `fetch`, answering the listing from a queue and every write the same way */
function stubFetch(
  listings: PendingInvitation[][],
  onWrite: () => Response = () => new Response(null, { status: 204 })
) {
  let read = 0;

  const fetchSpy = vi.fn((_path: string, init?: RequestInit) => {
    if (init?.method && init.method !== 'GET') return Promise.resolve(onWrite());

    const invitations = listings[Math.min(read, listings.length - 1)];
    read += 1;

    return Promise.resolve(jsonResponse(200, { invitations }));
  });

  vi.stubGlobal('fetch', fetchSpy);

  return fetchSpy;
}

afterEach(() => vi.unstubAllGlobals());

describe('useInvitations', () => {
  it('reads what is waiting on mount', async () => {
    stubFetch([[invitation()]]);

    const { result } = renderHook(() => useInvitations());

    await waitFor(() => expect(result.current.isPending).toBe(false));
    expect(result.current.invitations).toHaveLength(1);
    expect(result.current.invitations[0].invitedBy).toBe('The DM');
  });

  it('reads again when the tab comes back, which is how an invitation arrives', async () => {
    // Empty first, then one — the situation the whole delivery mechanism is about
    const fetchSpy = stubFetch([[], [invitation()]]);

    const { result } = renderHook(() => useInvitations());

    await waitFor(() => expect(result.current.isPending).toBe(false));
    expect(result.current.invitations).toEqual([]);

    act(() => window.dispatchEvent(new Event('focus')));

    await waitFor(() => expect(result.current.invitations).toHaveLength(1));
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it('stops listening once it is gone, so a background tab is not a leak', async () => {
    const fetchSpy = stubFetch([[]]);

    const { result, unmount } = renderHook(() => useInvitations());

    await waitFor(() => expect(result.current.isPending).toBe(false));
    unmount();
    window.dispatchEvent(new Event('focus'));

    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it('re-reads after accepting, and reports that it landed', async () => {
    stubFetch([[invitation()], []], () => jsonResponse(200, { joined: true, session: {} }));

    const { result } = renderHook(() => useInvitations());

    await waitFor(() => expect(result.current.invitations).toHaveLength(1));

    let landed = false;
    await act(async () => {
      landed = await result.current.accept('invite-1');
    });

    expect(landed).toBe(true);
    expect(result.current.invitations).toEqual([]);
  });

  it('shows the server’s own sentence when an answer is refused, and re-reads anyway', async () => {
    stubFetch([[invitation()], []], () =>
      jsonResponse(409, {
        error: { code: 'conflict', message: 'That invitation was taken back.' },
      })
    );

    const { result } = renderHook(() => useInvitations());

    await waitFor(() => expect(result.current.invitations).toHaveLength(1));

    let landed = true;
    await act(async () => {
      landed = await result.current.accept('invite-1');
    });

    expect(landed).toBe(false);
    expect(result.current.error).toBe('That invitation was taken back.');
    // The card is gone, because the reason it was refused is a reason it should not be clickable
    expect(result.current.invitations).toEqual([]);
  });

  it('declines through the decline route rather than the accept one', async () => {
    const fetchSpy = stubFetch([[invitation()], []]);

    const { result } = renderHook(() => useInvitations());

    await waitFor(() => expect(result.current.invitations).toHaveLength(1));

    await act(async () => {
      await result.current.decline('invite-1');
    });

    expect(fetchSpy.mock.calls.some(([path]) => path === '/api/invitations/invite-1/decline')).toBe(
      true
    );
  });
});
