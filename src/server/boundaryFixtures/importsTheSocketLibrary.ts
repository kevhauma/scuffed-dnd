/**
 * Violates `the-socket-library-has-one-importer` (TICKET-LIVE-01)
 *
 * A server module other than `ws/liveSocketServer.ts` importing `ws`. The rule exists because
 * `ws/rooms.ts` and `ws/subscription.ts` are written against `LiveConnection` — three plain methods
 * — which is what makes broadcast isolation, eviction and the room map emptying itself provable
 * against fake objects, with no handshake, no port and no timing.
 *
 * **The failure this guards against is silent, which is why it is a check.** A `WebSocket` imported
 * into `rooms.ts` for a single type annotation breaks nothing and fails no test: the room tests keep
 * passing against their fakes, and the claim those fakes stand for has quietly stopped being true.
 * Nothing about that shows up in a review of the diff that does it.
 *
 * A **type-only** import, deliberately — the weakest form of the violation, and the one most likely
 * to be waved through. `tsPreCompilationDeps` is on, so a type crossing is still a crossing.
 */

import type { WebSocket } from 'ws';

export type ASocketThisModuleShouldNotKnowAbout = WebSocket;
