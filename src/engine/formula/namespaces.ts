/**
 * Namespace Resolvers for an Attachment Point
 *
 * The evaluation-time half of `scoping.ts`. That module says which namespaces a formula *may*
 * name; this builds the resolvers for exactly those, so what a formula can reference and what it
 * can resolve come from one table rather than two that drift apart.
 *
 * A namespace in scope with no resolver yet — `stats` and `skills`, until TICKET-STAT-01 —
 * is simply absent, which the evaluator reports as `Unknown namespace`. That is the honest
 * answer while the entity does not exist, and it is what those references already did.
 *
 * **Validates: Concept 00 §5; Concepts 05, 06; spec §5.1**
 */

import type { Configuration } from '../../types/config';
import type { NamespaceResolver } from '../../types/formula';
import { constantsNamespace } from './constants';
import { curvesNamespace } from './curves';
import type { FormulaNamespace, FormulaOwner } from './scoping';
import { NAMESPACE_SCOPES } from './scoping';

/** Just enough of a configuration to build resolvers from — everything a resolver reads */
export type NamespaceSource = Pick<Configuration, 'constants' | 'curves'>;

/**
 * How each resolvable namespace is built. A namespace missing here has no resolver yet.
 */
const RESOLVER_BUILDERS: Partial<
  Record<FormulaNamespace, (source: NamespaceSource) => NamespaceResolver>
> = {
  const: (source) => constantsNamespace(source.constants),
  curve: (source) => curvesNamespace(source.curves),
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
    const build = RESOLVER_BUILDERS[namespace];
    if (build) namespaces[namespace] = build(source);
  }

  return namespaces;
}
