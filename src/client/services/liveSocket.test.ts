/**
 * The socket's address is derived, never configured (TICKET-LIVE-01, v3 Req 47.6)
 *
 * Two halves, and the second is the one that decays without a check. *The URL is right* is an
 * assertion about a function; *no environment variable or constant names the socket host* is an
 * assertion about the **module**, which stays true only for as long as nobody adds a fallback — so
 * it is asserted against the source text, the way `routeGuards.test.ts` asserts a call-site
 * obligation it cannot express as a type.
 *
 * **Validates: v3 Req 47.6, 44.1**
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { LIVE_SOCKET_PATH } from '#shared/types/liveSocket';
import { liveSocketUrl } from './liveSocket';

describe('the URL', () => {
  it('should use ws: on a page served over http:', () => {
    const address = liveSocketUrl({ protocol: 'http:', host: 'localhost:3000' });

    expect(address).toBe(`ws://localhost:3000${LIVE_SOCKET_PATH}`);
  });

  it('should use wss: on a page served over https:', () => {
    // The branch that only exists in production, and the one a test on localhost would never reach
    // by accident: a page over TLS opening a `ws:` socket is mixed content and the browser refuses
    // it, so hard-coding either scheme breaks exactly one deployment and never the developer's
    const address = liveSocketUrl({ protocol: 'https:', host: 'dnd.example.com' });

    expect(address).toBe(`wss://dnd.example.com${LIVE_SOCKET_PATH}`);
  });

  it('should keep the port the page was served from', () => {
    const address = liveSocketUrl({ protocol: 'http:', host: '192.168.1.20:8080' });

    expect(address).toBe(`ws://192.168.1.20:8080${LIVE_SOCKET_PATH}`);
  });

  it('should treat anything that is not https: as plain', () => {
    // A deliberately conservative default: an unrecognised scheme becoming `wss:` would be a
    // connection that silently cannot be made, where `ws:` fails loudly and locally
    const address = liveSocketUrl({ protocol: 'file:', host: 'localhost' });

    expect(address).toBe(`ws://localhost${LIVE_SOCKET_PATH}`);
  });

  it('should be the same address the page itself came from', () => {
    // D1 as an assertion: same host, same port, so the Auth_Session cookie rides the upgrade with
    // nothing added and no CORS layer exists anywhere in this milestone
    const page = { protocol: 'https:', host: 'table.example.org:8443' };
    const address = liveSocketUrl(page);

    expect(address).toContain(page.host);
  });
});

describe('the module itself', () => {
  const thisFile = fileURLToPath(import.meta.url);
  const here = dirname(thisFile);
  const modulePath = join(here, 'liveSocket.ts');
  const source = readFileSync(modulePath, 'utf8');

  /** The prose explains what the code must not do, so the prose is not what is being scanned */
  const code = source.replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, '');

  it('should read no environment variable', () => {
    // **Written as patterns rather than as string literals on purpose.** `server/env.test.ts`
    // scans `src/` for the text `process.env` to prove that `env.ts` is its only reader, and a
    // test that spelled the needle out would register there as a second one. Do not "simplify"
    // these back to `toContain`.
    expect(code).not.toMatch(/import\.meta\.env/);
    expect(code).not.toMatch(/process\.env/);
  });

  it('should name no host, and no origin to talk to', () => {
    // `https:` on its own is a *page* scheme this compares against, which is why the pattern asks
    // for the slashes — an origin is what is forbidden, not the word
    expect(code).not.toMatch(/https?:\/\//);
    expect(code).not.toMatch(/localhost|127\.0\.0\.1/);
  });

  it('should take the path from the shared contract rather than spelling it again', () => {
    // Both ends of the socket have to agree on where it is, and two spellings is one drift
    expect(code).toContain('LIVE_SOCKET_PATH');
    expect(code).not.toContain("'/api/live'");
  });
});
