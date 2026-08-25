/**
 * Which routes need an Account, enumerated against the real route tree (TICKET-AUTH-03)
 *
 * v3 Req 32.6 has two halves and this file is about the second one. That `/account` is protected is
 * a one-line assertion; that **every other route is open to a signed-out visitor** is the half that
 * protects D6, and it can only be checked by listing what actually exists rather than by trusting a
 * list somebody maintains.
 *
 * So the tree is read out of `routeTree.gen.ts` — the generated file, which is the tree — and every
 * path in it is either in `PROTECTED_ROUTES` or open. A route added next month is open by default
 * and this test says so without being edited; a route added *and* protected without anyone
 * intending it fails here.
 *
 * **Validates: v3 Req 32.6**
 */

import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { isProtectedRoute, PROTECTED_ROUTES } from './protectedRoutes';

const CLIENT_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const ROUTE_TREE = resolve(CLIENT_ROOT, 'routeTree.gen.ts');
const ROUTES_DIR = resolve(CLIENT_ROOT, 'routes');

/**
 * Every route the generator emitted, from its own `fullPaths` union
 *
 * Read from the file rather than from a built router: the generated tree is the source of truth
 * for what routes exist, and booting a router here would make this test depend on the plugin
 * `vitest.config.ts` deliberately omits.
 */
function everyRoute(): string[] {
  const source = readFileSync(ROUTE_TREE, 'utf8');
  const block = /fullPaths:\s*((?:\s*\|\s*'[^']*')+)/.exec(source)?.[1] ?? '';

  return [...block.matchAll(/'([^']*)'/g)].map((match) => match[1] as string);
}

/** The local-mode surfaces D6 promises a signed-out visitor, named so a rename is a failure */
const LOCAL_MODE_ROUTES = [
  '/',
  // Configuration mode's entry point since TICKET-RUL-01, and **deliberately open**: signed out it
  // shows the browser's own ruleset and opens it for editing, with no redirect and no sign-in wall
  // (v3 Req 36.1). A future ticket protecting it would break local mode for every visitor, and
  // would fail here rather than in somebody's browser.
  '/rulesets',
  '/config/',
  '/config/skills',
  '/config/stats',
  '/config/materials',
  '/config/items',
  '/config/equipment',
  '/config/races',
  '/config/archetypes',
  '/config/rolls',
  '/config/currency',
  '/config/constants',
  '/config/curves',
  '/play/',
  '/play/create',
  '/play/character/$id',
];

describe('the route tree', () => {
  it('is readable, so nothing below passes by enumerating an empty list', () => {
    expect(everyRoute().length).toBeGreaterThan(15);
  });

  it('leaves every route open except the ones explicitly listed (v3 Req 32.6)', () => {
    const protectedPaths = everyRoute().filter(isProtectedRoute).sort();

    // Not "the list is short" — "the list is *this*". A future route that quietly became protected
    // shows up here as a path nobody put in `PROTECTED_ROUTES`. Both sides sorted, because the
    // route tree's order is the generator's and the list's is ours, and neither is the assertion.
    expect(protectedPaths).toEqual([...PROTECTED_ROUTES].sort());
  });

  it('leaves every local-mode route open to a signed-out visitor (D6)', () => {
    for (const route of LOCAL_MODE_ROUTES) {
      expect(isProtectedRoute(route), route).toBe(false);
    }
  });

  it('still contains every local-mode route it is asserting about', () => {
    // Without this the loop above passes when a route is *deleted*, which is the wrong kind of green
    const tree = everyRoute();

    for (const route of LOCAL_MODE_ROUTES) {
      expect(tree, route).toContain(route);
    }
  });

  it('protects the account page', () => {
    expect(isProtectedRoute('/account')).toBe(true);
  });

  it('has a route module wrapping each listed route in RequireAccount', () => {
    // **The list is a claim; this is what makes it true.** `PROTECTED_ROUTES` has no runtime
    // consumer — protection is delivered by each route composing `RequireAccount` — so without this
    // the day GAM-01 adds `/sessions` to the list and forgets the wrapper, every test still passes
    // and a file in the repo asserts a wide-open route is protected. Source-walked for the same
    // reason `routes/routeGuards.test.ts` walks the server: the obligation is a *call site*.
    for (const route of PROTECTED_ROUTES) {
      const source = readFileSync(resolve(ROUTES_DIR, `${route.replace(/^\//, '')}.tsx`), 'utf8');

      expect(source, route).toContain('<RequireAccount>');
    }
  });
});

describe('isProtectedRoute', () => {
  it('covers a protected route’s children', () => {
    // A prefix rather than an exact path, so `/sessions/abc/roster` needs no line of its own
    expect(isProtectedRoute('/account/sessions')).toBe(true);
  });

  it('stops at a path segment rather than at a character', () => {
    // `/accounts-payable` merely starts with the same letters and is somebody else's route
    expect(isProtectedRoute('/accounts-payable')).toBe(false);
  });

  it('leaves the sign-in surfaces open, which is what makes the redirect possible', () => {
    expect(isProtectedRoute('/signin')).toBe(false);
    expect(isProtectedRoute('/signup')).toBe(false);
  });
});
