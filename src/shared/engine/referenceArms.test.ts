/**
 * An arm of `findReferences` is filled while a persisted shape points at its kind
 *
 * TICKET-INL-01 shipped the `inlay` target kind returning nothing **deliberately** — nothing in the
 * model could point at a gem family yet, and a guard with no possible referrer can never fire. That
 * is the same thing TICKET-ROLL-03 did with `dice-ladder`, and ROLL-05 filled it the moment a roll
 * definition could name one. TICKET-SPL-01 has just done it a third time with `spell`.
 *
 * The hole is that **nothing would catch leaving one empty.** The dispatcher is exhaustive over
 * *kinds* — a `Record<ReferenceTargetKind, walker>` since TICKET-SPL-01, a `switch` with a `never`
 * default before it — and both catch a *missing kind* while saying nothing at all about a *new
 * referrer to an existing kind*: adding `inlayId` to the composed record while the `inlay` arm still
 * returned nothing would compile, pass the suite, and let a User delete Diamond out from under every
 * axe socketed with it — silently emptying sockets across the roster.
 *
 * So this is the check TICKET-INL-01 asked for, built the way
 * [`client/components/config/races/challengeRate.test.ts`](../../client/components/config/races/challengeRate.test.ts)
 * builds its equivalent: a **scan of `src/` source text**, run every time the suite runs, asserting
 * the implication rather than either half of it. *If* a persisted shape names the field, *then* the
 * arm has to do something with it.
 *
 * The scan is over text rather than over imports for `routeGuards.test.ts`' reason: the obligation is
 * about a *reader*, and a module can read a property of a value it was handed without importing
 * anything. Reading the arm out of the source rather than calling `findReferences` is deliberate too
 * — a behavioural test proves the arm works for the fixture it was given, and this proves the arm was
 * *written at all*, which is the failure being guarded against.
 *
 * **It was `inlayReferenceArm.test.ts` until TICKET-SPL-01**, which gave it a second row and made the
 * old name a lie. The mechanism moved with the dispatcher: an arm is a named function now rather than
 * a `case` body, so the scan reads the walker table for the kind's function and then that function's
 * body.
 *
 * **TICKET-SPL-02 is the first time a row here has actually fired.** `Character.learnedSpellIds`
 * landed and this file went red on the same run, before the `spell` arm had been written — which is
 * the whole point of writing a row against a field that does not exist yet.
 */

import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const HERE = dirname(fileURLToPath(import.meta.url));

/** Where the persisted shapes live — the only place a pointer at a config entity can be declared */
const TYPES_DIR = resolve(HERE, '../types');

/** The walker under inspection */
const DEPENDENCIES = resolve(HERE, 'dependencies.ts');

/**
 * Each arm that owes an answer, and the field that makes it owe one
 *
 * `live` says whether a persisted shape names the field **today**. It is asserted separately from
 * the implication, so that *removing* a socket is a deliberate edit here rather than a quiet
 * loosening of the implication into something that passes vacuously.
 */
const ARMS = [
  {
    kind: 'inlay',
    field: 'inlayId',
    /** `ComposedItem` sockets a gem family by id (TICKET-INV-05) */
    live: true,
  },
  {
    kind: 'spell',
    field: 'learnedSpellIds',
    /**
     * `Character.learnedSpellIds` names a spell by id (TICKET-SPL-02).
     *
     * **The row did its job**, which is worth recording because it is the first time one of these
     * has. It was written vacuous by SPL-01 against a field that did not exist yet, spelled out of
     * `docs/v4.0_sheet_parity/systems/13-spells.md`; SPL-02 added the field, and this file failed on
     * the very run that added it — *expected true to be false* — before the arm was filled in. That
     * is the whole design: a scan cannot notice a rename, so the guard depends on the field arriving
     * under the spelling written here, and it did.
     */
    live: true,
  },
] as const;

/**
 * The name of the function the walker table maps a kind to
 *
 * @param source - `dependencies.ts` as written
 * @param kind - The target kind whose arm to look up
 * @returns The function's name, or an empty string when the table has no such row
 */
function walkerName(source: string, kind: string): string {
  const row = new RegExp(`^\\s*'?${kind}'?:\\s*(\\w+),`, 'm');
  const match = source.match(row);

  return match?.[1] ?? '';
}

/**
 * The body of one arm's function, up to its closing brace
 *
 * A crude slice rather than a parse, and deliberately so: the thing being asserted is that somebody
 * wrote *something* in that arm about the field, which is a question about the text.
 *
 * @param source - `dependencies.ts` as written
 * @param kind - The target kind whose arm to read
 * @returns The arm's body, or an empty string when there is no such arm
 */
function armBody(source: string, kind: string): string {
  const name = walkerName(source, kind);
  if (name === '') return '';

  const start = source.indexOf(`function ${name}(`);
  if (start === -1) return '';

  const rest = source.slice(start);
  const ends = rest.indexOf('\n}');

  return ends === -1 ? rest : rest.slice(0, ends);
}

describe('the arms of findReferences', () => {
  const walker = readFileSync(DEPENDENCIES, 'utf8');
  const character = readFileSync(join(TYPES_DIR, 'character.ts'), 'utf8');
  const config = readFileSync(join(TYPES_DIR, 'config.ts'), 'utf8');

  it('scans a corpus big enough for the answer to mean something', () => {
    // The failure this guards against is the scan reading the wrong files and finding nothing — an
    // unfalsifiable green box. `findReferences` and `ComposedItem` are what the cases below are about.
    expect(walker).toContain('export function findReferences');
    expect(character).toContain('export interface ComposedItem');
  });

  it('maps every kind it checks to a function that exists', () => {
    // The scan's own premise: a renamed arm, or a table row spelled differently, would otherwise
    // make every case below pass by reading an empty string
    for (const { kind } of ARMS) {
      const name = walkerName(walker, kind);
      const body = armBody(walker, kind);

      expect(name, kind).not.toBe('');
      expect(body, kind).not.toBe('');
    }
  });

  it.each(ARMS)('is not left empty while a persisted shape names $field', ({ kind, field }) => {
    // The implication, in one line. While nothing names the field it passes vacuously, which is the
    // state INL-01 shipped `inlay` in and SPL-01 shipped `spell` in; the moment `Character`,
    // `ComposedItem` or anything else in `shared/types/` names one, the arm has to answer for it —
    // and both rows are past that point now, so both are load-bearing rather than waiting.
    const names = character.includes(field) || config.includes(field);
    const answers = armBody(walker, kind).includes(field);

    expect(names && !answers, kind).toBe(false);
  });

  it.each(ARMS)('records whether $field is pointed at yet', ({ field, live }) => {
    // Stated as the state the tree is actually in, so that adding or removing a pointer is a
    // deliberate edit here rather than a silent change in what the implication above proves
    const names = character.includes(field) || config.includes(field);

    expect(names).toBe(live);
  });
});
