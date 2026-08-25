/**
 * Reading the configured provider list (TICKET-AUTH-02)
 *
 * `fetch` is stubbed at the boundary, so what is exercised is the *hook*: that an unknown provider
 * name cannot become a button, and that every way the request can fail ends in "no providers"
 * rather than in an error a visitor cannot act on.
 *
 * The server's half — that the list really is names only, and really is empty when nothing is
 * configured — is `src/server/http/apiRouter.test.ts`, against the real route.
 *
 * **Validates: v3 Req 31.6**
 */

import { renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SOCIAL_PROVIDER } from '#shared/types/socialProvider';
import { useSocialProviders } from './useSocialProviders';

/** Answer the one request this hook makes */
function respondWith(body: unknown, ok = true) {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({ ok, json: () => Promise.resolve(body) } as Response)
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('useSocialProviders', () => {
  it('should start pending, because nobody knows yet', () => {
    respondWith({ providers: [] });

    expect(renderHook(() => useSocialProviders()).result.current).toEqual({
      providers: [],
      isPending: true,
    });
  });

  it('should report the providers the server named', async () => {
    respondWith({ providers: [SOCIAL_PROVIDER.GOOGLE, SOCIAL_PROVIDER.DISCORD] });

    const { result } = renderHook(() => useSocialProviders());

    await waitFor(() => expect(result.current.isPending).toBe(false));
    expect(result.current.providers).toEqual([SOCIAL_PROVIDER.GOOGLE, SOCIAL_PROVIDER.DISCORD]);
  });

  it('should drop a provider this build cannot render a button for', async () => {
    // A newer server offering `github` must not produce a button whose label is `undefined`
    respondWith({ providers: [SOCIAL_PROVIDER.GOOGLE, 'github', 17, null] });

    const { result } = renderHook(() => useSocialProviders());

    await waitFor(() => expect(result.current.isPending).toBe(false));
    expect(result.current.providers).toEqual([SOCIAL_PROVIDER.GOOGLE]);
  });

  it('should report none when the request is refused', async () => {
    respondWith({ providers: [SOCIAL_PROVIDER.GOOGLE] }, false);

    const { result } = renderHook(() => useSocialProviders());

    await waitFor(() => expect(result.current.isPending).toBe(false));
    expect(result.current.providers).toEqual([]);
  });

  it('should report none when the request throws, rather than surfacing an error', async () => {
    // The person in front of this came to sign in; email and password still work, and the one
    // thing that must not happen is a button for a provider the server cannot complete
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));

    const { result } = renderHook(() => useSocialProviders());

    await waitFor(() => expect(result.current.isPending).toBe(false));
    expect(result.current.providers).toEqual([]);
  });

  it('should report none when the body is not the shape it expects', async () => {
    respondWith({ nothing: 'useful' });

    const { result } = renderHook(() => useSocialProviders());

    await waitFor(() => expect(result.current.isPending).toBe(false));
    expect(result.current.providers).toEqual([]);
  });

  it('should ask once per mount rather than on every render', async () => {
    respondWith({ providers: [] });

    const { result, rerender } = renderHook(() => useSocialProviders());
    await waitFor(() => expect(result.current.isPending).toBe(false));
    rerender();

    expect(vi.mocked(fetch)).toHaveBeenCalledTimes(1);
  });
});
