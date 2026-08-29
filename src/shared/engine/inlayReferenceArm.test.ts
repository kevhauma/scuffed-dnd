/**
 * The `inlay` arm of `findReferences` is filled while anything sockets a gem (TICKET-INV-05)
 *
 * TICKET-INL-01 shipped the `inlay` target kind returning `[]` **deliberately** — nothing in the
 * model could point at a gem family yet, and a guard with no possible referrer can never fire. That
 * is the same thing TICKET-ROLL-03 did with `dice-ladder`, and ROLL-05 filled it the moment a roll
 * definition could name one.
 *
 * The hole is that **nothing would have caught leaving it empty.** `findReferences`' `switch` ends in
 * a `never` exhaustiveness check, which catches a *missing kind* and says nothing at all about a *new
 * referrer to an existing kind*: adding `inlayId` to the composed record while `case 'inlay'` still
 * read `return []` would compile, pass the suite, and let a User delete Diamond out from under every
 * axe socketed with it — silently emptying sockets across the roster.
 *
 * So this is the check the ticket asked for, built the way
 * [`client/components/config/races/challengeRate.test.ts`](../../client/components/config/races/challengeRate.test.ts)
 * builds its equivalent: a **scan of `src/` source text**, run every time the suite runs, asserting
 * the implication rather than either half of it. *If* a persisted shape names an `inlayId`, *then*
 * the arm has to do something with it.
 *
 * The scan is over text rather than over imports for `routeGuards.test.ts`' reason: the obligation is
 * about a *reader*, and a module can read a property of a value it was handed without importing
 * anything. Reading the arm out of the source rather than calling `findReferences` is deliberate too
 * — a behavioural test proves the arm works for the fixture it was given, and this proves the arm was
 * *written at all*, which is the failure being guarded against.
 */

import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const HERE = dirname(fileURLToPath(import.meta.url));

/** Where the persisted shapes live — the only place a socket can be declared */
const TYPES_DIR = resolve(HERE, '../types');

/** The walker under inspection */
const DEPENDENCIES = resolve(HERE, 'dependencies.ts');

/** The field that makes the arm owe an answer */
const SOCKET_FIELD = 'inlayId';

/**
 * The body of one `case '<kind>':` arm, up to the next `case` or the `default`
 *
 * A crude slice rather than a parse, and deliberately so: the thing being asserted is that somebody
 * wrote *something* in that arm about the socket, which is a question about the text.
 *
 * @param source - `dependencies.ts` as written
 * @param kind - The target kind whose arm to read
 * @returns The arm's body, or an empty string when there is no such arm
 */
function armBody(source: string, kind: string): string {
  const start = source.indexOf(`case '${kind}':`);
  if (start === -1) return '';

  const rest = source.slice(start + `case '${kind}':`.length);
  const nextCase = rest.indexOf('\n    case ');
  const fallback = rest.indexOf('\n    default');
  const ends = [nextCase, fallback].filter((at) => at !== -1);

  return ends.length === 0 ? rest : rest.slice(0, Math.min(...ends));
}

describe('the inlay arm of findReferences', () => {
  const walker = readFileSync(DEPENDENCIES, 'utf8');
  const character = readFileSync(join(TYPES_DIR, 'character.ts'), 'utf8');
  const config = readFileSync(join(TYPES_DIR, 'config.ts'), 'utf8');

  const socketed = character.includes(SOCKET_FIELD) || config.includes(SOCKET_FIELD);

  it('scans a corpus big enough for the answer to mean something', () => {
    // The failure this guards against is the scan reading the wrong files and finding nothing — an
    // unfalsifiable green box. `findReferences` and `ComposedItem` are what the cases below are about.
    expect(walker).toContain('export function findReferences');
    expect(character).toContain('export interface ComposedItem');
  });

  it('is not left empty while a persisted shape names an inlayId', () => {
    // The implication, in one line. If nothing sockets a gem this passes vacuously, which is the
    // state TICKET-INL-01 shipped in; the moment `ComposedItem` (or an `Item`, or anything else in
    // `shared/types/`) names one, the arm has to answer for it.
    const arm = armBody(walker, 'inlay');
    const answers = arm.includes(SOCKET_FIELD);

    expect(socketed && !answers).toBe(false);
  });

  it('names the socket rather than returning an empty list', () => {
    // The same rule stated as the state the tree is actually in, so a *removal* of the socket is a
    // deliberate edit here rather than a quiet loosening of the case above
    expect(socketed).toBe(true);
    expect(armBody(walker, 'inlay')).toContain(SOCKET_FIELD);
  });
});
