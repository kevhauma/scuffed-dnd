/**
 * Architecture rules, as checks (TICKET-DX-07, TICKET-DX-08)
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
 * ## Which prose rule each check replaces
 *
 * DX-07 landed the root boundary; DX-08 encoded the rest of the rules
 * [CLAUDE.md](./CLAUDE.md) has stated as prose since v1.0.
 *
 * | Rule | The prose it replaces |
 * |---|---|
 * | `no-client-to-server`, `no-server-to-client`, `no-shared-to-siblings` | "`src/` has exactly three roots, and the boundary between them is checked" (D14) |
 * | `server-reaches-only-shared`, `client-reaches-only-shared` | the same rule, stated so a *fourth* root is refused rather than allowed |
 * | `cross-root-imports-use-an-alias` | "Imports are relative within a root and aliased across one" |
 * | `kernel-is-framework-free` | "`shared/` is the Kernel — pure, no React, no storage, no network" (D5) |
 * | `types-are-the-bottom-layer` | the **bottom rung** of "`types → engine → services → stores → components → routes`". The rungs above it *inside* `shared/` are not checked — nothing stops `engine/` importing `shared/services/`; the rungs that cross a root are covered by the boundary rules instead |
 * | `persistence-belongs-to-the-store` | "Persistence belongs to the store action" |
 * | `queries-belong-to-repositories` | "Queries belong to `src/server/repositories/`" |
 * | `test-harness-stays-in-tests` | nothing — added by DX-06, and it is what pays for `testing/` being allowed through the rule above |
 * | `ui-primitives-are-leaves` | "Base components (`components/ui/`) carry intrinsic styling only" — the import half of it |
 * | `the-socket-library-has-one-importer` | "`ws/rooms.ts` imports `ws` not at all" (TICKET-LIVE-01) — the claim that makes the room model testable against plain objects, which lived only in prose until it was a check |
 * | `no-circular` | fallow's circular-dependency report, promoted from a review signal to a gate |
 * | `no-dev-dep-in-production` | nothing; a production-install bug this repo had no guard against |
 * | `no-undeclared-dependency` | "No new runtime dependencies without asking" (D11) |
 * | `no-orphans` | nothing — a **warning**, because an entry point looks orphaned from inside `src/` |
 *
 * ## What this file cannot express
 *
 * dependency-cruiser sees imports. It cannot see a call. The obligations that are about call sites
 * rather than edges stay purpose-written tests, and
 * [`architecture/README.md`](./architecture/README.md) lists them with what covers each — the
 * load-bearing one being AUTH-03's *every route naming an owned resource calls a guard*
 * (v3 Req 51.10), which a handler importing `requireAccount` and never calling it satisfies
 * perfectly.
 */

/**
 * The modules that prove the rules below, exempted as **violators** only
 *
 * Deliberately `from.pathNot` on every rule rather than `options.exclude`: excluding them would
 * take them out of the graph entirely, which also stops an import *pointing at* one from being
 * reported — so a real client module reaching `#server/boundaryFixtures/target` would pass. They
 * must stay visible as destinations and disappear only as sources.
 * `architecture/boundaries.test.ts` lifts this to cruise them.
 *
 * Matched anywhere under `src/` rather than only at a root, because DX-08's rules are scoped to
 * directories *inside* a root — a fixture for `types-are-the-bottom-layer` has to live under
 * `shared/types/` to be a source at all.
 */
export const FIXTURES = '/boundaryFixtures/';

/**
 * Test files, which are cruised but not shipped
 *
 * They stay in the graph because a test reaching across the root boundary is still a crossing, and
 * `src/server/sharedKernel.test.ts` is the proof that the Kernel is reusable from the server. What
 * they are exempt from is the two rules that are about *shipping*: `no-dev-dep-in-production`
 * (vitest and fast-check are devDependencies, correctly) and `persistence-belongs-to-the-store`
 * (a test mocking the storage service is doing the rule's work).
 *
 * `*.fixtures.ts` counts as a test file — `shared/services/importExport.fixtures.ts` exists only
 * to be imported by a suite, and the day one reaches for `fast-check` it should not be told it has
 * broken a production install.
 */
const TESTS = '\\.(test|fixtures)\\.[cm]?[jt]sx?$';

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
    {
      name: 'kernel-is-framework-free',
      severity: 'error',
      comment:
        'The Kernel imported a framework. shared/ holds the one copy of every rule, called by ' +
        'React on one side and by a request handler on the other (D5). The moment it imports ' +
        'React, Zustand, a form library or the router it has acquired an environment, and a rule ' +
        'with an environment can only be run by one of its two callers — which is the whole ' +
        'reason the server would end up restating it.',
      from: { path: '^src/shared/', pathNot: FIXTURES },
      to: { path: 'node_modules/(react|react-dom|react-hook-form|zustand|@tanstack)(/|$)' },
    },
    {
      name: 'types-are-the-bottom-layer',
      severity: 'error',
      comment:
        'A declaration imported something with a runtime. shared/types/ is the bottom of the ' +
        'layering — types → engine → services → stores → components → routes — and imports only ' +
        'ever point up that list. It describes shapes and executes nothing, so every arrow points ' +
        'at it and none points out of it.',
      from: { path: '^src/shared/types/', pathNot: FIXTURES },
      to: { pathNot: '^src/shared/types/' },
    },
    {
      name: 'persistence-belongs-to-the-store',
      severity: 'error',
      comment:
        'A component or a route imported the LocalStorage service. Persistence belongs to the ' +
        'Zustand action: it patches state and persists in the same call, so there is exactly one ' +
        'place a save can be forgotten. A component that saves is a component that can save half ' +
        'of something and leave the store holding the other half.',
      // Stated as "everything in client/ except the two layers that own persistence" rather than
      // as "components and routes", for the reason server-reaches-only-shared gives above: a
      // `client/hooks/` or `client/features/` added later without thinking should be refused
      // rather than silently allowed. Closed by default; the openings are named.
      from: {
        path: '^src/client/',
        pathNot: [
          FIXTURES,
          // The two layers whose job this is: the store patches state and persists in one action,
          // and `services/configFiles.ts` reads the stored bytes to assemble a backup file.
          '^src/client/(stores|services)/',
          // Nothing ships a test, and a test that mocks the storage service or asserts what was
          // written to it is doing the rule's work rather than breaking it.
          TESTS,
          // `useAppHydration` imports `isStorageAvailable` (a browser-capability probe, run before
          // anything is read) and `StorageSchemaError` (an `instanceof` discriminant). It performs
          // no load and no save — each of those is a store action it calls. Exempted by name
          // rather than by widening the rule, so a second module needing the same thing is a
          // decision rather than a silence.
          '^src/client/components/shared/useAppHydration\\.ts$',
        ],
      },
      to: { path: '^src/client/services/storage' },
    },
    {
      name: 'queries-belong-to-repositories',
      severity: 'error',
      comment:
        'A server module outside db/, repositories/ and testing/ reached the database. A handler ' +
        'calls a repository; the connection and the query builder stay behind that door. This is ' +
        'the server-side mirror of persistence-belongs-to-the-store and it is what keeps a schema ' +
        'change to one directory (DB-01). testing/ is in the list because a harness that seeds ' +
        'rows is doing repository work by definition (DX-06) — and it is only safe to widen the ' +
        'door because test-harness-stays-in-tests below locks it from the other side.',
      from: {
        path: '^src/server/',
        pathNot: [FIXTURES, '^src/server/(db|repositories|testing)/'],
      },
      to: { path: 'node_modules/(drizzle-orm|better-sqlite3)(/|$)|^src/server/db/client' },
    },
    {
      name: 'ui-primitives-are-leaves',
      severity: 'error',
      comment:
        'A base component imported a store, a service or a feature component. components/ui/ is ' +
        'the leaf layer: a primitive renders what it is handed and knows nothing about where the ' +
        'value came from, which is the only reason every feature can reuse it. One that reads a ' +
        'store is a feature component wearing the wrong folder. What a primitive may still reach ' +
        'is the pure Kernel — FormulaEditor calls the formula validator, and that is correct.',
      from: { path: '^src/client/components/ui/', pathNot: FIXTURES },
      // "Anything in client/ that is not another primitive", plus the shared *services* — which are
      // pure but are import/export and persistence-shaped, and nothing a primitive should hold.
      // An allow-list rather than a list of today's feature folders, so `components/campaign/`
      // added next year is refused rather than forgotten.
      to: {
        path: '^src/client/|^src/shared/services/',
        pathNot: '^src/client/components/ui/',
      },
    },
    {
      name: 'test-harness-stays-in-tests',
      severity: 'error',
      comment:
        'Production code imported the test harness. server/testing/ opens databases, seeds rows ' +
        'and — through callRoute — hands a handler an account nobody authenticated. It is allowed ' +
        'to reach the connection directly (see queries-belong-to-repositories) precisely because ' +
        'nothing that answers a real request can reach *it*. A shipped module importing this is ' +
        'the one way that trade stops being sound (DX-06).',
      from: { path: '^src/server/', pathNot: [FIXTURES, TESTS, '^src/server/testing/'] },
      to: { path: '^src/server/testing/' },
    },
    {
      name: 'the-server-sends-no-mail',
      severity: 'error',
      comment:
        'A server module imported a mail client or a raw socket. This application sends nothing ' +
        '— no SMTP configuration, no provider account, no mail port (D12) — and "invite by email" ' +
        'is delivered on-platform instead: the Account holding the address sees the invitation in ' +
        'the app. That decision is worth a check rather than a paragraph, because the way it gets ' +
        'reversed is not a discussion but a dependency added under something else. If outbound ' +
        'mail is ever wanted it arrives as its own ticket with a port and one provider, and this ' +
        'rule is what that ticket has to delete on the way past.',
      from: { path: '^src/server/', pathNot: FIXTURES },
      // `net`, `tls` and `dgram` are what an SMTP client is built out of. `http`/`https` are
      // deliberately **not** here: LIVE-01 attaches the WebSocket server to this process's own
      // HTTP listener, and a rule that forbade that would be forbidding the milestone.
      to: {
        path:
          '^(node:)?(net|tls|dgram)$|' +
          'node_modules/(nodemailer|@sendgrid|mailgun[^/]*|postmark|resend|emailjs[^/]*)(/|$)',
      },
    },
    {
      name: 'the-socket-library-has-one-importer',
      severity: 'error',
      comment:
        'A module other than server/ws/liveSocketServer.ts imported `ws`. That module is the ' +
        'adapter between the socket library and everything else, and the rest of ws/ is written ' +
        'against three-method plain objects (`LiveConnection`) precisely so that rooms, ' +
        'admission and eviction are provable without a handshake, a port or a timing assumption ' +
        '(TICKET-LIVE-01). The day `rooms.ts` imports `WebSocket` — even for a type — every ' +
        'property `rooms.test.ts` proves against fakes quietly stops being a property of the ' +
        'design, and nothing fails. This is that check. **The exemption is one file, not TESTS**: ' +
        'liveSocketServer.test.ts drives a real `ws` *client* over loopback and has to, but a ' +
        'blanket test exemption would let rooms.test.ts import the library — and that file is the ' +
        'one whose fakes the rule exists to keep meaningful, so exempting it would aim the check ' +
        'away from its own target.',
      from: {
        path: '^src/',
        pathNot: [
          FIXTURES,
          '^src/server/ws/liveSocketServer\\.ts$',
          '^src/server/ws/liveSocketServer\\.test\\.ts$',
        ],
      },
      to: { path: 'node_modules/ws(/|$)' },
    },
    {
      name: 'no-circular',
      severity: 'error',
      comment:
        'A dependency cycle. fallow has reported these as a review signal since v2.1; here it ' +
        'fails the build, because a cycle is what makes "which module owns this?" unanswerable — ' +
        'and every layering rule above is unprovable while one exists.',
      from: { pathNot: FIXTURES },
      to: {
        circular: true,
        // `routeTree.gen.ts` carries `import type { getRouter } from './router.tsx'` inside its
        // `declare module` block, and `router.tsx` imports the tree — a cycle that is generated,
        // type-only, and erased before anything runs. It is visible here only because
        // `tsPreCompilationDeps` is on, which the root boundary needs and which is worth more than
        // this one edge. The file may not be hand-edited (CLAUDE.md), so the edge is exempted by
        // name rather than pretended away.
        //
        // **Both members are named, and that is not belt-and-braces.** A cycle is reported once,
        // from whichever member the traversal reached first — but silencing that one edge does not
        // silence the cycle, it re-surfaces from the other member. Verified: exempting only
        // `routeTree.gen.ts` here moved the finding to `router.tsx → routeTree.gen.ts`. Naming the
        // pair silences exactly this two-module cycle; a future cycle merely *passing through* the
        // router is still reported from its own non-exempt edge.
        pathNot: '^src/client/(routeTree\\.gen\\.ts|router\\.tsx)$',
      },
    },
    {
      name: 'no-dev-dep-in-production',
      severity: 'error',
      comment:
        'A shipped module imported a devDependency. It works on this machine and fails in a ' +
        'production install, where devDependencies are simply not there — the worst possible ' +
        'place to find out. Test files are exempt because nothing ships them.',
      from: { path: '^src/', pathNot: [FIXTURES, TESTS] },
      to: { dependencyTypes: ['npm-dev'] },
    },
    {
      name: 'no-undeclared-dependency',
      severity: 'error',
      comment:
        'An import of a package that is not in package.json. It resolves today only because ' +
        'something else happens to depend on it; the day that something bumps a major this ' +
        'breaks for a reason nothing in this repo records. D11 lists what this milestone adds — ' +
        'a package outside that list is a decision, not an import.',
      from: { pathNot: FIXTURES },
      to: { dependencyTypes: ['npm-no-pkg', 'npm-unknown'] },
    },
    {
      name: 'no-orphans',
      severity: 'warn',
      comment:
        'A module with no edges in either direction — it imports nothing and nothing imports it. ' +
        'Note the narrowness, because the obvious reading of the name is wrong: dependency-cruiser ' +
        "returns false the moment a module has one dependency, so a dead file that imports *anything* " +
        'is not an orphan. This catches a self-contained leftover and nothing else. It is a warning ' +
        'both because that is a small class and because `fallow dead-code` is what actually judges ' +
        'reachability; this is the cheap first look, not the answer.',
      // Only the fixtures need exempting, and only because `orphan.ts` is a real zero-edge module.
      // Nothing else in `src/` can reach this rule: the server entry, the generated route tree and
      // every test file all have imports of their own, so none of them is ever an orphan and none
      // needs an exemption. An earlier draft listed all three and each line guarded nothing — which
      // is the "reads as coverage" failure this ticket's Notes warn about, in the ticket's own config.
      from: { orphan: true, pathNot: FIXTURES },
      to: {},
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
