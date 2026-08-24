import tailwindcss from '@tailwindcss/vite';
import { devtools } from '@tanstack/devtools-vite';
import { tanstackStart } from '@tanstack/react-start/plugin/vite';
import viteReact from '@vitejs/plugin-react';
import tsconfigPaths from 'vite-tsconfig-paths';
import { defineConfig } from 'vitest/config';
import { noServerInClientBundle } from './scripts/no-server-in-client-bundle.mjs';

const config = defineConfig({
  plugins: [
    devtools(),
    tsconfigPaths({ projects: ['./tsconfig.json'] }),
    tailwindcss(),
    // `srcDirectory` is the client root, not `src/` (TICKET-DX-07, D14): the router's entry,
    // its routes directory and the generated route tree are all frontend, and pointing the
    // plugin at `src/client` is what keeps `src/server` out of its reach by construction.
    // Colocated route tests live in src/client/routes/ but are not routes.
    tanstackStart({
      srcDirectory: 'src/client',
      router: { routeFileIgnorePattern: '\\.test\\.tsx?$' },
    }),
    viteReact(),
    // Asserted against the emitted module list, not against the source tree — see the module's
    // own note for why both checks exist (TICKET-DX-07, v3 Req 50.5).
    noServerInClientBundle(),
  ],
  test: {
    globals: true,
    environment: 'happy-dom',
    setupFiles: ['./vitest.setup.ts'],
  },
});

export default config;
