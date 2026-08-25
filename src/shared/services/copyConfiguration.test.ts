/**
 * A copy that shares nothing (TICKET-RUL-03)
 *
 * **The independence is asserted structurally, not by spot-checking three fields.** That is the
 * ticket's second criterion and it is the right instinct: a shallow copy passes every
 * name-and-timestamp check anybody would think to write, and shares `curve.rows[].values`,
 * `statWeights`, `statValues` and `dieSizes` by reference — so retuning the copy retunes the
 * original, and nobody finds out until a table plays it. So the test **walks both documents at
 * once** and fails on any object reached by the same path in both that is the same object.
 *
 * Run against the real Ducklets corpus, because a two-stat fixture has almost none of the nesting
 * that makes this hard.
 *
 * **Validates: v3 Req 34.1, 34.2, 34.3**
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { constantsNamespace } from '../engine/formula/constants';
import { evaluateFormulaString } from '../engine/formula/evaluator';
import type { Configuration, Stat } from '../types/config';
import { copyConfiguration, copyName } from './copyConfiguration';

const CORPUS = join(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
  '..',
  'docs',
  'imports',
  'ducklets.json'
);

/** The real ruleset the sheet produced — fresh each call, since these tests mutate */
function corpus(): Configuration {
  return JSON.parse(readFileSync(CORPUS, 'utf8')) as Configuration;
}

/**
 * Every path at which two documents hold the *same* object
 *
 * Walks both in step. A primitive is ignored; two objects are compared by identity and then
 * descended into. What comes back should be empty — anything in it is a place where editing the
 * copy edits the source.
 */
function sharedPaths(a: unknown, b: unknown, path = '$'): string[] {
  if (a === null || b === null || typeof a !== 'object' || typeof b !== 'object') return [];
  if (a === b) return [path];

  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);

  return [...keys].flatMap((key) =>
    sharedPaths(
      (a as Record<string, unknown>)[key],
      (b as Record<string, unknown>)[key],
      `${path}.${key}`
    )
  );
}

describe('copyConfiguration', () => {
  it('shares no object with the source, anywhere in the document', () => {
    const source = corpus();

    expect(sharedPaths(source, copyConfiguration(source))).toEqual([]);
  });

  it('is deep-equal to the source except for id, name and the timestamps', () => {
    const source = corpus();
    const copy = copyConfiguration(source, { name: 'Elsewhere' });

    // Compared against the *whole* source with the four expected differences spliced in, rather
    // than by listing what should match — so a field the copy silently drops fails this
    expect(copy).toEqual({
      ...source,
      id: copy.id,
      name: 'Elsewhere',
      createdAt: copy.createdAt,
      updatedAt: copy.updatedAt,
    });

    // …and those four really are different, which the splice above cannot say on its own
    expect(copy.id).not.toBe(source.id);
    expect(copy.createdAt).not.toBe(source.createdAt);
    // A copy is created and last saved at the same moment: it has no history of its own yet
    expect(copy.createdAt).toBe(copy.updatedAt);
  });

  it('leaves the source untouched when the copy is mutated', () => {
    // The failure a shallow copy produces, stated as the User would meet it: retune the copy, and
    // the ruleset your table is playing on Thursday quietly changes too (v3 Req 34.3)
    const source = corpus();
    const before = JSON.stringify(source);
    const copy = copyConfiguration(source);

    // One of each kind of nesting a shallow copy would have shared: an entity, a record in an
    // optional array, a row inside a table inside an entity, and an array of primitives
    copy.stats[0].name = 'Rebalanced';

    const firstConstant = copy.constants?.[0];
    if (firstConstant) firstConstant.value = 999;

    const firstCurve = copy.curves?.[0];
    if (firstCurve) firstCurve.rows[0].values[0] = 12345;

    copy.diceLadders?.[0]?.dieSizes.push(4);

    expect(JSON.stringify(source)).toBe(before);
  });

  it('keeps entity ids, so a formula in the copy still resolves', () => {
    // Regenerating them would mean rewriting every id-resolved reference, every `statValues` key
    // and every material modifier — `references.ts` again, for nothing: an entity id only has to be
    // unique *within* a document
    const source = corpus();
    const copy = copyConfiguration(source);

    expect(copy.stats.map((stat: Stat) => stat.id)).toEqual(source.stats.map((stat) => stat.id));
  });

  it('evaluates a formula in the copy to the same number as in the source', () => {
    // The corpus's one stat formula: `APT` reads `max(1, round(SPEED / const.apt_value))`
    const source = corpus();
    const copy = copyConfiguration(source);

    const formulaOf = (config: Configuration) =>
      config.stats.find((stat) => stat.abbreviation === 'APT')?.formula ?? '';
    const evaluate = (config: Configuration) =>
      evaluateFormulaString(formulaOf(config), {
        variables: { SPEED: 60 },
        namespaces: { const: constantsNamespace(config.constants) },
      });

    expect(formulaOf(copy)).toBe(formulaOf(source));
    // A number, not an error — the copy's formula still finds the constant it names
    expect(evaluate(source)).toBe(2);
    expect(evaluate(copy)).toBe(evaluate(source));
  });

  it('gives the copy its own ruleset id', () => {
    // The one identity that leaves the document: `POST /api/rulesets` stores it as the row's key,
    // so two rulesets sharing it would be one row
    const source = corpus();

    expect(copyConfiguration(source).id).not.toBe(source.id);
  });

  it('names the copy visibly as a derivative', () => {
    // The list is how a User tells two rulesets apart, so silently reusing the name is wrong
    expect(copyName('Ducklets')).toBe('Ducklets (copy)');
    expect(copyConfiguration(corpus()).name).toBe(copyName(corpus().name));
  });
});
