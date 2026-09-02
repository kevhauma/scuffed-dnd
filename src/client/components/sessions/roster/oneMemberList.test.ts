/**
 * There is exactly one member list in the application (TICKET-DM-04, v3 Req 49.8)
 *
 * The ticket's eighth criterion, and it is a criterion because *add a new page* is the path of least
 * resistance and leaves a DM with two member lists that disagree — about who is present, about whose
 * character is whose. A DM acts on this surface without checking it, so the second list is not a
 * tidiness problem: it is a DM taking 7 off somebody who left the table four minutes ago.
 *
 * ## Why a scan rather than a note on the ticket
 *
 * Because the failure is a *future* one. GAM-04's `SessionLobby` and CHAR-04's `SessionCharacters`
 * are deleted, so the tree passes today by construction; what this asserts is that the next surface
 * that wants to show who is at a table has to come through `roster/`. A paragraph saying so would be
 * read by whoever was already going to do the right thing.
 *
 * ## What it actually looks for
 *
 * Two things, and neither is a name:
 *
 * - **Nothing outside `roster/` names `SessionMemberListing` or `SessionMemberSummary`.** Those are
 *   the wire types the list arrives as, and a module that holds it is a module that will draw it.
 *   `useSessionMembers.ts` is the read itself and is excluded by name — it is *the* reader, which is
 *   the property rather than a violation of it.
 *
 *   **The route path is deliberately not one of the patterns.** A first version also grepped for
 *   `/members` and went red on `characterStore.ts`, which names the route in a **comment** explaining
 *   why `tableCharacterOwnerId` exists *instead of* asking it — the exact opposite of a second member
 *   list. The types are the honest signal: a listing a module cannot type is a listing it cannot
 *   render.
 * - **The two retired components are gone rather than orphaned.** A file nobody imports still renders
 *   a member list the moment somebody imports it, and `fallow dead-code` reports it as a suggestion
 *   where this reports it as a failure.
 *
 * `referenceArms.test.ts`' lesson applies: a test that greps source is coupled to the source's
 * punctuation, so this greps for the fewest distinctive tokens that can carry the meaning.
 *
 * **Validates: v3 Req 39.7, 49.8**
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const MODULE_URL = fileURLToPath(import.meta.url);
const HERE = dirname(MODULE_URL);
const CLIENT_ROOT = resolve(HERE, '../../..');
const ROSTER = resolve(HERE);

/**
 * The one module allowed to hold the listing outside `roster/`
 *
 * It is the read — `GET /api/sessions/:id/members` — and the roster composes it. *One list* is a
 * claim about surfaces that draw one, not about there being a single way to fetch it.
 */
const THE_READER = resolve(CLIENT_ROOT, 'components/sessions/useSessionMembers.ts');

/** The two surfaces TICKET-DM-04 retired, which must be gone rather than merely unused */
const RETIRED = [
  'components/sessions/SessionLobby.tsx',
  'components/sessions/SessionCharacters.tsx',
];

/**
 * How a module comes to hold the table's membership
 *
 * The wire type, the summary it is made of, **and the hook that reads them**. The third pattern is
 * the one that makes this check mean what its name says, and it was added after review found the
 * first two catch only a surface that names a *type*. TypeScript infers the element type of a
 * `.map`, so the shortest path to a second lobby —
 *
 * ```ts
 * const { members } = useSessionMembers(id);
 * members.map((member) => <li>{member.name}</li>);
 * ```
 *
 * — names neither wire type and sailed straight past the original pair. `useSessionMembers` is the
 * one thing such a surface cannot avoid importing, which is why it is both {@link THE_READER}'s
 * exemption and a pattern here: today `roster/useSessionRoster.ts` is its only consumer, so the
 * check is green, and the next consumer is the one this test exists to stop.
 *
 * **The third pattern matches the call, not the name and not the import.** Two earlier spellings
 * were wrong in opposite directions. A bare `\buseSessionMembers\b` matches the two docblocks that
 * *discuss* the hook — `useSessionsManager` explaining what DM-04 folded into one, and
 * `useSessionResource` listing the three hooks it generalised — and a scan that fails on prose
 * teaches people to stop writing prose. Matching the import path instead leaks through
 * `sessions/index.ts`, which re-exports the hook, so a consumer importing from the barrel would be
 * invisible. Calling it is the thing no consumer can avoid and no comment can do.
 */
const HOLDS_THE_LIST = [/SessionMemberListing/, /SessionMemberSummary/, /useSessionMembers\(/];

/** Whether one module's source has the table's membership in its hands */
function holdsTheList(source: string): boolean {
  return HOLDS_THE_LIST.some((pattern) => pattern.test(source));
}

/** Every TypeScript module under a directory */
function modulesUnder(directory: string): string[] {
  const entries = readdirSync(directory);

  return entries.flatMap((entry) => {
    const path = join(directory, entry);
    const stats = statSync(path);

    if (stats.isDirectory()) return modulesUnder(path);
    if (!/\.tsx?$/.test(entry)) return [];

    return [path];
  });
}

describe('exactly one member list', () => {
  it('is held nowhere in the client but the roster and the read behind it', () => {
    const modules = modulesUnder(CLIENT_ROOT);

    const offenders = modules.filter((path) => {
      if (path.startsWith(ROSTER)) return false;
      if (path === THE_READER) return false;
      if (path.endsWith('.test.ts') || path.endsWith('.test.tsx')) return false;

      const source = readFileSync(path, 'utf8');

      return holdsTheList(source);
    });

    const named = offenders.map((path) => relative(CLIENT_ROOT, path));

    expect(named).toEqual([]);
  });

  it('cannot pass by scanning nothing', () => {
    // The scan walks the whole client tree, so a broken walk would report no offenders and look
    // like a pass. This is the equality that makes the one above mean something.
    const modules = modulesUnder(CLIENT_ROOT);

    expect(modules.length).toBeGreaterThan(200);
  });

  it('catches a second lobby that names no wire type at all', () => {
    // The shape review found the original pair missing, and the shortest path to the failure this
    // check is named for: destructure the hook, map the rows, let TypeScript infer the element
    // type. It mentions neither `SessionMemberListing` nor `SessionMemberSummary`.
    const inferred = [
      "import { useSessionMembers } from '../useSessionMembers';",
      'export function SecondLobby({ id }: { id: string }) {',
      '  const { members } = useSessionMembers(id);',
      '  return <ul>{members.map((member) => <li key={member.accountId}>{member.name}</li>)}</ul>;',
      '}',
    ].join('\n');

    const caught = holdsTheList(inferred);

    expect(caught).toBe(true);
  });

  it('is not satisfied by any mention of a table, so it can still fail', () => {
    // The other direction: a module that talks about sessions without holding the membership is
    // not an offender, or the check above would be an assertion that no client module exists.
    const innocent = [
      "import { useSessionRolls } from '../useSessionRolls';",
      'export function RollCount({ id }: { id: string }) {',
      '  const { rolls } = useSessionRolls(id);',
      '  return <p>{rolls.length}</p>;',
      '}',
    ].join('\n');

    const caught = holdsTheList(innocent);

    expect(caught).toBe(false);
  });

  it('is not tripped by a docblock that only talks about the hook', () => {
    // `useSessionsManager` and `useSessionResource` both name it in prose, and a check that failed
    // on those would be a check that punishes explaining yourself.
    const prose = [
      '/**',
      ' * TICKET-DM-04 folded two of the composed hooks into one: `useSessionMembers` and',
      ' * `useSessionCharacters` are still the reads, but one surface needs them together.',
      ' */',
      'export function useSessionsManager() {}',
    ].join('\n');

    const caught = holdsTheList(prose);

    expect(caught).toBe(false);
  });

  it('really does read the list somewhere, so the exclusion is not hiding an absence', () => {
    const source = readFileSync(THE_READER, 'utf8');

    expect(source).toContain('SessionMemberListing');
  });

  it('has no orphaned copy of either retired surface', () => {
    // A file nobody imports still renders a member list the moment somebody imports it
    const surviving = RETIRED.filter((relativePath) => {
      const path = resolve(CLIENT_ROOT, relativePath);

      try {
        statSync(path);
        return true;
      } catch {
        return false;
      }
    });

    expect(surviving).toEqual([]);
  });
});
