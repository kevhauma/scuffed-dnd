/**
 * Request pipeline tests (TICKET-SRV-01, TICKET-DX-06)
 *
 * The split this file is really about: a **refusal** explains itself to the client, and a **bug**
 * says nothing. Everything else here is plumbing around that one decision.
 *
 * TICKET-DX-06 added the `RequestScope` block at the bottom, which is about a different kind of
 * claim: the pipeline now accepts an injected account, and that is only sound while the set of
 * modules able to inject one stays small enough to read.
 *
 * **Validates: v3 Req 32.1**
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppError, badRequest, ERROR_CODE, STATUS_FOR_CODE } from './appError';
import { defineHandler } from './pipeline';

/** A request at the app's own origin — there is never a second one (D1) */
function post(body: string): Request {
  return new Request('http://localhost/api/thing', { method: 'POST', body });
}

describe('defineHandler', () => {
  beforeEach(() => {
    // The 500 path logs server-side on purpose; keep it out of the suite's output
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('sends what the handler returned as JSON with a 200', async () => {
    const response = await defineHandler(() => ({ name: 'Ducklets' }))(
      new Request('http://localhost/api/thing')
    );

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('application/json');
    expect(await response.json()).toEqual({ name: 'Ducklets' });
  });

  it('awaits an async handler', async () => {
    const response = await defineHandler(async () => ({ ok: true }))(
      new Request('http://localhost/api/thing')
    );

    expect(await response.json()).toEqual({ ok: true });
  });

  it('answers a handler that returned nothing with 204 and an empty body', async () => {
    // Not a 200 whose body is the four characters `undefined`, which is what `JSON.stringify`
    // produces and what a client's `.json()` then throws on. RUL-01's delete is the first caller.
    const response = await defineHandler(() => undefined)(
      new Request('http://localhost/api/thing', { method: 'DELETE' })
    );

    expect(response.status).toBe(204);
    expect(await response.text()).toBe('');
  });

  it('carries nosniff and no-store on every response', async () => {
    // From AUTH-03 on, each of these is account-specific; a cached one is the previous account's
    // data handed to the next
    const response = await defineHandler(() => ({ ok: true }))(
      new Request('http://localhost/api/thing')
    );

    expect(response.headers.get('x-content-type-options')).toBe('nosniff');
    expect(response.headers.get('cache-control')).toBe('no-store');
  });

  it('gives the handler the parsed URL, so no route re-parses it', async () => {
    const response = await defineHandler((context) => ({ path: context.url.pathname }))(
      new Request('http://localhost/api/thing?x=1')
    );

    expect(await response.json()).toEqual({ path: '/api/thing' });
  });

  it('carries no Account yet, and says so in the type rather than by omission', async () => {
    const response = await defineHandler((context) => ({ account: context.account }))(
      new Request('http://localhost/api/thing')
    );

    // TICKET-AUTH-03 resolves this from the session cookie; every handler is already shaped for it
    expect(await response.json()).toEqual({ account: null });
  });

  describe('a refusal the handler chose to make', () => {
    it("produces the code's status, the code and the message", async () => {
      const response = await defineHandler(() => {
        throw new AppError(ERROR_CODE.NOT_FOUND, 'That ruleset is not yours.');
      })(new Request('http://localhost/api/thing'));

      expect(response.status).toBe(404);
      expect(await response.json()).toEqual({
        error: { code: ERROR_CODE.NOT_FOUND, message: 'That ruleset is not yours.' },
      });
    });

    it('takes its status from the code, so the two cannot disagree', () => {
      // A caller that could pick both could pick a status outside 200–599, and `new Response`
      // would throw inside the pipeline's own catch — escaping the one thing it promises
      for (const code of Object.values(ERROR_CODE)) {
        const status = new AppError(code, 'x').status;

        expect(status, code).toBe(STATUS_FOR_CODE[code]);
        expect(status, code).toBeGreaterThanOrEqual(200);
        expect(status, code).toBeLessThanOrEqual(599);
      }
    });

    it('refuses a body that is not JSON, so no handler has to check', async () => {
      const response = await defineHandler((context) => context.json())(post('{ not json'));

      expect(response.status).toBe(400);
      expect((await response.json()).error.code).toBe(ERROR_CODE.BAD_REQUEST);
    });

    it('hands a handler the parsed body when it is JSON', async () => {
      const response = await defineHandler((context) => context.json())(
        post(JSON.stringify({ name: 'Aria' }))
      );

      expect(await response.json()).toEqual({ name: 'Aria' });
    });

    it('lets a handler throw its own bad-request without building a Response', async () => {
      const response = await defineHandler(() => {
        throw badRequest('name must be a string.');
      })(new Request('http://localhost/api/thing'));

      expect(response.status).toBe(400);
      expect((await response.json()).error.message).toBe('name must be a string.');
    });
  });

  describe('a bug that escaped the handler', () => {
    it('is a 500 that tells the client nothing about this server', async () => {
      const response = await defineHandler(() => {
        throw new TypeError("Cannot read properties of undefined (reading 'statValues')");
      })(new Request('http://localhost/api/thing'));

      const body = await response.json();

      expect(response.status).toBe(500);
      expect(body).toEqual({
        error: { code: ERROR_CODE.INTERNAL, message: 'Internal server error' },
      });
      // The thing that must not be in there: anything naming how this server is built
      expect(JSON.stringify(body)).not.toContain('statValues');
    });

    it('is logged server-side, where it is actually useful', async () => {
      const logged = vi.spyOn(console, 'error').mockImplementation(() => {});

      await defineHandler(() => {
        throw new Error('the database went away');
      })(new Request('http://localhost/api/thing'));

      expect(logged).toHaveBeenCalled();
      expect(String(logged.mock.calls[0])).toContain('the database went away');
    });

    it('never lets an error out of the pipeline itself', async () => {
      const handler = defineHandler(() => {
        // Not an Error at all — the shape a rejected promise can genuinely have
        throw 'a string';
      });

      await expect(handler(new Request('http://localhost/api/thing'))).resolves.toBeInstanceOf(
        Response
      );
    });
  });

  describe('RequestScope — who is allowed to say who is asking (TICKET-DX-06)', () => {
    it('reaches the handler when a caller supplies it', async () => {
      const handler = defineHandler((context) => ({ account: context.account?.id ?? null }));

      const response = await handler(new Request('http://localhost/api/thing'), {
        account: { id: 'a1' },
      });

      expect(await response.json()).toEqual({ account: 'a1' });
    });

    it('is null when nobody supplies one, which is every production call today', async () => {
      const handler = defineHandler((context) => ({ account: context.account }));

      const response = await handler(new Request('http://localhost/api/thing'));

      expect(await response.json()).toEqual({ account: null });
    });

    it('leaves identity resolution to exactly one module (TICKET-AUTH-01)', () => {
      // `currentAccount.ts` claims to be the only place a request becomes an Account, and AUTH-03's
      // guards will rest on that claim. Nothing structural enforces it — a handler could import
      // `authServer` and call `api.getSession` itself, and no dependency-cruiser rule would see it,
      // because rules match module edges and this is about *which* edges exist for one purpose.
      const root = resolve(process.cwd(), 'src/server');
      const askers = serverModules(root)
        .filter((file) => /\bgetSession\b/.test(codeIn(file)))
        .map((file) => relative(root, file).replace(/\\/g, '/'))
        .sort();

      expect(askers).toEqual(['auth/currentAccount.ts']);
    });

    it('is named by exactly two modules under src/server', () => {
      // `apiRouter.test.ts` proves the *router* passes no scope. This proves the rule the router
      // is one instance of: a pipeline that accepts an injected identity is only safe while the
      // set of things that can inject one is small enough to read. dependency-cruiser cannot help
      // — it matches module edges, not call arity — so the guard is a source scan.
      //
      // If a later ticket needs a third, that is a decision to take deliberately: add it here with
      // the reason. AUTH-01 does *not* need one — it makes the Auth_Session cookie the default
      // this overrides, inside `defineHandler`, rather than a second caller. TICKET-RUL-01 does not
      // either, and made the scan read **code rather than prose** to say so: `apiRouter.ts` and
      // `routes/rulesets/rulesetPayloads.ts` each explain in a comment why they read a path
      // parameter off the URL instead of widening this seam, and a guard that punished a module for
      // documenting the rule would teach people to stop documenting it.
      const root = resolve(process.cwd(), 'src/server');
      const allowed = ['http/pipeline.ts', 'testing/callRoute.ts'];

      const namers = serverModules(root)
        .filter((file) => /\bRequestScope\b/.test(codeIn(file)))
        .map((file) => relative(root, file).replace(/\\/g, '/'))
        .sort();

      expect(namers).toEqual(allowed);
    });

    it('still catches a module that names it in code rather than in a comment', () => {
      // The scan above ignores comments, so this proves the ignoring is narrow: strip the prose and
      // an actual reference is still there to find. Without this, "no third namer" could become
      // true by the stripper being too greedy rather than by the rule holding.
      expect(/\bRequestScope\b/.test(stripComments('// mentions RequestScope\nconst a = 1;'))).toBe(
        false
      );
      expect(
        /\bRequestScope\b/.test(stripComments('/** doc */\nconst s: RequestScope = {};'))
      ).toBe(true);
    });
  });
});

/** A module's source with block and line comments removed */
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, '');
}

/** What a module actually *does*, as text — the same discipline `routes/routeGuards.test.ts` uses */
function codeIn(file: string): string {
  return stripComments(readFileSync(file, 'utf8'));
}

/** Every non-test module under `src/server`, recursively */
function serverModules(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) return serverModules(full);
    return full.endsWith('.ts') && !full.includes('.test.') ? [full] : [];
  });
}
