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
import { skillMemberName, statMemberName } from './references';

/**
 * Where a formula is attached. One row of the scoping tables below.
 *
 * This milestone's slice of the Concept 00 §5 context table — the attachment points that exist
 * today. Later tickets add rows (constants-as-formulas); they do not add branches. A row goes when
 * the thing it describes does — `combat-skill` left with the entity in TICKET-ROLL-06.
 */
export type FormulaOwner = 'stat' | 'curve-generator' | 'roll-input';

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
 * **There is no skill attachment point any more** (TICKET-SKL-02). A `Skill` carries weight rows
 * rather than a formula string, so nothing is attached to it for a scope to describe — which is
 * the entity's whole argument: the arithmetic lives once, in the calculator, and a rebalance is a
 * constant rather than 48 edits.
 */
export const NAMESPACE_SCOPES: Record<FormulaOwner, readonly FormulaNamespace[]> = {
  // Character derived field.
  //
  // **No `skills`** (CR-02), even though Concept 00 §5's row for this context lists it. Skills are
  // computed *from* the finished stat values (`calculator.ts` steps 2 and 3), so a stat reading a
  // skill is a cycle across the pipeline rather than a wiring gap — `calculateStatValues` builds
  // its namespaces without `skillLevels` and can never honour one. Leaving it in the row meant a
  // formula like `skills.melee.bonus + 1` validated, previewed with a real number, saved, and then
  // errored `Unknown namespace: skills` every time the sheet computed it. The same argument as the
  // paragraph above: a namespace that does not resolve here only produces formulas that save and
  // then fail. Restoring it means interleaving the two passes into one fixed point, which is a
  // design decision and wants a requirement first.
  stat: ['stats', 'const', 'curve'],
  // A curve column's generator (Concept 06): the row's key and the ruleset's tunables, nothing
  // else. Deliberately not `curve` — a table generated from another table is a cycle waiting to
  // happen, and no seed needs it (TICKET-CRV-02).
  'curve-generator': ['const'],
  // A roll's input expression (Concept 08, TICKET-ROLL-05): everything a character *is*, which is
  // the same set a derived stat sees — a roll is another reading of the character, not a different
  // kind of thing. `stats.dex + skills.dodging.bonus` is the shape Concept 08's editing scenarios
  // are written in.
  'roll-input': ['stats', 'skills', 'const', 'curve'],
};

/**
 * Which legacy bare-code collections each attachment point may name
 *
 * What is left of the v1.0 rules: every attachment point that sees anything sees **stat
 * abbreviations**, so a derived stat can be written either way — `STR * 10` or
 * `stats.strength * 10` — which is what the source sheet's formulas look like. The speciality half
 * retired with the code it named (TICKET-SKL-02), and the combat codes went with `CombatSkill`
 * (TICKET-ROLL-06) — so this space is stat abbreviations and nothing else.
 */
const LEGACY_CODE_SCOPES: Record<FormulaOwner, readonly 'stat'[]> = {
  stat: ['stat'],
  // A generator sees no skill at all — it fills a table, not a character (TICKET-CRV-02)
  'curve-generator': [],
  'roll-input': ['stat'],
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
  'curve-generator': ['KEY'],
  // A roll input is handed nothing of its own — everything it reads is the character (Concept 08)
  'roll-input': [],
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
 * in — `stats.max_health`, `skills.lock_picking`. The stored form holds ids instead (TICKET-REF-01,
 * `references.ts`), which is why renaming a stat or a code changes what validates here without
 * changing what any formula points at.
 *
 * `curve` publishes curve **names** (TICKET-CRV-01). A curve's value column is a third segment
 * rather than a member, so which column a call names is checked at evaluation, where the curve
 * itself is in hand — the same place a `skills.<name>.bonus` property is checked.
 */
function membersOf(config: Configuration): Record<FormulaNamespace, ReadonlySet<string>> {
  return {
    stats: new Set(config.stats.map(statMemberName)),
    skills: new Set(config.skills.map(skillMemberName)),
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
  if (LEGACY_CODE_SCOPES[owner].includes('stat')) {
    for (const stat of config.stats) codes.add(stat.abbreviation.toUpperCase());
  }

  // No `?? new Set()` fallback: `membersOf` returns every `FormulaNamespace`, so a row that
  // names one always finds it. A namespace missing here would be a type error, not an empty set.
  const namespaces: Partial<Record<FormulaNamespace, ReadonlySet<string>>> = {};
  for (const namespace of NAMESPACE_SCOPES[owner]) {
    namespaces[namespace] = members[namespace];
  }

  return { codes, namespaces };
}
