/**
 * Attach the live socket to the dev server's own listener (TICKET-LIVE-01)
 *
 * `yarn dev` is one process serving the app, the API and — from this plugin — the socket
 * (D1). Vite owns the HTTP listener in development, and nothing in `src/server/entry.ts` can reach
 * it: an entry is handed a `Request` and never sees the server that produced it. So the attachment
 * happens here, where the listener is in scope.
 *
 * **Only the attachment lives here.** The plugin loads `src/server/ws/` and calls
 * `attachLiveSocket` — every rule about who may connect and who may join which room is in that
 * module tree, tested there, and is not something a build tool gets an opinion on.
 *
 * **The listener ignores every path but the socket's**, which is what lets it sit beside Vite's own
 * HMR upgrade handler on the same server without either claiming the other's connections.
 *
 * **Production is TICKET-POL-03's**, which owns the start command: the one line it needs is
 * `attachLiveSocket(httpServer)` against whatever listener it creates.
 */

/** The module holding the attachment, loaded through Vite so its TypeScript and aliases resolve */
const WS_ENTRY = '/src/server/ws/liveSocketServer.ts';

/** @returns {import('vite').Plugin} */
export function liveSocket() {
  return {
    name: 'dnd:live-socket',
    apply: 'serve',
    configureServer(server) {
      // Deferred until the server is actually listening: `httpServer` is null in middleware mode,
      // and attaching to a server that never listens would be a silent no-op rather than an error
      server.httpServer?.once('listening', () => {
        void (async () => {
          try {
            const module = await server.ssrLoadModule(WS_ENTRY);
            module.attachLiveSocket(server.httpServer);
            server.config.logger.info('  ➜  Live socket attached at /api/live');
          } catch (error) {
            // Logged rather than thrown: a socket that failed to attach must not stop the app from
            // being served — signed out, and for every ticket before LIVE-02, nothing needs it
            server.config.logger.error(`[live] could not attach the live socket: ${error}`);
          }
        })();
      });
    },
  };
}
