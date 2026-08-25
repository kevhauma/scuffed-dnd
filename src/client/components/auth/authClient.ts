/**
 * The browser's half of Better Auth (TICKET-AUTH-01)
 *
 * **No `baseURL`, and that is D1 rather than an omission.** The server hosts the client bundle, so
 * the API is at a relative path on whatever origin the page was served from; Better Auth's client
 * defaults to exactly that. A variable naming the backend is a variable somebody eventually points
 * elsewhere (v3 Req 47.7), and there is no second origin for it to point at.
 *
 * **Nothing here holds an identity.** The Auth_Session is an `HttpOnly` cookie, which this code
 * cannot read by design (v3 Req 30.4) — `useSession` asks the *server* who you are and caches the
 * answer. There is no token in LocalStorage and nothing to keep in a Zustand store: a signed-in
 * account is a server fact, and a second copy of it here would be a second thing to get wrong.
 *
 * **Local mode does not touch this** ([D6](../../../../docs/v3.0_backend/overview.md#d6--local-mode-stays-sign-in-gates-connected-play-only)).
 * A visitor who never signs in never calls it, and nothing about their experience degrades.
 *
 * **It lives here rather than in `client/services/`, which is where it started.** `createAuthClient`
 * from `better-auth/react` makes `useSession` a React hook, and `services/` sits *below*
 * `components/` in `types → engine → services → stores → components → routes` — no other module in
 * `services/` or `stores/` imports React, and this one should not be the first. Splitting it in two
 * was the alternative and is worse: two clients means two caches of the same server fact.
 *
 * **Validates: v3 Req 30.4, 30.8**
 */

import { createAuthClient } from 'better-auth/react';

export const authClient = createAuthClient({ basePath: '/api/auth' });
