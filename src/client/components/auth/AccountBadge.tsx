/**
 * Who you are signed in as, on the beam (TICKET-AUTH-01)
 *
 * The signed-in Account's email in the application shell (v3 Req 30.8), and the sign-out that goes
 * with it. Signed out it is a sign-in link and nothing else — **not a wall**. A visitor who never
 * signs in gets the v2.0 app plus this one control
 * ([D6](../../../../docs/v3.0_backend/overview.md#d6--local-mode-stays-sign-in-gates-connected-play-only)),
 * and nothing about their experience degrades.
 *
 * **It renders nothing at all while the answer is unknown.** The first paint has not heard back
 * from the server yet, and showing *Sign in* during that moment makes the beam flicker for
 * everybody who is already signed in — which reads as having been signed out.
 *
 * Layout lives here; the primitives supply the styling.
 *
 * **Validates: v3 Req 30.8**
 */

import { Link, useRouter } from '@tanstack/react-router';
import { useState } from 'react';
import { Button } from '../ui/Button/Button';
import { signInLinkStyles } from './AccountBadge.style';
import { authClient } from './authClient';
import { useAuth } from './useAuth';

export function AccountBadge() {
  const { email, isPending, isSignedIn } = useAuth();
  const [isSigningOut, setIsSigningOut] = useState(false);
  const router = useRouter();

  if (isPending) return null;

  if (!isSignedIn) {
    return (
      <Link to="/signin" className={signInLinkStyles}>
        Sign in
      </Link>
    );
  }

  async function signOut() {
    setIsSigningOut(true);
    try {
      await authClient.signOut();
      // The cookie is gone and `useSession` will re-ask; the invalidate is what makes any route
      // currently showing account data re-decide what it can show
      await router.invalidate();
    } finally {
      setIsSigningOut(false);
    }
  }

  return (
    <div className="flex items-center gap-3">
      {/* The address is the way to `/account` (TICKET-AUTH-02): the linked-identities view is the
          only account surface there is, and a second control on the beam for it would be a control
          most visitors never need */}
      {/* `title` says where the link *goes*, not what it already says — the address is the visible
          label, so repeating it in a tooltip would carry no information */}
      <Link to="/account" className={signInLinkStyles} title="Your account">
        {email}
      </Link>
      <Button variant="plaque" onClick={signOut} disabled={isSigningOut}>
        {isSigningOut ? 'Signing out…' : 'Sign out'}
      </Button>
    </div>
  );
}
