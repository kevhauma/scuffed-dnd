/**
 * Following an invite link, from the browser's side (TICKET-GAM-02)
 *
 * Three claims worth a test:
 *
 * - **It previews before it joins.** Mounting the hook seats nobody, which is what makes an invite
 *   link safe to click.
 * - **A refusal is the server's sentence, rendered.** v3 Req 38.4 asks for four distinct messages
 *   and the server writes all four, so the surface must not invent a fifth or flatten them into one.
 * - **Already a member is an outcome, not an error** (v3 Req 38.7).
 *
 * **Validates: v3 Req 38.1, 38.4, 38.7**
 */

import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MEMBER_ROLE, SESSION_STATUS } from '#shared/types/api';
import { JOIN_OUTCOME, useJoinSession } from './useJoinSession';

/** A JSON response, as `apiRequest` reads one */
function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

/** What the preview answers with */
const PREVIEW = { sessionName: 'Tuesday night', isJoinable: true };

/** What a redemption answers with */
function redemption(joined: boolean) {
  return {
    joined,
    session: {
      id: 'session-1',
      rulesetId: 'ruleset-1',
      name: 'Tuesday night',
      // The constants rather than the literals — the rule reaches fixtures and tests explicitly
      status: SESSION_STATUS.ACTIVE,
      role: MEMBER_ROLE.PLAYER,
      snapshotTakenAt: 1,
      createdAt: 1,
      updatedAt: 1,
    },
  };
}

/** `fetch`, answering the preview one way and the redemption another */
function stubFetch(
  onPost: () => Response,
  onGet: () => Response = () => jsonResponse(200, PREVIEW)
) {
  const fetchSpy = vi.fn((_path: string, init?: RequestInit) =>
    Promise.resolve(init?.method === 'POST' ? onPost() : onGet())
  );

  vi.stubGlobal('fetch', fetchSpy);

  return fetchSpy;
}

beforeEach(() => {
  vi.unstubAllGlobals();
});

describe('useJoinSession', () => {
  it('previews without joining', async () => {
    const fetchSpy = stubFetch(() => jsonResponse(200, redemption(true)));

    const { result } = renderHook(() => useJoinSession('A1B2C-3D4E5'));

    await waitFor(() => expect(result.current.preview?.sessionName).toBe('Tuesday night'));

    // One request, and it was not the one that seats anybody
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(result.current.outcome).toBeNull();
  });

  it('joins on the explicit action, and says so', async () => {
    stubFetch(() => jsonResponse(200, redemption(true)));

    const { result } = renderHook(() => useJoinSession('A1B2C-3D4E5'));
    await waitFor(() => expect(result.current.isPending).toBe(false));

    act(() => result.current.join());

    await waitFor(() => expect(result.current.outcome).toBe(JOIN_OUTCOME.JOINED));
    expect(result.current.session?.name).toBe('Tuesday night');
  });

  it('reports already being a member as a success (v3 Req 38.7)', async () => {
    stubFetch(() => jsonResponse(200, redemption(false)));

    const { result } = renderHook(() => useJoinSession('A1B2C-3D4E5'));
    await waitFor(() => expect(result.current.isPending).toBe(false));

    act(() => result.current.join());

    await waitFor(() => expect(result.current.outcome).toBe(JOIN_OUTCOME.ALREADY));
    expect(result.current.error).toBeNull();
  });

  it('renders the server’s own sentence for a refused code', async () => {
    stubFetch(
      () => jsonResponse(200, redemption(true)),
      () =>
        jsonResponse(409, {
          error: { code: 'conflict', message: 'That invitation was taken back.' },
        })
    );

    const { result } = renderHook(() => useJoinSession('A1B2C-3D4E5'));

    // Four distinct messages are the server's to write; a surface that summarised them would be a
    // fifth wording nobody decided on
    await waitFor(() => expect(result.current.error).toBe('That invitation was taken back.'));
    expect(result.current.preview).toBeNull();
  });

  it('reports a refused join without claiming a seat', async () => {
    stubFetch(() =>
      jsonResponse(409, {
        error: { code: 'conflict', message: 'That game session has been archived.' },
      })
    );

    const { result } = renderHook(() => useJoinSession('A1B2C-3D4E5'));
    await waitFor(() => expect(result.current.isPending).toBe(false));

    act(() => result.current.join());

    await waitFor(() => expect(result.current.error).toContain('archived'));
    expect(result.current.outcome).toBeNull();
    expect(result.current.session).toBeNull();
  });

  it('does not join twice from two clicks', async () => {
    let release: (value: Response) => void = () => {};
    const fetchSpy = vi.fn((_path: string, init?: RequestInit) =>
      init?.method === 'POST'
        ? new Promise<Response>((resolve) => {
            release = resolve;
          })
        : Promise.resolve(jsonResponse(200, PREVIEW))
    );
    vi.stubGlobal('fetch', fetchSpy);

    const { result } = renderHook(() => useJoinSession('A1B2C-3D4E5'));
    await waitFor(() => expect(result.current.isPending).toBe(false));

    act(() => result.current.join());
    await waitFor(() => expect(result.current.isBusy).toBe(true));
    act(() => result.current.join());

    // The preview plus one redemption — the second click found `isBusy` and did nothing
    expect(fetchSpy.mock.calls.filter(([, init]) => init?.method === 'POST')).toHaveLength(1);

    await act(async () => release(jsonResponse(200, redemption(true))));
  });

  it('sends the code exactly as the link carried it', async () => {
    const fetchSpy = stubFetch(() => jsonResponse(200, redemption(true)));

    renderHook(() => useJoinSession('a1b2c 3d4e5'));

    // Normalising is the server's job, and doing it in two places is how the two come to disagree
    await waitFor(() => expect(fetchSpy).toHaveBeenCalled());
    expect(String(fetchSpy.mock.calls[0][0])).toBe(
      `/api/invites/${encodeURIComponent('a1b2c 3d4e5')}`
    );
  });
});
