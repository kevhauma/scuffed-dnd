/**
 * What an account page says to somebody who is not signed in (TICKET-AUTH-02)
 *
 * A named component rather than JSX inside `routes/account.tsx`, for one reason that is about to
 * matter: **TICKET-AUTH-03 replaces this**. When the protected-route list and the
 * return-to-destination redirect land (v3 Req 32.6, 32.7), a signed-out visitor is sent to
 * `/signin` instead of reading this — and a thing that is going to be deleted is much easier to
 * delete when it has a name, a file and a test than when it is a branch in a route.
 *
 * It is a card rather than a redirect *today* because inventing a redirect now would be a second
 * implementation for AUTH-03 to unpick, which is exactly what its notes warn against.
 *
 * Layout lives here; the primitives supply the styling.
 *
 * **Validates: v3 Req 31.9**
 */

import { Link } from '@tanstack/react-router';
import { Card } from '../ui/Card/Card';
import { Text } from '../ui/Text/Text';
import { switchLinkStyles } from './authSurfaces.style';

export function SignedOutNotice() {
  return (
    <Card className="mx-auto w-full max-w-md">
      <Text variant="body" as="p">
        You are not signed in.{' '}
        <Link to="/signin" className={switchLinkStyles}>
          Sign in
        </Link>{' '}
        to see this account.
      </Text>
    </Card>
  );
}
