/**
 * Where the live socket is, worked out rather than configured (TICKET-LIVE-01)
 *
 * **Derived from `window.location`, always** (v3 Req 47.6). There is no `VITE_SOCKET_URL`, no base
 * to override and no constant naming a host, for the reason `services/api.ts` gives about the API:
 * the backend is *this* server — one process serving the client bundle, the API and the socket
 * ([D1](../../../docs/v3.0_backend/overview.md#d1--the-backend-lives-in-this-repo-on-tanstack-start))
 * — and a configurable address is an address somebody eventually points elsewhere. Same host, same
 * port, so the Auth_Session cookie rides the upgrade with nothing added.
 *
 * **The scheme follows the page's**, which is a security property rather than a convenience: a page
 * served over `https:` opening a `ws:` socket is a downgrade the browser would refuse as mixed
 * content, and hard-coding either one is how a deployment behind TLS breaks in a way no test on
 * `http://localhost` would ever show.
 *
 * **This is the whole client half of LIVE-01.** The connection object that uses this address —
 * connect, subscribe, receive — arrives with TICKET-LIVE-02, in the change that consumes it: no
 * criterion here asks for one, and the server's own tests drive real sockets over loopback, so
 * building it now would be an abstraction landing a ticket ahead of its caller.
 *
 * **Validates: v3 Req 47.6, 44.1**
 */

import { LIVE_SOCKET_PATH } from '#shared/types/liveSocket';

/**
 * As much of `window.location` as an address needs
 *
 * Structural rather than `Location`, so this is callable with a literal — which is what lets the
 * `https:` case be asserted at all. A test cannot serve itself over TLS, and a builder that could
 * only be driven by a real browser would leave exactly the branch that breaks in production
 * unproven.
 */
export interface PageLocation {
  /** `http:` or `https:`, with the colon, as `window.location.protocol` carries it */
  protocol: string;
  /** Host **and port** — `window.location.host`, not `hostname` */
  host: string;
}

/** The page's scheme, and the socket scheme that matches it */
const SOCKET_SCHEME = {
  PLAIN: 'ws:',
  SECURE: 'wss:',
} as const;

/** What a secure page is served over */
const SECURE_PAGE_PROTOCOL = 'https:';

/**
 * The URL of this deployment's live socket
 *
 * @param location Where the page is — `window.location` in the app, a literal in a test
 * @returns An absolute `ws:`/`wss:` URL on the very origin that served the page
 */
export function liveSocketUrl(location: PageLocation): string {
  const scheme =
    location.protocol === SECURE_PAGE_PROTOCOL ? SOCKET_SCHEME.SECURE : SOCKET_SCHEME.PLAIN;

  return `${scheme}//${location.host}${LIVE_SOCKET_PATH}`;
}
