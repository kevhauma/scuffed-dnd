/**
 * Build-time guard: no `src/server/` module may reach the client bundle (TICKET-DX-07)
 *
 * `.dependency-cruiser.mjs` already forbids `client/` → `server/` at the import line, and that is
 * the check a developer sees first. This is the second one, and it exists because the two are
 * proving different things: dependency-cruiser reads the source tree, while this reads the
 * **module list Rollup actually emitted**. If a server module ever arrives in the browser by a
 * route the source-level rule cannot see — a barrel, a plugin-injected import, a resolver alias —
 * the failure is a leaked secret rather than an untidy diagram (v3 Req 50.5), so it is worth
 * asserting against the artefact rather than against the intent.
 *
 * Fails the build. There is no report-only mode, deliberately: a warning about this is a warning
 * nobody reads until it matters.
 */

import { resolve } from 'node:path';

/**
 * The environments that are *allowed* to contain server code — an SSR build is meant to
 *
 * Stated as an allow-list of exemptions rather than as `name === 'client'` on purpose. If Vite or
 * TanStack Start ever renames its browser environment, this fails loudly on a build that is
 * actually fine; the other spelling would skip the check silently and read as a pass, which is
 * the failure mode a guard against a leaked secret must not have.
 */
const UNGUARDED_ENVIRONMENTS = new Set(['ssr', 'server']);

/** This project's own `src/server/`, so a dependency shipping one of its own is not mistaken for it */
const SERVER_ROOT = `${resolve(process.cwd(), 'src', 'server').replaceAll('\\', '/')}/`;

/**
 * Every module id in an emitted bundle, on forward slashes
 *
 * @param {import('vite').Rollup.OutputBundle} bundle
 * @returns {string[]}
 */
function bundledModuleIds(bundle) {
  return Object.values(bundle)
    .filter((output) => output.type === 'chunk')
    .flatMap((chunk) => Object.keys(chunk.modules))
    .map((id) => id.replaceAll('\\', '/'));
}

/** @returns {import('vite').Plugin} */
export function noServerInClientBundle() {
  return {
    name: 'dnd:no-server-in-client-bundle',
    enforce: 'post',
    generateBundle(_options, bundle) {
      if (this.environment && UNGUARDED_ENVIRONMENTS.has(this.environment.name)) return;

      const leaked = [
        ...new Set(bundledModuleIds(bundle).filter((id) => id.startsWith(SERVER_ROOT))),
      ];

      if (leaked.length > 0) {
        this.error(
          `${leaked.length} module(s) from src/server/ reached the client bundle:\n  ` +
            `${leaked.join('\n  ')}\n` +
            'The frontend may import #shared/ and call the API; it may never import #server/.'
        );
      }
    },
  };
}
