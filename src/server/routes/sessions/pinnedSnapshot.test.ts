/**
 * A session's rules come from its Snapshot, and that is checked rather than promised (TICKET-GAM-01)
 *
 * The ticket's to-be asks for D7 *"enforced by the session's read path returning the Snapshot **and
 * by nothing in `src/server/` loading a Ruleset by the session's `ruleset_id` for gameplay**"*. The
 * first half is an ordinary assertion and lives in `sessions.test.ts`; the second is a claim about
 * **which code exists**, which no ordinary test can make and dependency-cruiser cannot either —
 * `refreshSnapshot` imports `findRuleset` legitimately, so the obligation is about *why* a module
 * imports it rather than *whether* it does.
 *
 * So this is a source scan, in the shape `routes/routeGuards.test.ts` established. It exists because
 * `refreshSnapshot` is now a precedent: the next ticket that wants a ruleset inside a session route
 * will find one module already doing it and copy the shape without the reasoning. The exemption is a
 * **list of one**, so widening it is a deliberate edit with a name attached rather than a silence.
 *
 * **Validates: v3 Req 37.2, 37.4**
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/** Everything the server is, so a session route living somewhere else is still seen */
const SERVER_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');

/** How a module reaches the live Ruleset table */
const RULESET_READ = 'findRuleset';

/**
 * How a module announces that it is about a session
 *
 * **Every way a module can touch one**, not the handful the first draft listed. That version named
 * only the guards and `sessionIdFrom`, which `createSession` uses none of — so the one route that
 * unarguably reads a Ruleset slipped the scan entirely, and a future session route written in the
 * same shape would have too. A detector whose blind spot is *the module that does the thing* is
 * worse than no detector.
 */
const SESSION_MARKERS = [
  'sessionIdFrom(',
  'requireMember(',
  'requireDM(',
  'findGameSession(',
  'insertGameSession(',
  'listSessionsForAccount(',
  'updateSessionSnapshot(',
  'refreshSessionSnapshot(',
  'archiveGameSession(',
  'charactersInSession(',
];

/**
 * The two modules allowed to hold both, and why each is sanctioned rather than a leak
 *
 * - **`createSession`** is where the Snapshot is *taken*. Reading the Ruleset is the copy, which is
 *   the one moment D7 is about; afterwards the table never looks at it again.
 * - **`refreshSnapshot`** is v3 Req 37.3's explicit act — a DM deliberately pulling the ruleset's
 *   current state into a running game, guarded by `requireDM` **and** `requireOwner` and refused
 *   when a character would break.
 *
 * Both *write* a Snapshot from what they read. A third entry here would be a route that reads a
 * Ruleset to **answer** something, which is exactly what the requirement forbids.
 */
const ALLOWED = ['routes/sessions/createSession.ts', 'routes/sessions/refreshSnapshot.ts'];

/** A module's code with its comments stripped, so prose about the rule does not trip it */
function codeIn(path: string): string {
  return readFileSync(path, 'utf8').replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, '');
}

/** Every `.ts` under a directory, at any depth, tests and fixtures excluded */
function sourceFiles(directory: string): string[] {
  return readdirSync(directory).flatMap((name) => {
    const path = join(directory, name);
    if (statSync(path).isDirectory()) {
      return name === 'boundaryFixtures' || name === 'testing' ? [] : sourceFiles(path);
    }
    return name.endsWith('.ts') && !name.endsWith('.test.ts') ? [path] : [];
  });
}

/** Whether a module's code is about a game session at all */
function isAboutSessions(code: string): boolean {
  return SESSION_MARKERS.some((marker) => code.includes(marker));
}

/** Every module that is about a session *and* reads the live Ruleset table */
function sessionModulesReadingRulesets(): string[] {
  return sourceFiles(SERVER_ROOT)
    .map((path) => ({
      path: relative(SERVER_ROOT, path).replaceAll('\\', '/'),
      code: codeIn(path),
    }))
    .filter(({ code }) => isAboutSessions(code) && code.includes(RULESET_READ))
    .map(({ path }) => path);
}

describe('the detector', () => {
  it('catches a session route that reads the live ruleset', () => {
    const leak = `
      export const readSession = defineHandler((context) => {
        const membership = requireMember(context, sessionIdFrom(context.url));
        return findRuleset(row.rulesetId);
      });
    `;

    expect(isAboutSessions(leak) && leak.includes(RULESET_READ)).toBe(true);
  });

  it('leaves a session route that reads only its Snapshot alone', () => {
    const clean = `
      export const readSession = defineHandler((context) => {
        requireMember(context, sessionIdFrom(context.url));
        return snapshotOf(findGameSession(sessionId));
      });
    `;

    expect(clean.includes(RULESET_READ)).toBe(false);
  });

  it('leaves a ruleset route alone, which reads rulesets by definition', () => {
    const ruleset = `
      export const getRuleset = defineHandler((context) =>
        requireOwner(context, findRuleset(rulesetIdFrom(context.url))));
    `;

    expect(isAboutSessions(ruleset)).toBe(false);
  });

  it('sees a session route that names no guard and no id reader', () => {
    // The hole the first draft of this file had: `createSession` uses none of the guards or
    // `sessionIdFrom`, so a marker list built from those alone missed the one route that most
    // obviously reads a Ruleset
    const creating = `
      export const createSession = defineHandler(async (context) => {
        const source = requireOwner(context, findRuleset(rulesetIdFrom(body)));
        return insertGameSession({ snapshot: serializeConfiguration(copy) });
      });
    `;

    expect(isAboutSessions(creating)).toBe(true);
  });

  it('is not fooled by a comment about the rule', () => {
    // The neighbours' docblocks say "findRuleset" while explaining why they do not call it
    const commented = `
      // Nothing here calls findRuleset — the rules are the Snapshot's (D7)
      export const readSession = defineHandler((context) => {
        requireMember(context, sessionIdFrom(context.url));
      });
    `;

    expect(codeInText(commented).includes(RULESET_READ)).toBe(false);
  });
});

/** The comment stripper, applied to a literal rather than a file */
function codeInText(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, '');
}

describe('the real server', () => {
  it('has session modules to walk, so this is not passing by looking at nothing', () => {
    const anySessionModule = sourceFiles(SERVER_ROOT).filter((path) =>
      isAboutSessions(codeIn(path))
    );

    expect(anySessionModule.length).toBeGreaterThan(0);
  });

  it('evaluates a session against its Snapshot rather than the live Ruleset (D7)', () => {
    expect(sessionModulesReadingRulesets()).toEqual(ALLOWED);
  });
});
