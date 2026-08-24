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
 */
import { defineConfig } from 'vitest/config'
import tsconfigPaths from 'vite-tsconfig-paths'
import viteReact from '@vitejs/plugin-react'

const config = defineConfig({
  plugins: [tsconfigPaths({ projects: ['./tsconfig.json'] }), viteReact()],
  test: {
    globals: true,
    environment: 'happy-dom',
    setupFiles: ['./vitest.setup.ts'],
  },
})

export default config
