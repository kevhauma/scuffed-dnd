/**
 * Violates `the-server-sends-no-mail` (TICKET-GAM-03)
 *
 * A server module holding a raw socket — the thing an SMTP client is built out of. D12 says this
 * application sends nothing, and *nothing* is a claim about the whole of `src/server/` rather than
 * about the invitation routes: the way it gets reversed is not a discussion but a dependency added
 * under something else, which is exactly what a dependency check sees and a review does not.
 *
 * `node:net` rather than `nodemailer` because a fixture must not add a package to `package.json` to
 * prove a rule about packages, and because the socket is the more general violation of the two.
 */

import { createConnection } from 'node:net';

export const anOutboundSocket = { createConnection };
