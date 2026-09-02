/**
 * Node ↔ Web bridge tests (TICKET-POL-03)
 *
 * **Driven through a real `node:http` listener rather than through fakes.** The bridge exists to
 * translate objects this repository does not construct — an `IncomingMessage` Node built from
 * bytes on a socket, a `ServerResponse` writing back to one — and a hand-made stand-in for either
 * would be a test of the stand-in. Each case starts a server on an ephemeral port, sends it a real
 * request with `fetch`, and reads a real response.
 *
 * The `Set-Cookie` case is the one this file exists for. Every other header survives a lazy
 * implementation; that one is silently mangled by it, and what it costs is every sign-in.
 *
 * **Validates: v3 Req 47.1**
 */

import { createServer, type Server } from 'node:http';
import { afterEach, describe, expect, it } from 'vitest';
import { toWebRequest, writeWebResponse } from './nodeBridge';

/** What a case does with the translated request */
type Answer = (request: Request) => Response | Promise<Response>;

const listening: Server[] = [];

afterEach(async () => {
  for (const server of listening.splice(0)) {
    await new Promise<void>((done) => {
      server.closeAllConnections();
      server.close(() => done());
    });
  }
});

/**
 * A listener that answers through the bridge, and its origin
 *
 * @param answer What to do with the request the bridge produced
 * @returns The origin to send requests to
 */
async function bridged(answer: Answer): Promise<string> {
  const server = createServer((incoming, outgoing) => {
    void (async () => {
      const request = toWebRequest(incoming);
      const response = await answer(request);
      await writeWebResponse(response, outgoing);
    })();
  });

  listening.push(server);

  await new Promise<void>((ready) => {
    server.listen(0, '127.0.0.1', () => ready());
  });

  // Narrowed here rather than imported as `AddressInfo` from `node:net`: that module is what an
  // SMTP client is built out of, and `the-server-sends-no-mail` refuses it — correctly, since the
  // rule cannot tell a type import from a socket (D12)
  const address = server.address();
  const port = typeof address === 'object' && address ? address.port : 0;

  return `http://127.0.0.1:${port}`;
}

describe('the Node ↔ Web bridge', () => {
  describe('toWebRequest', () => {
    it('carries the method, the path and the query through', async () => {
      let seen: { method: string; pathname: string; search: string } | null = null;
      const origin = await bridged((request) => {
        const url = new URL(request.url);
        seen = { method: request.method, pathname: url.pathname, search: url.search };
        return new Response(null, { status: 204 });
      });

      await fetch(`${origin}/api/rulesets/r1?draft=yes`, { method: 'DELETE' });

      expect(seen).toEqual({
        method: 'DELETE',
        pathname: '/api/rulesets/r1',
        search: '?draft=yes',
      });
    });

    it('carries the cookie, which is how every request says who is asking', async () => {
      let cookie: string | null = null;
      const origin = await bridged((request) => {
        cookie = request.headers.get('cookie');
        return new Response(null, { status: 204 });
      });

      await fetch(`${origin}/api/health`, { headers: { cookie: 'session=abc' } });

      expect(cookie).toBe('session=abc');
    });

    it('streams a body through rather than dropping it', async () => {
      let body: unknown = null;
      const origin = await bridged(async (request) => {
        body = await request.json();
        return new Response(null, { status: 204 });
      });

      const payload = JSON.stringify({ points: 3 });
      await fetch(`${origin}/api/characters/c1/invest-stat-points`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: payload,
      });

      expect(body).toEqual({ points: 3 });
    });

    it('gives a GET no body at all, which is what `Request` insists on', async () => {
      let hadBody = true;
      const origin = await bridged((request) => {
        hadBody = request.body !== null;
        return new Response(null, { status: 204 });
      });

      // A `Request` constructed with a body on a GET throws — the guard is why this is a branch
      // rather than an unconditional `Readable.toWeb`
      await fetch(`${origin}/api/health`);

      expect(hadBody).toBe(false);
    });
  });

  describe('writeWebResponse', () => {
    it('sends the status, the headers and the body', async () => {
      const origin = await bridged(
        () =>
          new Response('{"status":"ok"}', {
            status: 201,
            headers: { 'content-type': 'application/json', 'x-content-type-options': 'nosniff' },
          })
      );

      const response = await fetch(`${origin}/api/health`);
      const text = await response.text();

      expect(response.status).toBe(201);
      expect(response.headers.get('content-type')).toBe('application/json');
      expect(response.headers.get('x-content-type-options')).toBe('nosniff');
      expect(text).toBe('{"status":"ok"}');
    });

    it('keeps two Set-Cookie headers as two', async () => {
      const origin = await bridged(() => {
        const headers = new Headers();
        headers.append('set-cookie', 'session=abc; HttpOnly; Path=/; SameSite=Lax');
        headers.append('set-cookie', 'session_data=xyz; Path=/; SameSite=Lax');
        return new Response(null, { status: 204, headers });
      });

      const response = await fetch(`${origin}/api/auth/sign-in/email`);
      const cookies = response.headers.getSetCookie();

      // **The bug this whole module is careful about.** Iterating `Headers` yields these combined
      // into one comma-joined value, which no browser splits back into two — Better Auth sets more
      // than one cookie on a sign-in, so a lazy writer signs nobody in and throws nothing.
      expect(cookies).toHaveLength(2);
      expect(cookies[0]).toContain('session=abc');
      expect(cookies[1]).toContain('session_data=xyz');
    });

    it('ends a bodiless response rather than hanging on it', async () => {
      const origin = await bridged(() => new Response(null, { status: 204 }));

      const response = await fetch(`${origin}/api/rulesets/r1`, { method: 'DELETE' });
      const text = await response.text();

      expect(response.status).toBe(204);
      expect(text).toBe('');
    });
  });
});
