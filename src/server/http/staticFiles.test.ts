/**
 * Static-file tests (TICKET-POL-03)
 *
 * Two questions, and the second is the one that matters: *does a request reach the file it names*,
 * and *can a request reach a file it does not*. The traversal cases are written as the spellings an
 * attacker actually sends — encoded, doubled, backslashed, absolute — rather than as one `../`,
 * because the check is on the resolved path precisely so that no list of spellings has to be
 * complete.
 *
 * Against a real directory on disk rather than a mocked `fs`: the property being tested is what
 * `resolve` and `stat` do with a hostile string, and a mock is a second opinion about that.
 *
 * **Validates: v3 Req 47.1, 47.6**
 */

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { findStaticFile } from './staticFiles';

const temporary: string[] = [];

afterEach(() => {
  for (const directory of temporary.splice(0)) rmSync(directory, { recursive: true, force: true });
});

/**
 * A directory shaped like a built client bundle, with a secret next to it
 *
 * The sibling is what a traversal would reach, and it is outside the root rather than inside it —
 * a case that passes because the file happens not to exist is not a case.
 *
 * @returns The bundle root, and the directory holding it
 */
function bundle(): { root: string; parent: string } {
  const temporaryRoot = tmpdir();
  const prefix = join(temporaryRoot, 'dnd-bundle-');
  const parent = mkdtempSync(prefix);
  temporary.push(parent);

  const root = join(parent, 'client');
  const assets = join(root, 'assets');
  mkdirSync(assets, { recursive: true });

  const script = join(assets, 'main-abc123.js');
  writeFileSync(script, 'console.info(1)', 'utf8');

  const icon = join(root, 'favicon.ico');
  writeFileSync(icon, 'not really an icon', 'utf8');

  // The file a traversal would win, and it is genuinely *outside* the root — a case that passes
  // because its target does not exist is not a case
  const secret = join(parent, '.env');
  writeFileSync(secret, 'BETTER_AUTH_SECRET=hunter2', 'utf8');

  return { root, parent };
}

describe('findStaticFile', () => {
  it('finds a file the bundle holds, with its content type', async () => {
    const { root } = bundle();

    const file = await findStaticFile(root, '/assets/main-abc123.js');

    expect(file?.contentType).toBe('text/javascript; charset=utf-8');
    expect(file?.size).toBeGreaterThan(0);
  });

  it('lets a hashed asset be cached forever, because a change is a new name', async () => {
    const { root } = bundle();

    const file = await findStaticFile(root, '/assets/main-abc123.js');

    expect(file?.cacheControl).toBe('public, max-age=31536000, immutable');
  });

  it('makes everything else revalidate, because those names outlive a build', async () => {
    const { root } = bundle();

    const file = await findStaticFile(root, '/favicon.ico');

    expect(file?.cacheControl).toBe('public, max-age=0, must-revalidate');
  });

  describe('the caching decision reads the resolved path, not the request text', () => {
    it.each([
      ['plain', '/assets/../favicon.ico'],
      ['encoded', '/assets/%2e%2e/favicon.ico'],
      ['encoded separator', '/assets/..%2ffavicon.ico'],
    ])('does not pin a non-hashed file for a year when spelled %s', async (_spelling, pathname) => {
      const { root } = bundle();

      // Each of these lands on `favicon.ico` — inside the root, so served — while still *starting
      // with* `/assets/`. A year of `immutable` in any shared cache that does not normalise, on
      // exactly the file whose name outlives the build.
      const file = await findStaticFile(root, pathname);

      expect(file?.cacheControl).toBe('public, max-age=0, must-revalidate');
    });

    it('still pins a hashed asset reached by an odd but legal spelling', async () => {
      const { root } = bundle();

      // The inverse of the bug: a leading `//` reads as *not* under `/assets/` as text, and is
      // exactly the hashed file whose whole point is that it can be cached forever
      const file = await findStaticFile(root, '//assets/main-abc123.js');

      expect(file?.cacheControl).toBe('public, max-age=31536000, immutable');
    });
  });

  it('answers nothing for a path the bundle does not hold', async () => {
    const { root } = bundle();

    const file = await findStaticFile(root, '/rulesets/r1');

    // A miss rather than a 404: the SSR handler answers this, and a static server that claimed it
    // would take the whole app down to a file listing
    expect(file).toBeNull();
  });

  it('answers nothing for the root itself', async () => {
    const { root } = bundle();

    const file = await findStaticFile(root, '/');

    expect(file).toBeNull();
  });

  it('answers nothing for a directory, rather than listing it', async () => {
    const { root } = bundle();

    const file = await findStaticFile(root, '/assets');

    expect(file).toBeNull();
  });

  describe('a path trying to leave the bundle', () => {
    it.each([
      ['plain', '/../.env'],
      ['doubled', '/assets/../../.env'],
      ['encoded', '/%2e%2e/.env'],
      ['encoded separator', '/..%2f.env'],
      ['backslashed', '/..\\.env'],
      ['absolute-looking', '//../.env'],
    ])('is refused when spelled %s', async (_spelling, pathname) => {
      const { root } = bundle();

      const file = await findStaticFile(root, pathname);

      // The `.env` really is there, one directory up — this is the file a traversal would win
      expect(file).toBeNull();
    });

    it('is refused when it carries a NUL, which truncates a path in a syscall', async () => {
      const { root } = bundle();

      const file = await findStaticFile(root, '/favicon.ico\0.js');

      expect(file).toBeNull();
    });

    it('is refused when its escapes are malformed rather than becoming a 500', async () => {
      const { root } = bundle();

      const file = await findStaticFile(root, '/%E0%A4%A');

      expect(file).toBeNull();
    });
  });

  it('sends an unknown extension as bytes rather than guessing', async () => {
    const { root } = bundle();
    const oddity = join(root, 'thing.unknown');
    writeFileSync(oddity, 'bytes', 'utf8');

    const file = await findStaticFile(root, '/thing.unknown');

    expect(file?.contentType).toBe('application/octet-stream');
  });
});
