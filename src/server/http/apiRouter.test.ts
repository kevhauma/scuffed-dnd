/**
 * API router tests (TICKET-SRV-01)
 *
 * The one behaviour worth stating plainly: a request that is *not* API traffic comes back as
 * `null`, not as a 404. That `null` is what lets one process serve the app and the API from one
 * origin (D1) — the entry falls through to Start's SSR handler instead.
 *
 * Server tests call handlers directly and never boot Nitro: `vitest.config.ts` still omits
 * `tanstackStart()`, for the reason its own header records.
 *
 * **Validates: v3 Req 47.5, 47.6**
 */

import { describe, expect, it } from 'vitest';
import { AUTH_PREFIX } from '../auth/paths';
import { withTestDatabase } from '../testing/database';
import { API_PREFIX, handleApiRequest, PATTERN_ROUTES, ROUTES } from './apiRouter';
import { ERROR_CODE } from './appError';

/**
 * Every route key, exact and patterned alike (TICKET-RUL-01)
 *
 * The table-shape assertions below are about *every* route, and a second table that they did not
 * walk would be a second table where a key could hide under the auth subtree or forget the API
 * prefix. One list, so adding a third table is a compile-visible edit here rather than a silent
 * gap.
 */
const ROUTE_KEYS = [...Object.keys(ROUTES), ...Object.keys(PATTERN_ROUTES)];

function request(path: string, method = 'GET'): Request {
  return new Request(`http://localhost${path}`, { method });
}

/** Ask the router and insist it answered — `null` means "not API traffic", which is its own test */
async function answer(path: string, method = 'GET'): Promise<Response> {
  const response = await handleApiRequest(request(path, method));
  if (!response) throw new Error(`${method} ${path} was not claimed by the API router`);
  return response;
}

describe('handleApiRequest', () => {
  it('declines anything that is not API traffic, so the app can serve it', async () => {
    for (const path of ['/', '/config', '/play/character/aria', '/apiary']) {
      expect(await handleApiRequest(request(path)), path).toBeNull();
    }
  });

  it('answers GET /api/health through the pipeline', async () => {
    const response = await answer('/api/health');

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      status: 'ok',
      environment: expect.any(String),
      database: { reachable: true, migration: null },
    });
  });

  it('404s an API path that does not exist', async () => {
    // Was `/api/rulesets` until TICKET-RUL-01 made that a real route — a nice reminder that a
    // "nothing is here" test has to name a path nothing will ever be at
    const response = await answer('/api/nowhere');

    expect(response.status).toBe(404);
    expect((await response.json()).error.code).toBe(ERROR_CODE.NOT_FOUND);
  });

  it('405s a known path with the wrong verb, which is a different mistake', async () => {
    const response = await answer('/api/health', 'POST');

    expect(response.status).toBe(405);
    expect((await response.json()).error.code).toBe(ERROR_CODE.METHOD_NOT_ALLOWED);
  });

  it('echoes neither the path nor the method back into a refusal body', async () => {
    const response = await answer('/api/<script>alert(1)</script>', 'POST');
    const body = await response.text();

    // The status carries the meaning; an unbounded echo of attacker-controlled text earns nothing
    expect(body).not.toContain('script');
  });

  it('answers HEAD with the GET route, headers and all, and no body', async () => {
    // What HEAD is, and what an uptime probe or a load balancer sends
    const response = await answer('/api/health', 'HEAD');

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('application/json');
    expect(await response.text()).toBe('');
  });

  it('keeps every route under one prefix, so the fall-through rule is a prefix test', () => {
    for (const key of ROUTE_KEYS) {
      expect(key.split(' ')[1]?.startsWith(API_PREFIX), key).toBe(true);
    }
  });

  it('spells every route key as METHOD /path', () => {
    for (const key of ROUTE_KEYS) {
      expect(key, key).toMatch(/^(GET|POST|PATCH|PUT|DELETE) \/api\/\S*$/);
    }
  });

  describe('path parameters (TICKET-RUL-01)', () => {
    // The router's half of `/api/rulesets/:id`. That the guarded handlers behind it refuse an
    // anonymous caller is proven in `routes/rulesets/rulesets.test.ts`; what these assert is that
    // the request **reaches** one, which a 401 from the pipeline shows and a 404 from the router
    // would not.
    // A real database, because these two reach a handler that looks a ruleset up — the guard
    // refuses the anonymous caller, but `requireOwner(context, findRuleset(id))` evaluates its
    // argument first, which is the shape `auth/guards.ts` documents
    it('reaches a route whose path carries a parameter', () =>
      withTestDatabase(async () => {
        for (const method of ['GET', 'PUT', 'PATCH', 'DELETE']) {
          expect((await answer('/api/rulesets/abc', method)).status, method).toBe(401);
        }
      }));

    it('405s a parameterised path with a verb no route answers', async () => {
      // `POST` rather than `PUT`: TICKET-RUL-02 made `PUT` a real route, which is a nice reminder
      // that a "nothing answers this" test has to name a verb nothing will answer
      const response = await answer('/api/rulesets/abc', 'POST');

      expect(response.status).toBe(405);
      expect((await response.json()).error.code).toBe(ERROR_CODE.METHOD_NOT_ALLOWED);
    });

    it('matches segment counts exactly, so a deeper path is not swallowed', async () => {
      // `:id` is one segment, not "the rest of the path" — RUL-03's `/api/rulesets/:id/copy` has
      // to be able to arrive as its own route rather than as an id containing a slash
      expect((await answer('/api/rulesets/abc/copy', 'PATCH')).status).toBe(404);
    });

    it('does not let a parameter match an empty segment', async () => {
      // `/api/rulesets/` is the collection with a trailing slash, not a ruleset with no id
      expect((await answer('/api/rulesets/', 'DELETE')).status).toBe(404);
    });
  });

  it('keeps the auth subtree inside the API prefix (TICKET-AUTH-01)', () => {
    // `AUTH_PREFIX` cannot import `API_PREFIX` — the router imports the auth routes, so the other
    // direction would be a cycle. This is the guarantee by a route that does not create one.
    expect(AUTH_PREFIX.startsWith(API_PREFIX)).toBe(true);
  });

  it('reports no providers when the deployment has configured none (v3 Req 31.6)', async () => {
    // **This file is the unconfigured case**, and deliberately: it sets no OAuth variables, so the
    // environment it reads is the one an operator who never wanted social sign-in has. The two
    // buttons are absent because this list is empty, and nothing else about the app changes.
    const response = await answer('/api/auth-providers');

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ providers: [] });
  });

  it('answers the provider list to an anonymous caller, because that is who needs it', async () => {
    // No cookie, no account, no guard — the person looking at the sign-in page is by definition
    // not signed in, and a provider id is public the moment its button is on the page
    expect((await answer('/api/auth-providers')).status).toBe(200);
  });

  it('lets no route table entry hide under the auth subtree (TICKET-AUTH-01)', () => {
    // The auth subtree is matched *before* the table, so a `ROUTES` key inside it would be silently
    // unreachable — a route that exists, is listed, and never runs.
    //
    // **The test asserts the router's own rule rather than a stricter one.** It used to compare a
    // bare string prefix, which made `/api/auth-providers` (TICKET-AUTH-02) look like a collision:
    // it shares six characters with `/api/auth` and is not under it. The router matches the path
    // itself or the path plus a separator, and so does this.
    for (const key of ROUTE_KEYS) {
      const path = key.split(' ')[1] ?? '';
      expect(path === AUTH_PREFIX || path.startsWith(`${AUTH_PREFIX}/`), key).toBe(false);
    }
  });

  it('reaches a route whose path merely begins like the auth subtree (TICKET-AUTH-02)', async () => {
    // The other half of the rule above, asserted through the router rather than about it: this is
    // the reason `/api/auth-providers` is spelled with a hyphen instead of as `/api/auth/providers`
    expect((await answer('/api/auth-providers')).status).toBe(200);
  });

  it('never hands a route an account, whatever the request carries (TICKET-DX-06)', async () => {
    // `defineHandler` takes an optional `RequestScope`, and the whole safety argument for that
    // parameter is that the router does not use it — a test's `callRoute` may say *as this
    // account*, and nothing reachable from a socket may. Asserted on the call rather than by
    // reading the source: the router is handed a route that reports what it was given.
    const seen: Array<unknown> = [];
    const spy = ((_request: Request, scope?: unknown) => {
      seen.push(scope);
      return Promise.resolve(new Response(null, { status: 204 }));
    }) as (typeof ROUTES)[string];

    const original = ROUTES['GET /api/health'];
    ROUTES['GET /api/health'] = spy;

    try {
      // Everything an attacker controls: a header naming an account, and a body claiming one
      await handleApiRequest(
        new Request('http://localhost/api/health', {
          headers: { 'x-account-id': 'somebody-else', authorization: 'Bearer somebody-else' },
        })
      );
    } finally {
      ROUTES['GET /api/health'] = original;
    }

    expect(seen).toStrictEqual([undefined]);
  });
});
