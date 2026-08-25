/**
 * *Continue with Google* / *Continue with Discord* (TICKET-AUTH-02)
 *
 * The two buttons under the password form, on both the sign-in and the sign-up surface — one
 * component, because the two surfaces make the same offer and Better Auth's social flow does not
 * distinguish them: a first sign-in *is* the sign-up.
 *
 * **A button appears only when the server can complete its flow** (v3 Req 31.6). The list comes
 * from [`useSocialProviders`](./useSocialProviders.ts), and with none configured this renders
 * nothing at all — not an empty rule, not a "no providers" message. An operator who never wanted
 * social sign-in should see the AUTH-01 card unchanged.
 *
 * **The redirect is Better Auth's**, not ours: its client sets `window.location` on a successful
 * `signIn.social`, so there is nothing here to navigate. What is here is the refusal — a network
 * failure or an unconfigured provider has to say so rather than leaving a button that does nothing.
 *
 * Layout lives here; the primitives supply the styling.
 *
 * **Validates: v3 Req 31.6, 31.9**
 */

import { useState } from 'react';
import type { SocialProvider } from '#shared/types/socialProvider';
import { Button } from '../ui/Button/Button';
import { Text } from '../ui/Text/Text';
import { AuthAlert } from './AuthAlert';
import { authClient } from './authClient';
import { PROVIDER_LABEL } from './providerLabel';
import { separatorRuleStyles, separatorStyles } from './SocialSignInButtons.style';
import { useSocialProviders } from './useSocialProviders';

/**
 * Where a completed sign-in lands
 *
 * A constant rather than a prop, because there is one caller and *"no option, prop, or config flag
 * that nothing uses yet"*. It is spelled the same way as `useLinkedIdentities`'s `AFTER_LINK`, so
 * the two adjacent flows answer the same question the same way. The day a second surface needs a
 * different landing, that is when it becomes a prop.
 */
const AFTER_SIGN_IN = '/';

export function SocialSignInButtons() {
  const { providers, isPending } = useSocialProviders();
  const [busy, setBusy] = useState<SocialProvider | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Nothing to offer, or not known yet — either way the card reads as it did before this ticket
  if (isPending || providers.length === 0) return null;

  async function continueWith(provider: SocialProvider) {
    setBusy(provider);
    setError(null);

    try {
      const result = await authClient.signIn.social({ provider, callbackURL: AFTER_SIGN_IN });
      // On success the client has already set `window.location`; reaching here with an error means
      // the server refused before the provider was ever involved
      if (result.error) {
        setError(
          result.error.message ?? `Could not start sign-in with ${PROVIDER_LABEL[provider]}.`
        );
        setBusy(null);
      }
    } catch {
      setError('Could not reach the server. Check your connection and try again.');
      setBusy(null);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className={separatorStyles}>
        <span className={separatorRuleStyles} />
        <Text variant="caption" as="span">
          or
        </Text>
        <span className={separatorRuleStyles} />
      </div>

      {providers.map((provider) => (
        <Button
          key={provider}
          variant="secondary"
          className="w-full"
          disabled={busy !== null}
          onClick={() => void continueWith(provider)}
        >
          {busy === provider ? 'Redirecting…' : `Continue with ${PROVIDER_LABEL[provider]}`}
        </Button>
      ))}

      <AuthAlert message={error} />
    </div>
  );
}
