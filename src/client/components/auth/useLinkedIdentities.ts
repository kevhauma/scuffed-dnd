/**
 * Which identities an Account holds, and adding the one it does not (TICKET-AUTH-02)
 *
 * The `useXManager` shape applied to the account page: it asks the server what is linked, works out
 * what is still on offer, and owns the one action (v3 Req 31.9). The component below it destructures
 * this and renders.
 *
 * **This view exists in *this* ticket rather than in an account-settings page nobody has scheduled**
 * because D12 makes it the way back in: with no password reset, an Account whose password is lost
 * and which linked nothing is gone. Somewhere to add a provider is therefore a recovery feature.
 *
 * **Unlinking is deliberately absent.** Nothing has asked for it, and the obvious footgun — a
 * password-less Account unlinking its only identity and locking itself out — is a rule that would
 * have to be written and tested. It is a ticket, not a line here.
 *
 * **Validates: v3 Req 31.9**
 */

import { useCallback, useEffect, useState } from 'react';
import { isSocialProvider, type SocialProvider } from '#shared/types/socialProvider';
import { authClient } from './authClient';
import { useSocialProviders } from './useSocialProviders';

/** Where a link lands once the provider sends the Account back */
const AFTER_LINK = '/account';

/** What the account page needs */
export interface LinkedIdentitiesManager {
  /** Providers this Account has already linked */
  linked: SocialProvider[];
  /** Configured providers it has not linked yet */
  available: SocialProvider[];
  /** True while either answer is still unknown */
  isPending: boolean;
  /** The provider a link is in flight for, or null */
  busy: SocialProvider | null;
  error: string | null;
  link: (provider: SocialProvider) => void;
}

/**
 * Drive the linked-identities view
 *
 * @returns What is linked, what is on offer, and how to add one
 */
export function useLinkedIdentities(): LinkedIdentitiesManager {
  const { providers, isPending: providersPending } = useSocialProviders();
  const [linked, setLinked] = useState<SocialProvider[] | null>(null);
  const [busy, setBusy] = useState<SocialProvider | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function ask() {
      try {
        const result = await authClient.listAccounts();
        // `credential` is the password row and is not a provider — filtering by the known set drops
        // it without this hook having to know that name
        const rows = result.data ?? [];
        if (!cancelled) setLinked(rows.map((row) => row.providerId).filter(isSocialProvider));
      } catch {
        if (!cancelled) setLinked([]);
      }
    }

    void ask();

    return () => {
      cancelled = true;
    };
  }, []);

  const link = useCallback((provider: SocialProvider) => {
    setBusy(provider);
    setError(null);

    // Better Auth's client sets `window.location` on success, so there is nothing to navigate here
    void authClient
      .linkSocial({ provider, callbackURL: AFTER_LINK })
      .then((result) => {
        if (!result.error) return;
        setError(result.error.message ?? 'Could not start linking. Try again.');
        setBusy(null);
      })
      .catch(() => {
        setError('Could not reach the server. Check your connection and try again.');
        setBusy(null);
      });
  }, []);

  return {
    linked: linked ?? [],
    available: providers.filter((provider) => !(linked ?? []).includes(provider)),
    isPending: providersPending || linked === null,
    busy,
    error,
    link,
  };
}
