/**
 * The identities on this Account, and adding one (TICKET-AUTH-02)
 *
 * v3 Req 31.9's two halves in one card: show an Account which identities are linked, and let it
 * link the provider it does not yet have.
 *
 * **It says out loud why this matters**, because the reason is not obvious from a list of two
 * buttons: with no password reset ([D12](../../../../docs/v3.0_backend/overview.md#d12--no-outbound-email-at-all)),
 * a linked identity is the only way back into an Account whose password is lost. AUTH-01's sign-up
 * warning points here, and this is where that promise is kept.
 *
 * **With no provider configured it says so plainly** rather than rendering an empty list — an
 * Account looking for the recovery path it was promised deserves to be told the deployment has
 * none, not shown a blank card.
 *
 * Layout lives here; the primitives supply the styling.
 *
 * **Validates: v3 Req 31.9**
 */

import { Button } from '../ui/Button/Button';
import { Card } from '../ui/Card/Card';
import { Text } from '../ui/Text/Text';
import { AuthAlert } from './AuthAlert';
import { identityRowStyles, linkedMarkerStyles } from './LinkedIdentities.style';
import { PROVIDER_LABEL } from './providerLabel';
import { useLinkedIdentities } from './useLinkedIdentities';

export function LinkedIdentities() {
  const { linked, available, isPending, busy, error, link } = useLinkedIdentities();

  return (
    <Card className="mx-auto w-full max-w-md">
      <div className="flex flex-col gap-4">
        <Text variant="h2" as="h1">
          Linked identities
        </Text>

        <Text variant="body" as="p">
          This application sends no email, so there is no password reset. Linking Google or Discord
          is the way back into this account if you lose the password.
        </Text>

        {isPending ? (
          <Text variant="caption" as="p">
            Checking…
          </Text>
        ) : (
          <div className="flex flex-col gap-2">
            {linked.map((provider) => (
              <div key={provider} className={identityRowStyles}>
                <Text variant="body" as="span">
                  {PROVIDER_LABEL[provider]}
                </Text>
                <span className={linkedMarkerStyles}>Linked</span>
              </div>
            ))}

            {available.map((provider) => (
              <div key={provider} className={identityRowStyles}>
                <Text variant="body" as="span">
                  {PROVIDER_LABEL[provider]}
                </Text>
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={busy !== null}
                  onClick={() => link(provider)}
                >
                  {busy === provider ? 'Redirecting…' : `Link ${PROVIDER_LABEL[provider]}`}
                </Button>
              </div>
            ))}

            {linked.length === 0 && available.length === 0 && (
              <Text variant="caption" as="p">
                This server has no sign-in providers configured, so there is nothing to link.
              </Text>
            )}
          </div>
        )}

        <AuthAlert message={error} />
      </div>
    </Card>
  );
}
