/**
 * Violates `the-listener-has-one-creator` (TICKET-POL-03)
 *
 * A server module other than `serve.ts` importing `node:http` for its **value** — which is what
 * calling `createServer` requires. The ticket's central claim is that the deployment is *one*
 * process serving the bundle, the API and the socket from *one* listener, and until this rule
 * existed nothing checked the second half of that sentence.
 *
 * **The failure it guards against is the one this milestone actually had.** LIVE-01 attached the
 * socket to a listener a Vite plugin owned, and a built artefact quietly had no socket at all for
 * four tickets: nothing failed, no test went red, and the gap was found by reading. A second
 * `createServer` in production code is the same shape of mistake — a second port, or a second
 * process's worth of state, arriving as an import nobody reviews closely.
 *
 * **Type-only imports are deliberately legal**, which is why this fixture takes a value: three
 * modules (`http/nodeBridge.ts`, `http/staticFiles.ts`, `ws/liveSocketServer.ts`) name
 * `IncomingMessage`, `ServerResponse` and `Server` as *types* and must keep doing so — being handed
 * a listener is the opposite of creating one. `tsPreCompilationDeps` is on, so dependency-cruiser
 * can tell the two apart.
 */

import { createServer } from 'node:http';

export const aListenerThisModuleShouldNotCreate = createServer;
