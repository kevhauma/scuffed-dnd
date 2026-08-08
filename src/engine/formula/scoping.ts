/**
 * Formula Scoping
 *
 * Which references a formula may use, expressed as data rather than a branch per owner kind.
 * A formula's attachment point — where in the ruleset it is written — determines the namespaces
 * and legacy skill codes it can see (Concept 00 §5). Adding an attachment point means adding a
 * row here, not editing a `switch`.
 *
 * **Validates: Concept 00 §5; spec §5.1; Requirements 3.2, 4.3, 5.4 (legacy code scope, preserved)**
 */

import type { Configuration } from '../../types/config';
import { statMemberName } from './references';

/**
 * Where a formula is attached. One row of the scoping tables below.
 *
 * This milestone's slice of the Concept 00 §5 context table — the attachment points that exist
 * today. Later tickets add rows (constants-as-formulas, roll inputs); they do not add branches.
 */
export type FormulaOwner = 'stat' | 'speciality-skill' | 'combat-skill' | 'curve-generator';

/**
 * Every namespace the engine knows about, regardless of context.
 *
 * Naming these as a union rather than loose strings is deliberate: the three tables below
 * (`KNOWN_NAMESPACES`, `NAMESPACE_SCOPES`, `membersOf`) have to agree, and a typo in one of
 * them would otherwise degrade silently into "Unknown member" instead of failing loudly.
 */
export type FormulaNamespace = 'stats' | 'skills' | 'const' | 'curve';

/**
 * Every namespace the engine knows about, in declaration order.
 *
 * Used to tell "there is no such namespace" apart from "that namespace exists but is not
 * available here" — two different mistakes deserving two different messages.
 */
export const KNOWN_NAMESPACES: readonly FormulaNamespace[] = ['stats', 'skills', 'const', 'curve'];

/**
 * Whether a name written in a formula is a namespace the engine knows
 */
export function isKnownNamespace(name: string): name is FormulaNamespace {
  return (KNOWN_NAMESPACES as readonly string[]).includes(name);
}

/**
 * Namespaces available at each attachment point (Concept 00 §5, this milestone's slice)
 *
 * The spec's rows carry more namespaces than this — a character derived field also sees `self`,
 * `equipment`, `archetype`, and `race`. Those arrive with the concepts that define them; listing
 * them before they resolve would only produce formulas that save and then fail.
 *
 * Note that a stat may reach speciality skills through `skills.*` even though bare speciality
 * codes stay refused for stats (Requirement 3.2). That is intentional, not an oversight: the
 * legacy bare-code rules are frozen exactly as v1.0 left them until TICKET-STAT-01 retires them,
 * while the namespaced rules follow the spec's context table, which this milestone is moving
 * toward. The two syntaxes therefore disagree for one milestone, by design.
 */
export const NAMESPACE_SCOPES: Record<FormulaOwner, readonly FormulaNamespace[]> = {
  // Character derived field
  stat: ['stats', 'skills', 'const', 'curve'],
  // Skill level — the spec row is `stats`, `self`, `character`, `const`; `self` and `character`
  // aren't modelled yet
  'speciality-skill': ['stats', 'const'],
  // Roll input, on its way to becoming a roll definition (TICKET-ROLL-05)
  'combat-skill': ['stats', 'skills', 'const', 'curve'],
  // A curve column's generator (Concept 06): the row's key and the ruleset's tunables, nothing
  // else. Deliberately not `curve` — a table generated from another table is a cycle waiting to
  // happen, and no seed needs it (TICKET-CRV-02).
  'curve-generator': ['const'],
};

/**
 * Which legacy bare-code collections each attachment point may name
 *
 * Preserves the v1.0 rules exactly (Requirements 3.2, 4.3, 5.4) until TICKET-STAT-01 retires
 * bare codes: stats and speciality skills see main skill codes, combat skills also see
 * speciality codes.
 */
const LEGACY_CODE_SCOPES: Record<FormulaOwner, readonly ('main' | 'speciality')[]> = {
  stat: ['main'],
  'speciality-skill': ['main'],
  'combat-skill': ['main', 'speciality'],
  // A generator sees no skill at all — it fills a table, not a character (TICKET-CRV-02)
  'curve-generator': [],
};

/**
 * Bare names an attachment point supplies itself, rather than drawing from the configuration
 *
 * A curve generator runs once per row with that row's key bound, which the User writes as `key`
 * and the parser normalises to `KEY` like any other bare identifier. Kept as a table row so it
 * stays the same kind of thing as every other scope rule.
 */
const CONTEXT_CODES: Record<FormulaOwner, readonly string[]> = {
  stat: [],
  'speciality-skill': [],
  'combat-skill': [],
  'curve-generator': ['KEY'],
};

/**
 * What a formula at one attachment point is allowed to reference
 */
export interface FormulaScope {
  /** Legacy bare codes in scope */
  codes: ReadonlySet<string>;
  /** Namespaces in scope, each with the members it currently provides */
  namespaces: Partial<Record<FormulaNamespace, ReadonlySet<string>>>;
}

/**
 * The members each namespace currently provides, derived from the configuration
 *
 * Members are **display spellings**, because that is the form a formula is written and validated
 * in — `stats.max_health`, `skills.STL`. The stored form holds ids instead (TICKET-REF-01,
 * `references.ts`), which is why renaming a stat or a code changes what validates here without
 * changing what any formula points at.
 *
 * `curve` publishes curve **names** (TICKET-CRV-01). A curve's value column is a third segment
 * rather than a member, so which column a call names is checked at evaluation, where the curve
 * itself is in hand — the same place `skills.STL.level`'s property is checked.
 */
function membersOf(config: Configuration): Record<FormulaNamespace, ReadonlySet<string>> {
  return {
    stats: new Set(config.stats.map(statMemberName)),
    skills: new Set(config.specialitySkills.map((skill) => skill.code)),
    const: new Set((config.constants ?? []).map((constant) => constant.name)),
    curve: new Set((config.curves ?? []).map((curve) => curve.name)),
  };
}

/**
 * Build the scope for a formula attached at `owner`
 *
 * @param config - The configuration the formula lives in
 * @param owner - The attachment point
 * @returns The codes and namespaces the formula may reference
 */
export function scopeFor(config: Configuration, owner: FormulaOwner): FormulaScope {
  const members = membersOf(config);

  const codes = new Set<string>(CONTEXT_CODES[owner]);
  for (const source of LEGACY_CODE_SCOPES[owner]) {
    const collection = source === 'main' ? config.mainSkills : config.specialitySkills;
    for (const entry of collection) {
      codes.add(entry.code);
    }
  }

  // No `?? new Set()` fallback: `membersOf` returns every `FormulaNamespace`, so a row that
  // names one always finds it. A namespace missing here would be a type error, not an empty set.
  const namespaces: Partial<Record<FormulaNamespace, ReadonlySet<string>>> = {};
  for (const namespace of NAMESPACE_SCOPES[owner]) {
    namespaces[namespace] = members[namespace];
  }

  return { codes, namespaces };
}
