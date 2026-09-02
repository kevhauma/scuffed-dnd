/**
 * Serving the built client bundle from the server that renders it (TICKET-POL-03)
 *
 * **The bundle is served by this process, not by a static host beside it** (D1, v3 Req 47.6). An
 * operator starts one thing and keeps one thing alive; there is no second web server to configure,
 * no second origin for a cookie to miss, and no arrangement in which the app and the API can
 * disagree about where they are.
 *
 * Under `yarn dev` Vite answers these requests, so nothing here runs. In the built artefact this is
 * the first thing every request meets: a hit is written from disk, and a **miss falls through to
 * the server's own handler**, which is what makes SSR the default and static files the exception.
 * There is no `index.html` to fall back to — this application renders its shell on the server.
 *
 * ## What a path may reach
 *
 * A request path is attacker-controlled text, and the only rule that matters is that no *path* can
 * name a file outside the bundle. The check is on the **resolved** path rather than on the text —
 * `..`, its percent-encoded spellings, a backslash on Windows and an absolute path all collapse to
 * the same answer once `resolve` has run, and a check written against the spelling would have to
 * anticipate each of them. A path that leaves the root is not an error: it is a miss, like any
 * other file that is not there.
 *
 * **Two residual limits, stated rather than left absolute.** `resolve` normalises text; it is not
 * `realpath`, so a **symlink inside the bundle pointing outward** would be followed and served —
 * the guarantee is about what a request can *name*, not about what the directory contains, and what
 * the directory contains is the build's business. And the decode happens **once**: `%252e%252e`
 * becomes the literal text `%2e%2e`, which is a file name rather than a traversal, so it is a miss
 * — correct, but correct because it never becomes `..` rather than because something rejected it.
 *
 * **Every decision here reads the resolved path, not the request text.** The review found the
 * caching rule breaking that: `/assets/../favicon.ico` resolves to a non-hashed file *inside* the
 * root and still starts with `/assets/`, so it would have been served `immutable` — a year's
 * pinning in any shared cache that does not normalise, on exactly the file the constant's own note
 * says must never get it.
 *
 * **Validates: v3 Req 47.1, 47.6**
 */

import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import type { ServerResponse } from 'node:http';
import { extname, resolve, sep } from 'node:path';
import { pipeline } from 'node:stream/promises';

/**
 * What each extension in the bundle is sent as
 *
 * Deliberately short: this serves **one** directory, whose contents the build produces, so an
 * extension with no entry is one nothing emits. A general-purpose MIME table would be a dependency
 * or a hundred lines, and either would be answering a question this module does not have.
 */
const CONTENT_TYPES = {
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.map': 'application/json; charset=utf-8',
  // Typed as possibly-absent rather than `as const satisfies Record<string, string>`, which made
  // the compiler believe every lookup returned a `string` — so the `??` below read as decoration
  // while the runtime value was `undefined` for anything not listed
} as const satisfies Record<string, string | undefined>;

/** What anything unrecognised is sent as — bytes, with no invitation to guess */
const DEFAULT_CONTENT_TYPE = 'application/octet-stream';

/**
 * The directory Vite fills with content-hashed file names
 *
 * Everything in it is safe to cache forever, because a changed file is a changed **name**. Nothing
 * outside it is: `favicon.ico` and `manifest.json` keep theirs across builds.
 *
 * Compared against the **resolved** path rather than the request's, so that
 * `/assets/../favicon.ico` — which resolves to a file inside the root and would satisfy any test on
 * the text — is cached as what it *is*. A year is a long time to be wrong about a file name.
 */
const IMMUTABLE_DIRECTORY = 'assets';

/** A year, which is the longest `max-age` the specification asks anyone to honour */
const IMMUTABLE_CACHE = 'public, max-age=31536000, immutable';

/**
 * What everything else is sent with
 *
 * `max-age=0, must-revalidate` rather than `no-store`: the browser keeps the file and asks whether
 * it changed, which is a conditional request rather than a download.
 */
const REVALIDATE_CACHE = 'public, max-age=0, must-revalidate';

/** A file the bundle actually holds, ready to be sent */
export interface StaticFile {
  /** Where it is on disk — absolute, and proven to be inside the root */
  path: string;
  contentType: string;
  cacheControl: string;
  /** Its length, so the response can carry one rather than close to signal the end */
  size: number;
}

/**
 * The path a request names, relative to the bundle root, or `null` if it names nothing legal
 *
 * @param pathname The request's path, still percent-encoded
 * @returns The decoded path with its leading slash removed, or `null`
 */
function decodePathname(pathname: string): string | null {
  let decoded: string;

  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    // A malformed escape is not a file name. Answering *miss* rather than throwing keeps a broken
    // URL from being a 500 that looks like a server fault.
    return null;
  }

  // A NUL truncates a path in some system calls, which is how a check on the whole string ends up
  // guarding a prefix of it
  if (decoded.includes('\0')) return null;

  return decoded.replace(/^\/+/, '');
}

/**
 * Find the file a request names, if the bundle holds one
 *
 * @param root The directory the client bundle was built into
 * @param pathname The request's path
 * @returns The file, or `null` when the request is not for one
 */
export async function findStaticFile(root: string, pathname: string): Promise<StaticFile | null> {
  const relative = decodePathname(pathname);
  if (relative === null || relative === '') return null;

  const base = resolve(root);
  const candidate = resolve(base, relative);

  // The one rule: it has to be **inside** the bundle. Checked on the resolved path, so every
  // spelling of "go up a directory" is already gone by the time this compares anything.
  if (candidate !== base && !candidate.startsWith(`${base}${sep}`)) return null;

  try {
    const stats = await stat(candidate);
    // A directory is a miss rather than a listing: this server has no directory index, and
    // producing one would publish the shape of the deployment for free
    if (!stats.isFile()) return null;

    const extension = extname(candidate).toLowerCase();
    const known = CONTENT_TYPES[extension as keyof typeof CONTENT_TYPES];

    // Read off the **resolved** path, beside the check above and for the same reason: the module's
    // rule is that no list of spellings has to be complete, and that has to be true of every
    // decision here rather than only of the one about safety
    const immutablePrefix = `${base}${sep}${IMMUTABLE_DIRECTORY}${sep}`;
    const immutable = candidate.startsWith(immutablePrefix);

    return {
      path: candidate,
      contentType: known ?? DEFAULT_CONTENT_TYPE,
      cacheControl: immutable ? IMMUTABLE_CACHE : REVALIDATE_CACHE,
      size: stats.size,
    };
  } catch {
    // Not there, or not readable by this process. Both are the same answer to a browser, and
    // saying which would describe the deployment to anyone who asked.
    return null;
  }
}

/**
 * Write a found file to the socket
 *
 * @param file What {@link findStaticFile} found
 * @param outgoing The socket to write it to
 * @param method The request's method — a `HEAD` gets the headers and none of the bytes
 */
export async function sendStaticFile(
  file: StaticFile,
  outgoing: ServerResponse,
  method: string
): Promise<void> {
  outgoing.writeHead(200, {
    'content-type': file.contentType,
    'content-length': file.size,
    'cache-control': file.cacheControl,
    // The bundle is served from the same origin as everything else, so a file that is not what its
    // extension claims must not be sniffed into something executable
    'x-content-type-options': 'nosniff',
  });

  if (method === 'HEAD') {
    outgoing.end();
    return;
  }

  const source = createReadStream(file.path);

  try {
    await pipeline(source, outgoing);
  } catch {
    // A client that navigated away mid-download, or a file that vanished between the stat and the
    // read. Neither is actionable and neither may be left holding a stream open.
    outgoing.destroy();
  }
}
