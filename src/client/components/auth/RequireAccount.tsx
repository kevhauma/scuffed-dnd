/**
 * A protected route's contents, or a trip to sign-in (TICKET-AUTH-03)
 *
 * Wraps whatever a route in [`protectedRoutes.ts`](./protectedRoutes.ts) renders, and answers the
 * three states `useAuth` has:
 *
 * | State | What happens |
 * |---|---|
 * | pending | nothing renders — see below |
 * | signed in | the children |
 * | signed out | a redirect to `/signin`, carrying where to come back to |
 *
 * **Rendering nothing while the answer is unknown is the load-bearing case.** The first paint has
 * not heard back from the server, and treating *unknown* as *signed out* would redirect somebody
 * who is already signed in — every time they open the app. That is the `AccountBadge` flicker again,
 * except that here it throws the User off the page they asked for. TICKET-AUTH-04's criterion 8
 * asks for exactly this on the rendered output rather than by timing.
 *
 * **The redirect is a navigation, not a rendered message.** A card saying *you are not signed in*
 * leaves the User to find the sign-in page and then find their way back; this takes them and
 * returns them (v3 Req 32.7). AUTH-02's `SignedOutNotice` was the placeholder that said so, and it
 * is deleted rather than left beside this.
 *
 * **This is client-side convenience, never the enforcement.** The server refuses the same request
 * whatever the browser did (v3 Req 32.8) — `auth/guards.ts` is the rule, and this is a courtesy
 * that saves a round trip and a confusing empty page.
 *
 * **Validates: v3 Req 32.6, 32.7**
 */

import { useLocation, useNavigate } from '@tanstack/react-router';
import { type ReactNode, useEffect, useRef } from 'react';
import { signInSearch } from './signInDestination';
import { useAuth } from './useAuth';

export interface RequireAccountProps {
  children: ReactNode;
}

export function RequireAccount({ children }: RequireAccountProps) {
  const { isPending, isSignedIn } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  /**
   * Where to come back to, captured on the first render and never updated
   *
   * **This is the fix for a redirect loop the browser check found**, and it is worth the ref. The
   * destination was read *live* from the location, and the location is not this component's — it
   * changes the moment the redirect starts. So the effect re-ran with `/signin?redirect=/account`
   * as the new destination and sent that, and again, and again: a URL growing
   * `%252525…Fsignin%25253Fredirect` until it filled the address bar. The route a guard was mounted
   * under is fixed at mount; reading it later is reading somebody else's answer.
   */
  const destination = useRef(location.href);

  // In an effect rather than during render: navigating while rendering is a state update inside
  // another component's render pass, which React 19 warns about and which makes the redirect fire
  // twice under StrictMode. The deps are the auth answer and nothing else — putting the location
  // among them is what made the loop above possible.
  useEffect(() => {
    if (isPending || isSignedIn) return;

    void navigate({
      to: '/signin',
      // The whole `href`, so a query string on the protected route survives the round trip — v3
      // Req 32.7 asks for the *requested route*, and half of one is a worse answer than none.
      // `signInSearch` refuses anything that is not a path on this origin.
      search: signInSearch(destination.current),
      replace: true,
    });
  }, [isPending, isSignedIn, navigate]);

  if (isPending || !isSignedIn) return null;

  return <>{children}</>;
}
