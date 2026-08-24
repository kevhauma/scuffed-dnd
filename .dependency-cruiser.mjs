/**
 * Architecture rules, as checks (TICKET-DX-07)
 *
 * `src/` has exactly three roots — `shared/` (the Kernel), `client/` and `server/` — and the rule
 * between them is symmetric and mechanical: **`client/` and `server/` may each import `shared/`
 * and nothing of each other; `shared/` imports neither.** See
 * [D14](./docs/v3.0_backend/overview.md#d14--three-roots-client-server-shared).
 *
 * A boundary that is only a naming convention is one a tired afternoon erases, so this file is
 * what makes it a check. It runs in `yarn run check`, which the pre-commit hook runs, so a
 * violation cannot be committed. Every rule below is proven by a module that breaks it — see
 * [`architecture/`](./architecture/README.md).
 *
 * The wider architecture rules — store-owned persistence, repository-owned queries, UI primitives
 * as leaves — are TICKET-DX-08. This file lands the root boundary only, so that a failure here is
 * unambiguously about the roots.
 */

/**
 * The modules that prove the rules below, exempted as **violators** only
 *
 * Deliberately `from.pathNot` on every rule rather than `options.exclude`: excluding them would
 * take them out of the graph entirely, which also stops an import *pointing at* one from being
 * reported — so a real client module reaching `#server/boundaryFixtures/target` would pass. They
 * must stay visible as destinations and disappear only as sources.
 * `architecture/boundaries.test.ts` lifts this to cruise them.
 */
const FIXTURES = '^src/(client|server|shared)/boundaryFixtures/';

/** @type {import('dependency-cruiser').IConfiguration} */
export default {
  forbidden: [
    {
      name: 'no-client-to-server',
      severity: 'error',
      comment:
        'The frontend reached into the backend. Whatever it needs is either a rule (put it in ' +
        'shared/, where both sides call the one copy) or a request (call the API). A client ' +
        'module that can see server/ is a client module that can bundle a secret.',
      from: { path: '^src/client/', pathNot: FIXTURES },
      to: { path: '^src/server/' },
    },
    {
      name: 'no-server-to-client',
      severity: 'error',
      comment:
        'The backend reached into the frontend. The server has no DOM, no LocalStorage and no ' +
        'React; anything it genuinely needs from there is pure, and pure code belongs in shared/.',
      from: { path: '^src/server/', pathNot: FIXTURES },
      to: { path: '^src/client/' },
    },
    {
      name: 'no-shared-to-siblings',
      severity: 'error',
      comment:
        'The Kernel imported one of its callers. shared/ is written once and called by both ' +
        'sides; the moment it depends on either, it is no longer shared and the rule it holds ' +
        'has quietly acquired an environment (D5).',
      from: { path: '^src/shared/', pathNot: FIXTURES },
      to: { path: '^src/(client|server)/' },
    },
    {
      name: 'server-reaches-only-shared',
      severity: 'error',
      comment:
        'A server module imported something under src/ that is neither server/ nor shared/. ' +
        'Stated separately from no-server-to-client so that a fourth root, added later without ' +
        'thinking, is refused rather than silently allowed.',
      from: { path: '^src/server/', pathNot: FIXTURES },
      to: { path: '^src/', pathNot: '^src/(server|shared)/' },
    },
    {
      name: 'client-reaches-only-shared',
      severity: 'error',
      comment:
        'A client module imported something under src/ that is neither client/ nor shared/. The ' +
        'mirror of server-reaches-only-shared, for the same reason and stated the same way — D14 ' +
        'says the rule is symmetric, and a guard that holds in one direction only is not.',
      from: { path: '^src/client/', pathNot: FIXTURES },
      to: { path: '^src/', pathNot: '^src/(client|shared)/' },
    },
    {
      name: 'cross-root-imports-use-an-alias',
      severity: 'error',
      comment:
        "A crossing into shared/ was spelled with '../'. Cross-root imports use #shared/… so the " +
        'boundary is legible at the import line rather than only in this file, and checkable by ' +
        'prefix rather than by counting traversals (D14). Relative imports stay the rule within ' +
        'a root.',
      from: { path: '^src/(client|server)/', pathNot: FIXTURES },
      to: {
        path: '^src/shared/',
        dependencyTypesNot: [
          'aliased',
          'aliased-subpath-import',
          'aliased-tsconfig',
          'aliased-tsconfig-base-url',
          'aliased-tsconfig-paths',
        ],
      },
    },
  ],
  options: {
    doNotFollow: { path: 'node_modules' },
    /** `import type` is still an import for this purpose — a type crossing the boundary is a crossing. */
    tsPreCompilationDeps: true,
    tsConfig: { fileName: 'tsconfig.json' },
    enhancedResolveOptions: {
      exportsFields: ['exports'],
      conditionNames: ['import', 'require', 'node', 'default', 'types'],
      mainFields: ['module', 'main', 'types'],
      extensions: ['.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs'],
    },
    reporterOptions: {
      text: { highlightFocused: true },
    },
  },
};
