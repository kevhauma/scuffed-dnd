/**
 * The production runner — `yarn start` (TICKET-POL-03)
 *
 * One command starting one process, which serves the client bundle, the API and the live socket on
 * one port. Everything it does lives in `src/server/serve.ts` and arrives here inside
 * `dist/server/entry.js`, the single file the build emits: this script is the door, not the
 * doorway. Keeping the logic in TypeScript under `src/server/` is what lets dependency-cruiser see
 * it and `serve.test.ts` prove it.
 *
 * Run it with the environment already loaded:
 *
 *     node --env-file-if-exists=.env scripts/serve.mjs
 *
 * `--env-file-if-exists` does not fail when there is no `.env`, which is the normal case for an
 * operator supplying real environment variables through their supervisor instead — and variables
 * already set in the environment win over the file, so the same command works either way.
 */

import { reportRefusal } from './refusals.mjs';

/**
 * **A built artefact is production, and saying so here is a security decision.**
 *
 * `useSecureCookies` is `nodeEnv === 'production'` (`src/server/auth/authServer.ts`), so an
 * operator who forgets `NODE_ENV` would serve session cookies without `Secure` — a downgrade that
 * announces itself nowhere. The default belongs to the runner rather than to `env.ts`, whose
 * fallback to `development` is deliberately the *less privileged* reading for everything that is
 * not this: tests, `yarn dev` and any direct import of the entry all want it.
 *
 * An operator who really does want a non-production build of this artefact — a staging box with a
 * plain-HTTP proxy in front of it — sets `NODE_ENV` to something and is obeyed.
 *
 * **Empty counts as unset, and finding that out is why `.env.example` changed.** `--env-file` runs
 * before this line, so a `.env` copied from the example arrives with `NODE_ENV` already in
 * `process.env`; a `??=` would have been satisfied by the empty string and left the deployment in
 * development. The example now ships the key blank and `||=` treats blank as *nothing was said*.
 *
 * `||=` rather than an `if` on the value, for a second reason worth knowing: it is a **write and
 * nothing but a write**, and `env.test.ts`'s scan of this directory allows exactly that — a script
 * may arrange an environment, and may not consume one. An `if (!process.env.NODE_ENV)` reads it,
 * which the check cannot tell from a script quietly growing its own configuration.
 */
process.env.NODE_ENV ||= 'production';

// **After the line above, and that is the whole reason the bundle is reached with a *dynamic*
// import.** A static `import` is hoisted and evaluated before any statement in this file, so the
// entry — and `env.ts` inside it — would read the environment before the default was written.
try {
  const entry = await import('../dist/server/entry.js');
  await entry.start();
} catch (error) {
  // `env.ts` and `db/migrate.ts` both refuse with a sentence an operator can act on — every missing
  // variable named at once, or the migration that would not apply. `refusals.mjs` is what keeps
  // those readable, and is shared with `backup.mjs`, which meets the same three failures.
  reportRefusal(error);
  process.exit(1);
}
