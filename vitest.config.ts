/**
 * Vitest configuration.
 *
 * Deliberately separate from `vite.config.ts`: the test pipeline must NOT include
 * `tanstackStart()`. That plugin wires up TanStack Start's client/ssr Vite environments for
 * SSR dev and build, and under Vitest that wiring causes `react` to be instantiated twice —
 * the copy the component tree imports is not the copy `react-dom` binds its hooks dispatcher
 * to, so `ReactSharedInternals.H` is null on render and every `useState`/`useEffect` throws
 * "Cannot read properties of null (reading 'useState')".
 *
 * Verified: with an otherwise identical plugin list, removing only `tanstackStart()` makes
 * hook-using components render. `resolve.dedupe`, inlining `@testing-library/react`, forcing
 * react/react-dom external, and `customViteReactPlugin: true` all fail to fix it — so this is
 * the environment wiring, not plugin order or dependency externalization.
 *
 * Routing still works in tests because `src/client/routeTree.gen.ts` is committed; nothing in the
 * suite needs the route generator to run.
 *
 * `vite.config.ts` keeps `tanstackStart()` and remains the config for `yarn dev` / `yarn build`.
 *
 * ## Two environments, split on the root boundary (TICKET-AUTH-01)
 *
 * `src/server/` runs in **node** and everything else in **happy-dom**, which mirrors D14's three
 * roots: the server has no DOM, and giving it one is not merely unnecessary, it is *wrong in a way
 * that passes*. happy-dom's `Headers` **silently discards `Set-Cookie`** — `get`, `getSetCookie`
 * and `entries` all come back empty rather than throwing — so every assertion about an
 * Auth_Session cookie was quietly checking an empty string and agreeing with itself. That is the
 * exact failure mode this project's test discipline exists against, so the split is a rule rather
 * than a workaround: `src/server/environment.test.ts` fails if a server test file ever runs
 * somewhere with a `window` in it.
 *
 * ## The server project gets a longer timeout (TICKET-GAM-03)
 *
 * Vitest's default is **5 seconds**, and `auth/auth.test.ts` drives the real Better Auth handler:
 * one sign-up and seven sign-ins in a single case, each of which runs a **scrypt** password hash.
 * That hash is slow *on purpose* — it is the whole security property — so the case's floor is a
 * second or two on an idle machine and several times that on a busy one. It began timing out
 * intermittently as the suite grew past 2,600 tests, which is a machine-speed failure wearing a
 * test's clothes: nothing about it is an assertion that stopped holding.
 *
 * **This is not weakening a check.** Every assertion still has to pass and none was relaxed; what
 * changed is how long a deliberately expensive operation is allowed to take. Scoped to the server
 * project because that is where the hashing, the migrations and the 306 KB corpus live — the app
 * project stays at the default, where five seconds is a generous budget for rendering a component.
 *
 * ## Everything runs; two directories are held to 100%
 *
 * The suite is unchanged — every `.test.ts` and `.test.tsx` runs. What is scoped is the
 * *threshold*: `coverage.include` names exactly the two directories that have earned a target,
 * `shared/engine/` (the rules themselves) and `client/components/ui/` (whose rendered markup is a
 * unit). Every other directory is **absent** from that list rather than set to a low number,
 * because a threshold of 0 reads as a target met rather than a question still open. Deciding one
 * means adding its glob.
 *
 * A consequence worth knowing when reading the report: the feature-component tests run too, and
 * what they render counts. A base component can therefore sit at 100% on the strength of the
 * panels that use it rather than its own test file — the number answers *is this code exercised*,
 * not *is this code tested directly*.
 */
import viteReact from '@vitejs/plugin-react'
import tsconfigPaths from 'vite-tsconfig-paths'
import { defineConfig } from 'vitest/config'

const shared = {
  plugins: [tsconfigPaths({ projects: ['./tsconfig.json'] }), viteReact()],
  test: {
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
  },
}

const config = defineConfig({
  test: {
    // Off unless asked for: `yarn run coverage` passes --coverage. `include` widens the report
    // past the files a test happened to load, so an untested module reads as 0% rather than
    // disappearing — which is the question coverage is being asked here.
    //
    // Scoped to the two roots that are held to 100%: the engine (the rules themselves) and the
    // base components (whose rendered markup is a unit). Every other directory is deliberately
    // absent rather than set to a low number — its threshold is undecided, and a threshold of 0
    // reads as a target rather than an open question. Widen `include` when one is decided.
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/shared/engine/**/*.{ts,tsx}', 'src/client/components/ui/**/*.{ts,tsx}'],
      // `boundaryFixtures/` modules exist to be *parsed* by dependency-cruiser — each one is a
      // deliberate import violation that `architecture/boundaries.test.ts` proves is caught.
      // Nothing ever executes one, so they are permanently 0% and would price the target as
      // unreachable rather than merely unmet.
      exclude: ['src/**/*.test.{ts,tsx}', 'src/**/boundaryFixtures/**'],
      thresholds: {
        lines: 100,
        functions: 100,
        branches: 100,
        statements: 100,
      },
    },
    projects: [
      {
        ...shared,
        test: {
          ...shared.test,
          name: 'server',
          environment: 'node',
          include: ['src/server/**/*.test.ts'],
          // See the header: scrypt is slow by design, and 5s is a machine-speed cliff rather than
          // a budget any of these cases should be held to
          testTimeout: 30_000,
        },
      },
      {
        ...shared,
        test: {
          ...shared.test,
          name: 'app',
          environment: 'happy-dom',
          include: ['src/**/*.test.{ts,tsx}', 'architecture/**/*.test.ts'],
          exclude: ['src/server/**'],
        },
      },
    ],
  },
})

export default config
