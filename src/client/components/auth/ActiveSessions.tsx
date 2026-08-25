/**
 * Where this Account is signed in, and how to stop being (TICKET-AUTH-04)
 *
 * v3 Req 48.7's visible half. A session here can last ninety days (D13), which is only a defensible
 * number if there is a way to end one — so the card is really about the two buttons, and the list is
 * what makes them usable.
 *
 * **The current session is labelled, not hidden.** Somebody deciding which session to end has to be
 * able to tell which one they are sitting in; a list that quietly omits it is a list whose count
 * does not match reality.
 *
 * Layout lives here; the primitives supply the styling.
 *
 * **Validates: v3 Req 48.7**
 */

import { Button } from '../ui/Button/Button';
import { Card } from '../ui/Card/Card';
import { Text } from '../ui/Text/Text';
import { currentMarkerStyles, sessionRowStyles } from './ActiveSessions.style';
import { AuthAlert } from './AuthAlert';
import { useActiveSessions } from './useActiveSessions';

/** A date somebody can read, in their own locale */
function signedInOn(iso: string): string {
  return new Date(iso).toLocaleString();
}

export function ActiveSessions() {
  const { sessions, isPending, error, revoke, revokeAll } = useActiveSessions();

  return (
    <Card className="mx-auto w-full max-w-md">
      <div className="flex flex-col gap-4">
        <Text variant="h2" as="h2">
          Where you are signed in
        </Text>

        <Text variant="body" as="p">
          Signing in lasts up to ninety days. End a session here if you signed in somewhere you no
          longer have.
        </Text>

        {isPending ? (
          <Text variant="caption" as="p">
            Checking…
          </Text>
        ) : (
          <div className="flex flex-col gap-2">
            {sessions.map((session) => (
              <div key={session.token} className={sessionRowStyles}>
                <div className="flex flex-col">
                  <Text variant="body" as="span">
                    {signedInOn(session.createdAt)}
                  </Text>
                  {session.userAgent && (
                    <Text variant="caption" as="span">
                      {session.userAgent}
                    </Text>
                  )}
                </div>

                {session.isCurrent ? (
                  <span className={currentMarkerStyles}>This browser</span>
                ) : (
                  <Button variant="secondary" size="sm" onClick={() => revoke(session.token)}>
                    End
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}

        <AuthAlert message={error} />

        <Button variant="danger" className="w-full" onClick={revokeAll}>
          Sign out everywhere
        </Button>

        <Text variant="caption" as="p">
          Ends every session including this one, so you will need to sign in again.
        </Text>
      </div>
    </Card>
  );
}
