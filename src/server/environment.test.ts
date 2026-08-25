/**
 * The server suite runs in node, not in a browser (TICKET-AUTH-01)
 *
 * `vitest.config.ts` splits the run in two on D14's root boundary — `src/server/` in **node**,
 * everything else in **happy-dom** — and this is the assertion that keeps it true.
 *
 * **It is here because of a bug that passed.** happy-dom's `Headers` silently discards
 * `Set-Cookie`: `get('set-cookie')` returns `null`, `getSetCookie()` returns `[]`, and iterating
 * yields nothing, with no error anywhere. Every assertion about an Auth_Session cookie was
 * therefore comparing an empty string against itself and agreeing. A test that cannot fail is
 * worse than no test, so the environment is a check rather than a setting somebody remembers.
 *
 * **Validates: v3 Req 30.4, 45.3**
 */

import { describe, expect, it } from 'vitest';

describe('the server test environment', () => {
  it('has no DOM, because the server does not', () => {
    // The server has no `window`, no `document` and no `localStorage`. A test environment that
    // provides them is a test environment where a mistake reads as working code.
    expect(typeof globalThis.window).toBe('undefined');
    expect(typeof globalThis.document).toBe('undefined');
  });

  it('keeps Set-Cookie on a Response, which is the whole reason for the split', () => {
    const response = new Response(null, {
      headers: { 'set-cookie': 'session=abc; HttpOnly; Path=/; Max-Age=60' },
    });

    // Under happy-dom every one of these is empty, and nothing throws
    expect(response.headers.get('set-cookie')).toContain('HttpOnly');
    expect(response.headers.getSetCookie()).toHaveLength(1);
  });
});
