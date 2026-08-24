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
import { API_PREFIX, handleApiRequest, ROUTES } from './apiRouter';
import { ERROR_CODE } from './appError';

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
    expect(await response.json()).toEqual({ status: 'ok', environment: expect.any(String) });
  });

  it('404s an API path that does not exist', async () => {
    const response = await answer('/api/rulesets');

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
    for (const key of Object.keys(ROUTES)) {
      expect(key.split(' ')[1]?.startsWith(API_PREFIX), key).toBe(true);
    }
  });

  it('spells every route key as METHOD /path', () => {
    for (const key of Object.keys(ROUTES)) {
      expect(key, key).toMatch(/^(GET|POST|PATCH|PUT|DELETE) \/api\/\S*$/);
    }
  });
});
