/**
 * Which sign-in buttons this deployment has (TICKET-AUTH-02)
 *
 * The client cannot know whether an operator configured Google, Discord, both or neither — those
 * are server-side variables — so it asks. `/api/auth-providers` answers with names only, and a
 * provider missing from that list gets no button rather than a button that fails (v3 Req 31.6).
 *
 * **`isPending` is a real third state**, for the same reason it is in [`useAuth`](./useAuth.ts):
 * on the first render nobody knows yet, and rendering *no buttons* during that moment makes the
 * sign-in card jump as they arrive.
 *
 * **A failed request means no buttons, not an error.** The person in front of it came to sign in;
 * email and password still work, and a red box about a configuration endpoint would be telling
 * them about somebody else's problem. The one path that must never happen is a button for a
 * provider the server cannot complete.
 *
 * **Local mode never calls this** — nothing outside the auth surfaces renders it (D6).
 *
 * **Validates: v3 Req 31.6, 31.9**
 */

import { useEffect, useState } from 'react';
import { isSocialProvider, type SocialProvider } from '#shared/types/socialProvider';

/** Where the list comes from — a relative path, because there is only ever one origin (D1) */
const PROVIDERS_PATH = '/api/auth-providers';

/** What a surface needs in order to decide what to draw */
export interface SocialProvidersState {
  /** The configured providers, in offer order; empty until known, and empty when there are none */
  providers: SocialProvider[];
  /** True while the answer is still unknown — neither "none" nor a list */
  isPending: boolean;
}

/** The providers in a response body, ignoring anything this build cannot render */
function providersFrom(body: unknown): SocialProvider[] {
  if (typeof body !== 'object' || body === null) return [];
  const listed = (body as { providers?: unknown }).providers;
  return Array.isArray(listed) ? listed.filter(isSocialProvider) : [];
}

/**
 * Ask the server which providers it can complete a sign-in through
 *
 * @returns The configured providers, and whether that is known yet
 */
export function useSocialProviders(): SocialProvidersState {
  const [state, setState] = useState<SocialProvidersState>({ providers: [], isPending: true });

  useEffect(() => {
    // A deployment does not gain a provider while the page is open, so this asks once. `cancelled`
    // rather than an AbortController: the request is cheap and already in flight, and what actually
    // matters is not calling `setState` after the component has gone.
    let cancelled = false;

    async function ask() {
      try {
        const response = await fetch(PROVIDERS_PATH, { headers: { accept: 'application/json' } });
        const providers = response.ok ? providersFrom(await response.json()) : [];
        if (!cancelled) setState({ providers, isPending: false });
      } catch {
        if (!cancelled) setState({ providers: [], isPending: false });
      }
    }

    void ask();

    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}
