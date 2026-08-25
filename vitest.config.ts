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
    projects: [
      {
        ...shared,
        test: {
          ...shared.test,
          name: 'server',
          environment: 'node',
          include: ['src/server/**/*.test.ts'],
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
