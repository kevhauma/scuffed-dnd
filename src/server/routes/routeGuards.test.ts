/**
 * No route may name an owned resource and forget to guard it (TICKET-AUTH-03, v3 Req 51.10)
 *
 * **The load-bearing test of the milestone, and it has to be purpose-written.** Review catches a
 * missing guard on the day the route is written and never again; dependency-cruiser cannot catch it
 * at all, because it sees *imports* and this obligation is about a **call site** — a handler that
 * imports `requireOwner` and never calls it satisfies every import rule there is. TICKET-DX-08's
 * sixth criterion exists to write that limit down, and this is the test it points at.
 *
 * ## What counts as "names an owned resource"
 *
 * A handler that reads an identifier for something somebody owns — a ruleset, a game session, a
 * character — out of the request. Today that means a query parameter; TICKET-RUL-01 brings the
 * first real path parameter and {@link OWNED_PARAMETERS} grows a spelling for it. A route that
 * reads nothing owned (`/api/health`, `/api/auth-providers`) is public and is meant to be.
 *
 * ## The socket is a second entry point, and it is held to the same rule (TICKET-LIVE-01)
 *
 * A WebSocket upgrade is a way into the server that contains no `defineHandler(`, so the corpus
 * above would never see it — and *"authorization lives in `auth/guards.ts` and nowhere else"* is
 * not a rule about HTTP. So there is a second corpus below, found by
 * {@link SOCKET_MESSAGE_MARKER}, and it is run through the **same** detector: a second detector
 * would be a second thing to keep correct, and this one is already proven.
 *
 * **The marker is scoped to the message-decoding module rather than to `ws/` as a whole**, and the
 * distinction is the detector's own premise. What it catches is a module that reads an owned
 * identifier *out of something a caller sent*. `ws/rooms.ts` keys its map by session id without
 * ever reading one off a request — it is handed one by the module that did — so flagging it would
 * be demanding a guard call in the one place that has nothing to guard.
 *
 * ## Why the detector is proven against literals
 *
 * `routes/` contains no guarded route yet — RUL-01 brings the first — so a test that only walked
 * the real tree would pass by having nothing to look at, which is the unfalsifiable green box
 * TICKET-ROLL-03 flagged. So the detector is a pure function, run against two hand-written sources
 * as well as the real tree: one that guards and one that does not. If it ever stops catching the
 * second, this file fails today rather than in six months.
 *
 * **Validates: v3 Req 32.8, 51.10**
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * The whole server root, not just `routes/`
 *
 * **Two ways a narrower scan would go quietly green**, both already reachable: `readdirSync` is not
 * recursive, so TICKET-RUL-01's first `routes/rulesets/` subfolder would be unvisited; and handlers
 * are not confined to this directory — `auth/authRoutes.ts` is registered in `apiRouter.ts` and
 * lives elsewhere. A detector that narrows its own scope is the failure mode most worth pre-empting
 * in the test the milestone leans on, so the corpus is *every module that defines a handler*, found
 * by looking for `defineHandler(` rather than by trusting a folder name.
 */
const SERVER_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/** How a module announces that it answers requests */
const HANDLER_MARKER = 'defineHandler(';

/**
 * How a module announces that it decodes something a socket client sent (TICKET-LIVE-01)
 *
 * A module that branches on `CLIENT_MESSAGE_TYPE` is by definition reading a client's frame, which
 * is the socket's equivalent of reading a query parameter. Not `ws/` as a directory: the registry
 * lives there and is *handed* session ids rather than reading them, so it has nothing to guard.
 */
const SOCKET_MESSAGE_MARKER = 'CLIENT_MESSAGE_TYPE.';

/**
 * How a request names something somebody owns
 *
 * Spellings rather than types, because what is being scanned is source text. Both the camelCase
 * form a handler destructures and the snake_case a query string might carry, since a route is free
 * to name its parameter either way and forgetting a guard is not a spelling question.
 */
const OWNED_PARAMETERS = [
  'rulesetId',
  'ruleset_id',
  'sessionId',
  'session_id',
  'characterId',
  'character_id',
  'inviteId',
  'invite_id',
];

/**
 * The guards that answer for a *named resource*
 *
 * `requireAccount` is deliberately not among them. It is the right and sufficient guard for a route
 * that scopes by the caller and names no id — *list my rulesets* — but a route that reads an
 * identifier out of the request has to say something about **that** resource, and only these four
 * do. A handler calling `requireAccount` and then reading a `rulesetId` is exactly the mistake
 * worth catching.
 *
 * `requireInvitee` joined the list with TICKET-GAM-03. It is the odd one — an invitee owns nothing
 * and sits at no table — but it answers the same question about the same kind of identifier: *may
 * this caller act on the row this id names?*
 *
 * `requireCharacterPlayer` joined with TICKET-PLY-01. It is `requireCharacterWriter` minus the DM,
 * which the player-action routes need and every other character route does not.
 *
 * `requireCharacterDM` joined with TICKET-DM-01, and is the same guard minus the *owner* instead.
 */
const RESOURCE_GUARDS = [
  'requireOwner',
  'requireMember',
  'requireDM',
  'requireCharacterWriter',
  'requireCharacterPlayer',
  'requireCharacterDM',
  'requireInvitee',
];

/**
 * Whether a module's source names an owned resource without guarding it
 *
 * Comments are stripped first, so a module *explaining* the rule — this one's neighbours do — is
 * not itself reported.
 *
 * @param source The module's text
 * @returns True when it reads an owned identifier and calls no resource guard
 */
function namesOwnedResourceUnguarded(source: string): boolean {
  const code = source.replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, '');

  const namesOne = OWNED_PARAMETERS.some((parameter) => code.includes(parameter));
  if (!namesOne) return false;

  return !RESOURCE_GUARDS.some((guard) => code.includes(`${guard}(`));
}

/** Every `.ts` under a directory, at any depth, tests and fixtures excluded */
function sourceFiles(directory: string): string[] {
  return readdirSync(directory).flatMap((name) => {
    const path = join(directory, name);
    if (statSync(path).isDirectory()) {
      // `boundaryFixtures/` and `testing/` exist to be examples and helpers, not to answer requests
      return name === 'boundaryFixtures' || name === 'testing' ? [] : sourceFiles(path);
    }
    return name.endsWith('.ts') && !name.endsWith('.test.ts') ? [path] : [];
  });
}

/** Every server module, keyed by a path that reads the same on either platform */
function serverModules(): { path: string; source: string }[] {
  return sourceFiles(SERVER_ROOT).map((path) => ({
    path: path.replace(SERVER_ROOT, '').replaceAll('\\', '/'),
    source: readFileSync(path, 'utf8'),
  }));
}

/** Every module that defines a request handler, wherever it lives */
function handlerModules(): { path: string; source: string }[] {
  const modules = serverModules();
  return modules.filter(({ source }) => source.includes(HANDLER_MARKER));
}

/** Every module that decodes a message a socket client sent (TICKET-LIVE-01) */
function socketMessageModules(): { path: string; source: string }[] {
  const modules = serverModules();
  return modules.filter(({ source }) => source.includes(SOCKET_MESSAGE_MARKER));
}

describe('the detector', () => {
  it('catches a handler that reads an owned id and guards nothing', () => {
    const unguarded = `
      export const getRuleset = defineHandler((context) => {
        const rulesetId = context.url.searchParams.get('id') ?? '';
        return findRuleset(rulesetId);
      });
    `;

    expect(namesOwnedResourceUnguarded(unguarded)).toBe(true);
  });

  it('passes the same handler once a guard is called', () => {
    const guarded = `
      export const getRuleset = defineHandler((context) => {
        const rulesetId = context.url.searchParams.get('id') ?? '';
        return requireOwner(context, findRuleset(rulesetId));
      });
    `;

    expect(namesOwnedResourceUnguarded(guarded)).toBe(false);
  });

  it('is not satisfied by importing a guard without calling it', () => {
    // The exact hole dependency-cruiser cannot see, and the reason this test is hand-written
    const imported = `
      import { requireOwner } from '../auth/guards';
      export const getRuleset = defineHandler((context) => {
        const rulesetId = context.url.searchParams.get('id') ?? '';
        return findRuleset(rulesetId);
      });
    `;

    expect(namesOwnedResourceUnguarded(imported)).toBe(true);
  });

  it('leaves a route that names nothing owned alone', () => {
    const publicRoute = `
      export const health = defineHandler(() => ({ status: 'ok' }));
    `;

    expect(namesOwnedResourceUnguarded(publicRoute)).toBe(false);
  });

  it('is not fooled by a comment mentioning an owned id', () => {
    const commented = `
      // TICKET-RUL-01 will read a rulesetId here
      export const health = defineHandler(() => ({ status: 'ok' }));
    `;

    expect(namesOwnedResourceUnguarded(commented)).toBe(false);
  });
});

describe('the real route tree', () => {
  it('has modules to walk, so this is not passing by looking at nothing', () => {
    expect(handlerModules().length).toBeGreaterThan(0);
  });

  it('finds handlers outside routes/ as well as inside it', () => {
    // The scan is by `defineHandler(`, not by folder — `/api/health` and `/api/auth-providers` both
    // live in `routes/`, but nothing makes that a rule, and a detector that assumed it would miss
    // the first handler somebody puts elsewhere
    const paths = handlerModules().map(({ path }) => path);

    expect(paths).toContain('/routes/health.ts');
    expect(paths).toContain('/routes/authProviders.ts');
  });

  it('contains no handler that names an owned resource without a guard', () => {
    const offenders = handlerModules()
      .filter(({ source }) => namesOwnedResourceUnguarded(source))
      .map(({ path }) => path);

    expect(offenders).toEqual([]);
  });
});

describe('the detector, on a socket message surface', () => {
  it('catches one that reads a session id off a frame and guards nothing', () => {
    // The mistake worth pre-empting on a new entry point: the upgrade settled *who is asking*, and
    // it is easy to read that as having settled *may they*. It has not — a connection is admitted
    // to the server, and to a room only when `requireMember` says so
    const unguarded = `
      if (message.type === CLIENT_MESSAGE_TYPE.SUBSCRIBE) {
        rooms.join(message.sessionId, connection);
      }
    `;

    const verdict = namesOwnedResourceUnguarded(unguarded);

    expect(verdict).toBe(true);
  });

  it('passes the same surface once a guard is called', () => {
    const guarded = `
      if (message.type === CLIENT_MESSAGE_TYPE.SUBSCRIBE) {
        requireMember(asking, message.sessionId);
        rooms.join(message.sessionId, connection);
      }
    `;

    const verdict = namesOwnedResourceUnguarded(guarded);

    expect(verdict).toBe(false);
  });

  it('is not satisfied by a socket asking the repository itself', () => {
    // The specific way a socket would grow its own authorization: `findSessionMember` answers the
    // same question `requireMember` does, in a place nobody reviews as an authorization rule
    const homeGrown = `
      if (message.type === CLIENT_MESSAGE_TYPE.SUBSCRIBE) {
        const seat = findSessionMember(message.sessionId, connection.accountId);
        if (seat) rooms.join(message.sessionId, connection);
      }
    `;

    const verdict = namesOwnedResourceUnguarded(homeGrown);

    expect(verdict).toBe(true);
  });
});

describe('the real socket surface', () => {
  it('has a module to walk, so this is not passing by looking at nothing', () => {
    const paths = socketMessageModules().map(({ path }) => path);

    expect(paths).toContain('/ws/subscription.ts');
  });

  it('does not count the room registry, which is handed ids rather than reading them', () => {
    // Stated as a test rather than only as a comment, because the day somebody moves the decoding
    // into `rooms.ts` this should start demanding a guard there
    const paths = socketMessageModules().map(({ path }) => path);

    expect(paths).not.toContain('/ws/rooms.ts');
  });

  it('contains no socket surface that names an owned resource without a guard', () => {
    const offenders = socketMessageModules()
      .filter(({ source }) => namesOwnedResourceUnguarded(source))
      .map(({ path }) => path);

    expect(offenders).toEqual([]);
  });
});
