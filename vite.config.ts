import tailwindcss from '@tailwindcss/vite';
import { devtools } from '@tanstack/devtools-vite';
import { tanstackStart } from '@tanstack/react-start/plugin/vite';
import viteReact from '@vitejs/plugin-react';
import { loadEnv } from 'vite';
import tsconfigPaths from 'vite-tsconfig-paths';
import { defineConfig } from 'vitest/config';
import { liveSocket } from './scripts/live-socket.mjs';
import { noServerInClientBundle } from './scripts/no-server-in-client-bundle.mjs';

const config = defineConfig(({ mode }) => {
  // `.env` reaches the **server** through `process.env`, not through `import.meta.env`
  // (TICKET-SRV-01). Vite only exposes `VITE_`-prefixed variables to the client, and deliberately
  // never writes to `process.env` — so without this, `src/server/env.ts` would read a `.env` file
  // nobody had loaded. The empty prefix loads every key, which is safe *because* the destination is
  // this Node process rather than the bundle: an unprefixed variable still cannot reach the client.
  // In production the operator's runner supplies them instead — see the README (POL-03).
  Object.assign(process.env, loadEnv(mode, process.cwd(), ''));

  return {
    plugins: [
      devtools(),
      tsconfigPaths({ projects: ['./tsconfig.json'] }),
      tailwindcss(),
      // `srcDirectory` is the client root, not `src/` (TICKET-DX-07, D14): the router's entry,
      // its routes directory and the generated route tree are all frontend, and pointing the
      // plugin at `src/client` is what keeps `src/server` out of its reach by construction.
      // Colocated route tests live in src/client/routes/ but are not routes.
      //
      // `server.entry` is resolved **relative to `srcDirectory`**, which is why it reads
      // `../server/entry` rather than `src/server/entry` — the two options are coupled.
      // `src/server/entry.ts` dispatches `/api/*` to this repository's own router before falling
      // through to Start's SSR handler (TICKET-SRV-01), which is what keeps API route files out of
      // the client's routes directory — and therefore out of D14's way — without granting the
      // boundary an exception.
      tanstackStart({
        srcDirectory: 'src/client',
        server: { entry: '../server/entry' },
        router: { routeFileIgnorePattern: '\\.test\\.tsx?$' },
      }),
      viteReact(),
      // Asserted against the emitted module list, not against the source tree — see the module's
      // own note for why both checks exist (TICKET-DX-07, v3 Req 50.5).
      noServerInClientBundle(),
      // Development only. Vite owns the HTTP listener here and `src/server/entry.ts` never sees
      // it, so the socket is attached from a plugin rather than from the entry (TICKET-LIVE-01).
      // The production attachment belongs to TICKET-POL-03, which owns the start command.
      liveSocket(),
    ],
    test: {
      globals: true,
      environment: 'happy-dom',
      setupFiles: ['./vitest.setup.ts'],
    },
  };
});

export default config;
