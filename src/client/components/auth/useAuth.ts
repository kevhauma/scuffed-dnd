/**
 * Who is signed in, as far as this browser knows (TICKET-AUTH-01)
 *
 * A thin hook over Better Auth's `useSession`, so components depend on *us* rather than on the
 * library — and so the day AUTH-04 changes how a session is renewed, one file knows.
 *
 * **This is a cache of a server fact, not app state.** There is deliberately no Zustand store
 * beside it: the server is authoritative
 * ([D5](../../../../docs/v3.0_backend/overview.md#d5--the-engine-is-the-shared-kernel-and-the-server-is-authoritative)),
 * the identity lives in an `HttpOnly` cookie this code cannot read, and a second copy in a store
 * would be a second thing to keep in step. The convention it looks like it is breaking — *one
 * Zustand store per concern* — is about state the client owns.
 *
 * **`isPending` is a real third state and callers must handle it.** On the first render nobody
 * knows yet, and treating that as *signed out* is what makes a sign-in button flash on every page
 * load for somebody who is already signed in.
 *
 * **Validates: v3 Req 30.8, 32.6**
 */

import { authClient } from './authClient';

/** What the shell and the guards need to know */
export interface AuthState {
  /**
   * The signed-in Account's id, or null when nobody is signed in (TICKET-GAM-04)
   *
   * **The same id every server table keys on**, which is what makes it useful: GAM-04's lobby is
   * the first surface listing *other people*, and it has to tell which row is you before it can
   * offer *Leave* on yours and *Remove* on theirs. The alternative was a per-caller `isYou` on the
   * wire; this is the same fact the cookie already established, so asking the server to repeat it
   * would be a second copy of something the client is holding anyway.
   */
  accountId: string | null;
  /** The signed-in Account's email, or null when nobody is signed in */
  email: string | null;
  /** True while the answer is still unknown — neither signed in nor signed out */
  isPending: boolean;
  /** True once the server has confirmed an Account */
  isSignedIn: boolean;
}

/**
 * The current Account
 *
 * @returns Who is signed in, and whether that is known yet
 */
export function useAuth(): AuthState {
  const { data, isPending } = authClient.useSession();

  return {
    accountId: data?.user.id ?? null,
    email: data?.user.email ?? null,
    isPending,
    isSignedIn: Boolean(data?.user),
  };
}
