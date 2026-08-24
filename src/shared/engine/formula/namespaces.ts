/**
 * Namespace Resolvers for an Attachment Point
 *
 * The evaluation-time half of `scoping.ts`. That module says which namespaces a formula *may*
 * name; this builds the resolvers for exactly those, so what a formula can reference and what it
 * can resolve come from one table rather than two that drift apart.
 *
 * A namespace in scope with no resolver is simply absent, which the evaluator reports as
 * `Unknown namespace`. `stats` and `skills` both have one, but only when the caller supplies
 * computed values: a configuration alone says which stats and skills *exist*, not what they are
 * worth on a given character, and answering from the first without the second would be a
 * confident wrong number.
 *
 * **Validates: Concept 00 §5; Concepts 05, 06; spec §5.1**
 */

import type { Configuration } from '../../types/config';
import type { FormulaResult, NamespaceResolver } from '../../types/formula';
import { constantsNamespace } from './constants';
import { curvesNamespace } from './curves';
import type { FormulaNamespace, FormulaOwner } from './scoping';
import { NAMESPACE_SCOPES } from './scoping';
import { skillsNamespace } from './skills';
import { statsNamespace } from './stats';

/**
 * Just enough of a configuration to build resolvers from — everything a resolver reads
 *
 * `statValues` is the one part that does not come from the ruleset: a stat's worth is a property
 * of a character. Omit it and the `stats` namespace has no resolver at all, which is the right
 * answer for a caller with no character in hand (a curve generator, an import-time check).
 */
export type NamespaceSource = Pick<Configuration, 'constants' | 'curves'> &
  Partial<Pick<Configuration, 'stats' | 'skills'>> & {
    statValues?: Record<string, FormulaResult>;
    skillLevels?: Record<string, FormulaResult>;
    skillBonuses?: Record<string, FormulaResult>;
  };

/**
 * How each resolvable namespace is built. A namespace missing here has no resolver yet.
 */
const RESOLVER_BUILDERS: Partial<
  Record<FormulaNamespace, (source: NamespaceSource) => NamespaceResolver | undefined>
> = {
  const: (source) => constantsNamespace(source.constants),
  curve: (source) => curvesNamespace(source.curves),
  stats: (source) =>
    source.statValues === undefined
      ? undefined
      : statsNamespace(source.stats ?? [], source.statValues),
  skills: (source) =>
    source.skillLevels === undefined
      ? undefined
      : skillsNamespace(source.skills ?? [], source.skillLevels, source.skillBonuses ?? {}),
};

/**
 * Build the namespace resolvers a formula at `owner` can use
 *
 * @param source - The configuration the formula lives in
 * @param owner - Where the formula is attached, which decides what it may see
 * @returns The resolvers, ready for `FormulaContext.namespaces`
 */
export function namespacesFor(
  source: NamespaceSource,
  owner: FormulaOwner
): Record<string, NamespaceResolver> {
  const namespaces: Record<string, NamespaceResolver> = {};

  for (const namespace of NAMESPACE_SCOPES[owner]) {
    const resolver = RESOLVER_BUILDERS[namespace]?.(source);
    if (resolver) namespaces[namespace] = resolver;
  }

  return namespaces;
}
