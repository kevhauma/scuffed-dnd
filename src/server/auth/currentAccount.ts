/**
 * Who is asking, resolved from the Auth_Session cookie (TICKET-AUTH-01)
 *
 * **One place, once per request** (v3 Req 32.1). The pipeline calls this while building the
 * context and every handler reads `context.account`; nothing else asks. That is not tidiness — an
 * authorization rule is only as good as the number of places that decide *who you are*, and this
 * milestone's answer is one.
 *
 * **An absent, malformed or expired cookie is nobody**, never an error. A visitor with no session
 * is the normal case — local mode is the whole app signed out
 * ([D6](../../../docs/v3.0_backend/overview.md#d6--local-mode-stays-sign-in-gates-connected-play-only))
 * — so a failure to resolve is an answer rather than a refusal. AUTH-03 is what turns *nobody* into
 * a 404 on the routes where that matters.
 *
 * **Validates: v3 Req 32.1**
 */

import type { RequestAccount } from './account';
import { authServer } from './authServer';

/**
 * The Account this request carries, or nobody
 *
 * @param request The incoming request, cookies and all
 * @returns The acting account, or `null`
 */
export async function accountFromRequest(request: Request): Promise<RequestAccount | null> {
  // No cookie header at all is the overwhelmingly common case — every request from a signed-out
  // visitor, and every request for a static asset. Answering it without touching the database is
  // worth the two lines.
  if (!request.headers.has('cookie')) return null;

  try {
    const session = await authServer().api.getSession({ headers: request.headers });
    return session?.user ? { id: session.user.id } : null;
  } catch {
    // A cookie that does not verify, names a session that was signed out, or names one that has
    // expired all arrive here. None of them is a server error and none of them is worth telling
    // the caller about: they are all *nobody*.
    return null;
  }
}
